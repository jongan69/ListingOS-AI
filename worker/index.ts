import { type Context, Hono, type Next } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import {
  BlockerSchema,
  BillingEventSchema,
  BillingPlanSchema,
  BillingSummarySchema,
  BillingSyncRequestSchema,
  RevenueCatWebhookTraceQuerySchema,
  RevenueCatWebhookTraceResponseSchema,
  CameraSessionCreateInputSchema,
  CameraSessionSchema,
  DraftJobSchema,
  DraftJobStatusSchema,
  DraftPayloadSchema,
  ImageEnhancementSchema,
  ListingModeSchema,
  PricingStrategySchema,
  PricingEvidenceSchema,
  ProductIdentitySchema,
  PublishRequestSchema,
  PublishResultSchema,
  PushTokenRegistrationSchema,
  QueueItemSchema,
  SellerReadinessSchema,
  SessionStateSchema,
  SessionUserSchema,
  UploadBatchSchema,
  UploadInitResponseSchema,
  VisionFrameContextSchema,
  type BlockerType,
  type BillingPlan,
  type BillingSummary,
  type BillingSyncRequest,
  type RevenueCatWebhookTraceItem,
  type RevenueCatWebhookTraceResponse,
  type DraftPayload,
  type PricingEvidence,
  type ProductIdentity,
  type PublishRequest,
  type PricingStrategy,
} from "../src/shared/contracts";
import { partitionPhotosIntoProducts, recordPublishOutcome } from "./listing-intelligence";
import type {
  BatchPhotoRecord,
  Bindings,
  DraftJobRecord,
  DraftRecord,
  MarketplaceSettingsRecord,
  QueueMessage,
  SellerAccountRecord,
  SessionRecord,
  Variables,
} from "./types";

type AppEnvironment = { Bindings: Bindings; Variables: Variables };

const app = new Hono<AppEnvironment>();
const OPENAI_DRAFT_TIMEOUT_MS = 45_000;
const EBAY_FAST_LOOKUP_TIMEOUT_MS = 6_000;
const EBAY_SELLER_REQUEST_TIMEOUT_MS = 15_000;
const EBAY_MEDIA_INGEST_TIMEOUT_MS = 12_000;
const EXTERNAL_MARKET_LOOKUP_TIMEOUT_MS = 5_000;
const REVENUECAT_REST_TIMEOUT_MS = 5_000;
const STALE_PUBLISH_ATTEMPT_MS = 2 * 60_000;
const DRAFT_IMAGE_LIMIT = 6;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_BATCH_PHOTOS = 24;
const CARD_IMAGE_SEARCH_LIMIT = 20;
const CARD_OCR_IMAGE_LIMIT = 5;
const DEFAULT_FAST_DRAFT_MODEL = "gpt-5.6-luna";
const LOCAL_MARKET_SIGNAL_LIMIT = 6;
const AI_PRICING_VERSION = "openai-2026-07-18";
const AI_MODEL_PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.6-luna": { input: 1, cachedInput: 0.1, output: 6 },
};

const REVENUECAT_WEBHOOK_RELEVANT_EVENT_TYPES = new Set([
  "purchase_completed",
  "entitlement_granted",
  "restore",
  "subscription_renewed",
  "subscription_renewal",
  "initial_purchase",
  "purchase",
  "renewal",
]);

type RevenueCatWebhookSignatureCheck = {
  checked: boolean;
  provided: boolean;
  valid: boolean;
  status: "ok" | "missing_signature" | "missing_signing_secret" | "invalid_format" | "signature_mismatch";
};

type WorkerLogLevel = "info" | "warn" | "error";

function logWorkerItem(
  level: WorkerLogLevel,
  event: string,
  context: Partial<{ batchId: string; jobId: string; draftId: string; attemptId: string }>,
  details: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...context,
    ...details,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

function firstNonEmptyString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeWebhookEventType(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[.\-\s]+/g, "_");
}

function extractRevenueCatEventId(event: Record<string, unknown>, eventPayload: Record<string, unknown> | null) {
  const candidates = [
    event.id,
    event.eventId,
    event.event_id,
    eventPayload?.id,
    eventPayload?.eventId,
    eventPayload?.event_id,
    event.original_transaction_id,
    event.originalTransactionId,
  ];
  return firstNonEmptyString(candidates);
}

function parseWebhookSignatureHeader(value: string | undefined) {
  if (!value) return null;
  const headerParts = value.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of headerParts) {
    const [name, ...rest] = part.split("=");
    const candidate = rest.length > 0 ? rest.join("=").trim() : part.trim();
    if (candidate.length === 0) continue;
    const key = (name ?? "").toLowerCase();
    if (key === "v1" || key === "sha256" || key === "signature" || key === "revenuecat" || part === candidate) {
      return candidate;
    }
  }
  return headerParts[0] ?? null;
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary);
}

function secureStringEquals(a: string, b: string) {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    const left = index < a.length ? a.charCodeAt(index) : 0;
    const right = index < b.length ? b.charCodeAt(index) : 0;
    diff |= left ^ right;
  }
  return diff === 0;
}

async function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined, secret: string | undefined): Promise<RevenueCatWebhookSignatureCheck> {
  const signature = parseWebhookSignatureHeader(signatureHeader);
  if (!signatureHeader) {
    return {
      checked: false,
      provided: false,
      valid: false,
      status: "missing_signature",
    };
  }
  if (!signature) {
    return {
      checked: true,
      provided: true,
      valid: false,
      status: "invalid_format",
    };
  }
  if (!secret) {
    return {
      checked: true,
      provided: true,
      valid: false,
      status: "missing_signing_secret",
    };
  }
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(rawBody));
  const expectedHex = bytesToHex(digest);
  const expectedBase64 = bytesToBase64(digest);
  const signatureTrimmed = signature.trim();
  const valid = secureStringEquals(signatureTrimmed.toLowerCase(), expectedHex.toLowerCase())
    || secureStringEquals(signatureTrimmed, expectedBase64)
    || secureStringEquals(signatureTrimmed, expectedHex.toLowerCase())
    || secureStringEquals(signatureTrimmed.toUpperCase(), expectedHex.toUpperCase());
  return {
    checked: true,
    provided: true,
    valid,
    status: valid ? "ok" : "signature_mismatch",
  };
}

async function hasProcessedWebhookEvent(
  env: Bindings,
  sellerAccountId: string,
  webhookEventId: string,
) {
  try {
    const previousRows = await env.DB.prepare(
      "SELECT payload_json FROM app_events WHERE seller_account_id = ? AND event_type = 'billing.revenuecat_webhook' ORDER BY created_at DESC LIMIT 50",
    ).bind(sellerAccountId).all<{ payload_json: string }>();
    for (const row of previousRows.results ?? []) {
      const payload = parseJsonRecord(row.payload_json);
      if (!payload) continue;
      const candidate = stringOr(payload.eventId, null);
      if (candidate && candidate === webhookEventId) return true;
    }
  } catch (error) {
    logWorkerItem("warn", "billing.revenuecat_webhook.replay_check_failed", {}, {
      sellerAccountId,
      webhookEventId,
      error: error instanceof Error ? error.message : "Unknown replay check error",
    });
  }
  return false;
}

function toIsoTimestamp(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback;
}

async function safeRecordRevenueCatWebhookEvent(env: Bindings, sellerAccountId: string | null, eventType: string, payload: Record<string, unknown>) {
  await recordAppEvent(env, sellerAccountId, eventType, payload).catch((error) => {
    logWorkerItem("warn", "billing.revenuecat_webhook.record_failed", {}, {
      eventType,
      error: error instanceof Error ? error.message : "Unknown logging error",
    });
  });
}

async function queueMessageContext(env: Bindings, message: QueueMessage) {
  if (message.type === "process_upload_batch") return { batchId: message.batchId };
  if (message.type === "generate_draft") {
    const job = await env.DB.prepare(
      "SELECT batch_id, draft_id FROM draft_jobs WHERE id = ?",
    ).bind(message.jobId).first<{ batch_id: string; draft_id: string | null }>().catch(() => null);
    return { jobId: message.jobId, batchId: job?.batch_id, draftId: job?.draft_id ?? undefined };
  }
  return { draftId: message.draftId, attemptId: message.attemptId };
}
const BILLING_PLANS: Record<BillingPlan, {
  includedCredits: number;
  maxActiveJobs: number;
  canAutoPublish: boolean;
  canUseBulkQueue: boolean;
  canUseAdvancedCardChecks: boolean;
}> = {
  free: {
    includedCredits: 20,
    maxActiveJobs: 1,
    canAutoPublish: false,
    canUseBulkQueue: false,
    canUseAdvancedCardChecks: true,
  },
  starter: {
    includedCredits: 75,
    maxActiveJobs: 2,
    canAutoPublish: true,
    canUseBulkQueue: false,
    canUseAdvancedCardChecks: true,
  },
  pro: {
    includedCredits: 300,
    maxActiveJobs: 5,
    canAutoPublish: true,
    canUseBulkQueue: true,
    canUseAdvancedCardChecks: true,
  },
  studio: {
    includedCredits: 1000,
    maxActiveJobs: 10,
    canAutoPublish: true,
    canUseBulkQueue: true,
    canUseAdvancedCardChecks: true,
  },
};

type SellerAiDraftOutput = {
  titleOptions: { title: string; rationale: string }[];
  searchQuery: string;
  categoryGuessText: string;
  condition: string;
  conditionNotes: string;
  description: string;
  confidence: number;
  suggestedPriceFloor: number | null;
  listingModeRecommendation: "fixed_price" | "auction";
  allowAuction: boolean;
  itemSpecifics: { name: string; value: string }[];
  photoChecklist: string[];
  missingInfo: string[];
  enhancementPlan: { type: string; rationale: string; sourcePhotoIds: string[] }[];
  productVertical: "general" | "trading_card" | "graded_card";
  cardIdentifiers: {
    grader: string | null;
    certNumber: string | null;
    grade: string | null;
    game: string | null;
    cardName: string | null;
    setName: string | null;
    cardNumber: string | null;
    year: string | null;
    parallel: string | null;
    language: string | null;
  };
};

type AiListingDraft = Awaited<ReturnType<typeof createListingDraft>>;
type AiOperationContext = {
  sellerAccountId: string;
  batchId?: string | null;
  jobId?: string | null;
  draftId?: string | null;
};
type MarketComparable = {
  itemId?: string;
  title: string;
  itemWebUrl: string;
  imageUrl?: string | null;
  condition: string | null;
  totalPrice: number | null;
  matchScore?: number;
  rejectionReason?: string | null;
  source?: "ebay_active" | "ebay_sold" | "catalog" | "fallback" | "offerup_active";
};
type ComparableSearchResult = {
  accepted: MarketComparable[];
  rejected: MarketComparable[];
  evidence: PricingEvidence;
};
type QueueRow = {
  job_id: string;
  batch_id: string;
  draft_id: string | null;
  marketplace_id: string;
  cluster_label: string | null;
  pricing_strategy: PricingStrategy;
  job_listing_mode: string | null;
  job_status: string;
  job_error_message: string | null;
  job_created_at: string;
  job_updated_at: string;
  batch_status: string;
  batch_updated_at: string;
  draft_status: string | null;
  draft_title: string | null;
  draft_payload_json: string | null;
  draft_updated_at: string | null;
  publish_attempt_id: string | null;
  publish_status: string | null;
  publish_response_json: string | null;
  ebay_listing_id: string | null;
  publish_updated_at: string | null;
};

app.use("*", async (c, next) => {
  await next();
  c.header("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  if (c.req.path.startsWith("/api/") && !c.req.path.startsWith("/api/public/photos/")) {
    c.header("Cache-Control", "no-store");
  }
});

app.use("*", cors({
  origin: (origin, c) => isAllowedWebOrigin(origin, c.env.PUBLIC_WEB_APP_URL) ? origin : null,
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
  maxAge: 86_400,
}));

app.use("/api/*", async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    c.set("session", null);
    c.set("seller", null);
    return next();
  }
  const token = authorization.replace("Bearer ", "").trim();
  const session = await c.env.DB.prepare(
    "SELECT id, user_id, seller_account_id, expires_at FROM app_sessions WHERE id = ?",
  ).bind(token).first<SessionRecord>();
  if (!session || Date.parse(session.expires_at) <= Date.now()) {
    c.set("session", null);
    c.set("seller", null);
    return next();
  }
  const seller = await c.env.DB.prepare(
    "SELECT id, user_id, seller_username, ebay_user_id, access_token_cipher, refresh_token_cipher, access_token_expires_at FROM seller_accounts WHERE id = ?",
  ).bind(session.seller_account_id).first<SellerAccountRecord>();
  c.set("session", session);
  c.set("seller", seller ?? null);
  return next();
});

app.get("/health", async (c) => {
  return c.json({
    ok: true,
    serverTime: new Date().toISOString(),
    openAiConfigured: Boolean(c.env.OPENAI_API_KEY),
    ebayConfigured: Boolean(c.env.EBAY_CLIENT_ID && c.env.EBAY_CLIENT_SECRET && c.env.EBAY_RUNAME),
    storageConfigured: Boolean(c.env.UPLOADS_BUCKET),
    queueConfigured: Boolean(c.env.PROCESS_UPLOAD_BATCH_QUEUE && c.env.GENERATE_DRAFT_QUEUE && c.env.PUBLISH_LISTING_QUEUE),
    d1Configured: Boolean(c.env.DB),
    analyticsConfigured: Boolean(c.env.INTERNAL_ANALYTICS_TOKEN),
  });
});

app.get("/api/internal/analytics/summary", async (c) => {
  if (!isInternalAnalyticsAuthorized(c.req.header("Authorization"), c.env.INTERNAL_ANALYTICS_TOKEN)) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  const requestedDays = Number(c.req.query("days") ?? "7");
  const days = Number.isFinite(requestedDays) ? Math.min(30, Math.max(1, Math.floor(requestedDays))) : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [operations, drafts, publishes, credits, latencyRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT operation, provider, model, COUNT(*) AS requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
        SUM(estimated_cost_usd) AS estimated_cost_usd,
        AVG(latency_ms) AS average_latency_ms
       FROM ai_operation_events WHERE created_at >= ?
       GROUP BY operation, provider, model ORDER BY estimated_cost_usd DESC`,
    ).bind(since).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status IN ('ready', 'published') THEN 1 ELSE 0 END) AS ready_or_published,
        SUM(CASE WHEN status = 'needs_input' THEN 1 ELSE 0 END) AS needs_input,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM drafts WHERE created_at >= ?`,
    ).bind(since).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM publish_attempts WHERE created_at >= ?`,
    ).bind(since).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS events, SUM(quantity) AS credits,
        SUM(COALESCE(cost_estimate_usd, 0)) AS estimated_cost_usd
       FROM usage_events WHERE event_type = 'ai_listing_credit' AND created_at >= ?`,
    ).bind(since).first(),
    c.env.DB.prepare(
      "SELECT latency_ms FROM ai_operation_events WHERE created_at >= ? AND latency_ms IS NOT NULL ORDER BY latency_ms ASC LIMIT 10000",
    ).bind(since).all<{ latency_ms: number }>(),
  ]);
  const latencies = (latencyRows.results ?? []).map((row) => row.latency_ms).filter(Number.isFinite);
  return c.json({
    generatedAt: new Date().toISOString(),
    windowDays: days,
    operations: operations.results ?? [],
    drafts: drafts ?? {},
    publishes: publishes ?? {},
    credits: credits ?? {},
    latencyMs: {
      samples: latencies.length,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
  });
});

app.get("/api/internal/analytics/listings/:draftId", async (c) => {
  if (!isInternalAnalyticsAuthorized(c.req.header("Authorization"), c.env.INTERNAL_ANALYTICS_TOKEN)) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  const draftId = c.req.param("draftId");
  const [operations, credit, draft, publishes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT operation, provider, model, provider_request_id, input_tokens, cached_input_tokens,
        output_tokens, reasoning_tokens, image_count, image_detail, latency_ms, cache_hit,
        success, error_code, estimated_cost_usd, pricing_version, metadata_json, created_at
       FROM ai_operation_events
       WHERE draft_id = ? OR job_id IN (SELECT id FROM draft_jobs WHERE draft_id = ?)
       ORDER BY created_at ASC`,
    ).bind(draftId, draftId).all(),
    c.env.DB.prepare(
      "SELECT quantity, cost_estimate_usd, metadata_json, created_at FROM usage_events WHERE draft_id = ? ORDER BY created_at ASC",
    ).bind(draftId).all(),
    c.env.DB.prepare(
      "SELECT status, confidence, created_at, updated_at FROM drafts WHERE id = ?",
    ).bind(draftId).first(),
    c.env.DB.prepare(
      "SELECT id, status, adapter, ebay_listing_id, ebay_offer_id, response_json, created_at, updated_at FROM publish_attempts WHERE draft_id = ? ORDER BY created_at ASC",
    ).bind(draftId).all(),
  ]);
  return c.json({ draft: draft ?? null, operations: operations.results ?? [], credits: credit.results ?? [], publishes: publishes.results ?? [] });
});

app.get("/privacy", (c) => c.html(renderMarketingHtml(
  "ListingOS Privacy",
  [
    "ListingOS uses eBay OAuth to connect a seller account, product photos selected by the seller, listing drafts generated from those photos, and seller readiness data required by eBay.",
    "Photos are stored in Cloudflare R2 for listing generation and publishing. Drafts, jobs, publish attempts, and listing references are stored in Cloudflare D1. OAuth state and short-lived session cache are stored in Cloudflare KV.",
    "eBay tokens are stored server-side and are not embedded in the mobile app. The backend sends product photos and marketplace context to the OpenAI Responses API to generate structured listing recommendations.",
    "Publishing with production credentials can create a live eBay listing. ListingOS is an independent seller tool and is not affiliated with or endorsed by eBay.",
  ],
)));

const supportPageParagraphs = [
  "For demo, judging, or release support, start with the project README, release notes, and demo recording guide in the repository.",
  "Backend health is available at /health on this Worker.",
  "Do not share API keys, eBay OAuth secrets, seller tokens, or private listing credentials in public support threads.",
];

app.get("/support", (c) => c.html(renderMarketingHtml("ListingOS Support", supportPageParagraphs)));
app.get("/app-support", (c) => c.html(renderMarketingHtml("ListingOS Support", supportPageParagraphs)));

app.post("/api/session/ebay/connect", async (c) => {
  const authSessionId = crypto.randomUUID();
  const state = `seller-ai.${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO auth_sessions (id, oauth_state, status, created_at, expires_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?)",
  ).bind(authSessionId, state, now, expiresAt, now).run();
  await c.env.SESSION_KV.put(`oauth-state:${state}`, authSessionId, { expirationTtl: 15 * 60 });

  const authUrl = new URL("/oauth2/authorize", getEbayAuthBaseUrl(c.env));
  authUrl.searchParams.set("client_id", c.env.EBAY_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", c.env.EBAY_RUNAME);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    [
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/sell.account",
      "https://api.ebay.com/oauth/api_scope/sell.inventory",
    ].join(" "),
  );
  authUrl.searchParams.set("state", state);
  return c.json({
    authSessionId,
    authUrl: authUrl.toString(),
    expiresAt,
  });
});

app.get("/api/session/pending/:authSessionId", async (c) => {
  const authSession = await c.env.DB.prepare(
    "SELECT id, status, error_message, session_token, seller_account_id FROM auth_sessions WHERE id = ?",
  ).bind(c.req.param("authSessionId")).first<{
    id: string;
    status: string;
    error_message: string | null;
    session_token: string | null;
    seller_account_id: string | null;
  }>();
  if (!authSession) {
    return c.json({ error: "Auth session not found." }, 404);
  }
  let sellerUsername: string | null = null;
  if (authSession.seller_account_id) {
    const seller = await c.env.DB.prepare(
      "SELECT seller_username FROM seller_accounts WHERE id = ?",
    ).bind(authSession.seller_account_id).first<{ seller_username: string }>();
    sellerUsername = seller?.seller_username ?? null;
  }
  const payload = SessionStateSchema.parse({
    status: authSession.status === "complete" ? "complete" : authSession.status === "failed" ? "failed" : "pending",
    authSessionId: authSession.id,
    sellerUsername,
    sessionToken: authSession.session_token,
    errorMessage: authSession.error_message,
  });
  return c.json(payload);
});

app.get("/api/session/ebay/callback", async (c) => {
  const state = c.req.query("state") ?? "";
  const code = c.req.query("code") ?? "";
  const error = c.req.query("error");
  const authSessionId = await c.env.SESSION_KV.get(`oauth-state:${state}`);
  const isMobileWebview = isProbablyMobileCallback(c.req.header("user-agent"));
  if (!authSessionId) {
    return c.html(
      renderCallbackHtml(
        "Expired auth session.",
        "Start the seller sign-in flow again from ListingOS.",
        undefined,
        isMobileWebview,
      ),
      400,
    );
  }
  if (error) {
    await c.env.DB.prepare(
      "UPDATE auth_sessions SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
    ).bind(error, new Date().toISOString(), authSessionId).run();
    return c.html(
      renderCallbackHtml(
        "eBay sign-in cancelled.",
        error,
        { authSessionId, status: "failed" },
        isMobileWebview,
      ),
      400,
    );
  }
  if (!code) {
    return c.html(
      renderCallbackHtml(
        "Missing eBay code.",
        "The callback reached ListingOS without an authorization code.",
        { authSessionId, status: "failed" },
        isMobileWebview,
      ),
      400,
    );
  }

  try {
    const tokenPayload = await exchangeSellerAuthorizationCode(c.env, code);
    const user = await fetchSellerIdentity(c.env, tokenPayload.access_token);
    const sellerUsername = user.username ?? user.userId ?? "seller";
    const now = new Date().toISOString();
    const userId = await upsertUser(c.env, sellerUsername, user.userId ?? null, now);
    const sellerAccountId = await upsertSellerAccount(c.env, {
      userId,
      sellerUsername,
      ebayUserId: user.userId ?? null,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? "",
      accessTokenExpiresAt: new Date(Date.now() + Math.max((tokenPayload.expires_in ?? 7200) - 60, 60) * 1000).toISOString(),
    });
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT OR REPLACE INTO app_sessions (id, user_id, seller_account_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(sessionToken, userId, sellerAccountId, now, expiresAt),
      c.env.DB.prepare(
        "UPDATE auth_sessions SET status = 'complete', user_id = ?, seller_account_id = ?, session_token = ?, updated_at = ? WHERE id = ?",
      ).bind(userId, sellerAccountId, sessionToken, now, authSessionId),
    ]);

    return c.html(
      renderCallbackHtml(
        "Seller account connected.",
        "Opening ListingOS now. If it does not open automatically, use the button below.",
        { authSessionId, status: "complete" },
        isMobileWebview,
      ),
    );
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : String(callbackError);
    await c.env.DB.prepare(
      "UPDATE auth_sessions SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
    ).bind(message, new Date().toISOString(), authSessionId).run();
    return c.html(
      renderCallbackHtml(
        "eBay sign-in failed.",
        message,
        { authSessionId, status: "failed" },
        isMobileWebview,
      ),
      500,
    );
  }
});

app.get("/api/session/me", async (c) => {
  const session = c.get("session");
  const seller = c.get("seller");
  if (!session || !seller) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  const marketplaces = await c.env.DB.prepare(
    "SELECT marketplace_id FROM seller_marketplace_settings WHERE seller_account_id = ? ORDER BY marketplace_id ASC",
  ).bind(seller.id).all<{ marketplace_id: string }>();
  const payload = SessionUserSchema.parse({
    userId: session.user_id,
    sellerAccountId: seller.id,
    sellerUsername: seller.seller_username,
    marketplaces: (marketplaces.results ?? []).map((row) => row.marketplace_id),
  });
  return c.json(payload);
});

app.get("/api/billing/summary", requireSession, async (c) => {
  const seller = c.get("seller")!;
  return c.json(await getBillingSummary(c.env, seller.id));
});

app.post("/api/billing/sync", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const body = BillingSyncRequestSchema.parse(await c.req.json().catch(() => ({})));
  await syncBillingProfile(c.env, seller.id, await resolveClientBillingSync(c.env, seller.id, body));
  return c.json(await getBillingSummary(c.env, seller.id));
});

app.post("/api/billing/events", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const event = BillingEventSchema.parse(await c.req.json().catch(() => ({})));
  await recordAppEvent(c.env, seller.id, `billing.${event.eventName}`, {
    trigger: event.trigger ?? null,
    plan: event.plan ?? null,
    packageId: event.packageId ?? null,
    ...event.metadata,
  });
  return c.json({ ok: true });
});

app.post("/api/revenuecat/webhook", async (c) => {
  const expectedToken = c.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;
  const expectedSecret = c.env.REVENUECAT_SECRET_API_KEY?.trim();
  const authorization = c.req.header("Authorization") ?? "";
  const signatureHeader = c.req.header("x-revenuecat-signature")
    ?? c.req.header("x-revenuecat-webhook-signature");
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const receivedAt = new Date().toISOString();
  const rawBody = await c.req.text().catch(() => "");
  const body = parseJsonValue(rawBody);
  const event = asRecord(body) ?? {};
  const eventPayload = asRecord(event.event);
  const signatureCheck = await verifyWebhookSignature(rawBody, signatureHeader, expectedSecret);
  const envelopeType = eventPayload?.type ?? event?.type ?? event?.eventType;
  const rawEventType = stringOr(envelopeType, "unknown");
  const eventType = normalizeWebhookEventType(rawEventType);
  const webhookId = extractRevenueCatEventId(event, eventPayload);
  const normalizedWebhookId = webhookId ? webhookId.trim() : null;
  const appUserId = stringOr(
    event?.app_user_id
      ?? event?.appUserId
      ?? eventPayload?.app_user_id
      ?? eventPayload?.appUserId,
    "",
  );
  const customerId = stringOr(
    event?.customer_id
      ?? event?.customerId
      ?? eventPayload?.customer_id
      ?? eventPayload?.customerId
      ?? appUserId,
    "",
  );
  const traceAppUserId = appUserId || customerId || null;
  const packageId = firstNonEmptyString([
    eventPayload?.package_id,
    eventPayload?.packageId,
    eventPayload?.product_id,
    eventPayload?.productId,
    eventPayload?.offer_id,
    eventPayload?.offerId,
    eventPayload?.store_product_id,
    eventPayload?.storeProductId,
    event?.package_id,
    event?.packageId,
    event?.product_id,
    event?.productId,
    event?.offer_id,
    event?.offerId,
    event?.store_product_id,
    event?.storeProductId,
  ]);
  const eventTimestamp = toIsoTimestamp(
    eventPayload?.timestamp ?? eventPayload?.event_timestamp ?? eventPayload?.event_ts ?? event?.timestamp,
    receivedAt,
  );
  const isPurchaseTransition = REVENUECAT_WEBHOOK_RELEVANT_EVENT_TYPES.has(eventType);
  const traceTemplate = {
    source: "revenuecat_webhook",
    receivedAt,
    appUserId: traceAppUserId ?? "",
    customerId: customerId || null,
    packageId,
    eventType,
    rawType: rawEventType,
    isPurchaseTransition,
    eventId: normalizedWebhookId,
    isReplay: false,
    signatureVerified: signatureCheck.valid,
    signatureStatus: signatureCheck.status,
    eventName: "billing.revenuecat_webhook.event",
  };
  if (!expectedToken && billingEnforcementMode(c.env) === "enforce") {
    logWorkerItem("error", "billing.revenuecat_webhook.auth.config_error", {}, {
      enforcementMode: billingEnforcementMode(c.env),
      eventType,
      appUserId,
      customerId,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, null, "billing.revenuecat_webhook.config", {
      ...traceTemplate,
      reason: "missing_token",
      timestamp: receivedAt,
    });
    return c.json({ error: "RevenueCat webhook token is not configured." }, 503);
  }
  if (expectedToken && token !== expectedToken) {
    logWorkerItem("warn", "billing.revenuecat_webhook.auth.failed", {}, {
      hasAuthHeader: Boolean(authorization),
      eventType,
      appUserId,
      customerId,
      receivedAt,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, null, "billing.revenuecat_webhook.auth", {
      ...traceTemplate,
      reason: "token_mismatch",
      timestamp: receivedAt,
    });
    return c.json({ error: "Unauthorized." }, 401);
  }
  if (signatureCheck.status === "missing_signing_secret") {
    logWorkerItem("error", "billing.revenuecat_webhook.auth.config_error", {}, {
      enforcementMode: billingEnforcementMode(c.env),
      eventType,
      eventId: normalizedWebhookId,
      appUserId,
      customerId,
      signatureStatus: signatureCheck.status,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, null, "billing.revenuecat_webhook.config", {
      ...traceTemplate,
      reason: "missing_signing_secret",
      timestamp: receivedAt,
    });
    return c.json({ error: "RevenueCat webhook signing secret is not configured." }, 503);
  }
  if (!signatureCheck.valid) {
    logWorkerItem("warn", "billing.revenuecat_webhook.signature.failed", {}, {
      eventType,
      appUserId,
      customerId,
      eventId: normalizedWebhookId,
      hasSignatureHeader: Boolean(signatureHeader),
      signatureStatus: signatureCheck.status,
      receivedAt,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, null, "billing.revenuecat_webhook.signature", {
      ...traceTemplate,
      reason: signatureCheck.status,
      timestamp: receivedAt,
    });
    return c.json({ error: "Unauthorized." }, 401);
  }
  if (!appUserId) {
    logWorkerItem("warn", "billing.revenuecat_webhook.skipped", {}, {
      reason: "missing_app_user_id",
      eventType,
      rawType: rawEventType,
      hasBody: Boolean(body),
      appUserId,
      customerId,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, null, "billing.revenuecat_webhook", {
      ...traceTemplate,
      reason: "missing_app_user_id",
      timestamp: eventTimestamp,
    });
    return c.json({ ok: true, skipped: "missing_app_user_id" });
  }
  const profile = await c.env.DB.prepare(
    "SELECT seller_account_id FROM billing_profiles WHERE revenuecat_app_user_id = ?",
  ).bind(appUserId).first<{ seller_account_id: string }>();
  if (!profile) {
    logWorkerItem("info", "billing.revenuecat_webhook.skipped", {}, {
      reason: "unknown_app_user_id",
      appUserId,
      eventType,
      customerId,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, null, "billing.revenuecat_webhook", {
      ...traceTemplate,
      reason: "unknown_app_user_id",
      timestamp: eventTimestamp,
    });
    return c.json({ ok: true, skipped: "unknown_app_user_id" });
  }
  const entitlementIds = Array.isArray(eventPayload?.entitlement_ids)
    ? eventPayload.entitlement_ids.filter((item): item is string => typeof item === "string")
    : Array.isArray(event?.entitlement_ids)
      ? event.entitlement_ids.filter((item): item is string => typeof item === "string")
    : Array.isArray(event.entitlements)
      ? event.entitlements.filter((item): item is string => typeof item === "string")
      : [];
  const revokedTypes = new Set(["EXPIRATION", "REFUND"]);
  const activeEntitlements = revokedTypes.has(rawEventType.toUpperCase()) ? [] : entitlementIds;
  const eventTrace = {
    ...traceTemplate,
    eventId: normalizedWebhookId,
    timestamp: eventTimestamp,
    isPurchaseTransition,
    rawEntitlementIds: entitlementIds,
    eventPayload: eventPayload ? {
      eventType: rawEventType,
      environment: eventPayload.environment,
      app: eventPayload.app ?? null,
      storefront: eventPayload.storefront ?? null,
      offerType: eventPayload.offer_type ?? null,
      periodType: eventPayload.period_type ?? null,
    } : null,
    rawPayload: event,
  };
  const isReplay = normalizedWebhookId ? await hasProcessedWebhookEvent(c.env, profile.seller_account_id, normalizedWebhookId) : false;
  if (isReplay) {
    logWorkerItem("info", "billing.revenuecat_webhook.replay", {}, {
      sellerAccountId: profile.seller_account_id,
      eventId: normalizedWebhookId,
      appUserId,
      eventType,
      packageId,
    });
    await safeRecordRevenueCatWebhookEvent(c.env, profile.seller_account_id, "billing.revenuecat_webhook", {
      ...eventTrace,
      isReplay: true,
      reason: "duplicate_event",
    });
    return c.json({ ok: true, replay: true });
  }
  await syncBillingProfile(c.env, profile.seller_account_id, {
    appUserId,
    source: "revenuecat_webhook",
    activeEntitlements,
    subscriptionStatus: rawEventType.toLowerCase(),
    customerInfo: {
      ...event,
      __revenuecat_webhook_trace: eventTrace,
    },
  });
  await safeRecordRevenueCatWebhookEvent(c.env, profile.seller_account_id, "billing.revenuecat_webhook", {
    ...eventTrace,
    eventType,
    activeEntitlements,
    isReplay: false,
  });
  logWorkerItem("info", "billing.revenuecat_webhook.processed", {}, {
    sellerAccountId: profile.seller_account_id,
    appUserId,
    packageId,
    eventType,
    isPurchaseTransition,
    isReplay,
  });
  return c.json({ ok: true, replay: false });
});

app.get("/api/internal/revenuecat/webhook-traces", async (c) => {
  if (!isInternalAnalyticsAuthorized(c.req.header("Authorization"), c.env.INTERNAL_ANALYTICS_TOKEN)) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  const parsed = RevenueCatWebhookTraceQuerySchema.parse({
    limit: c.req.query("limit") ?? undefined,
    appUserId: c.req.query("appUserId") ?? undefined,
    eventType: c.req.query("eventType") ?? undefined,
  });
  const eventLimit = Math.max(1, Math.min(200, parsed.limit));
  const rows = await c.env.DB.prepare(
    `SELECT
      id,
      seller_account_id,
      payload_json,
      created_at
     FROM app_events
     WHERE event_type LIKE 'billing.revenuecat_webhook%'
     ORDER BY created_at DESC
     LIMIT ?`,
  ).bind(eventLimit * 4).all<{
    id: string;
    seller_account_id: string | null;
    payload_json: string;
    created_at: string;
  }>();

  const traces = (rows.results ?? []).reduce<RevenueCatWebhookTraceItem[]>((acc, row) => {
    if (acc.length >= eventLimit) return acc;
    const payload = parseJsonRecord(row.payload_json);
    if (!payload) return acc;

    const traceEventType = normalizeWebhookEventType(stringOr(payload.eventType, stringOr(payload.rawType, "unknown")));
    if (parsed.eventType && traceEventType !== normalizeWebhookEventType(parsed.eventType)) return acc;

    const appUserId = parsed.appUserId ? stringOr(payload.appUserId, "") : stringOr(payload.appUserId, null);
    if (parsed.appUserId && appUserId !== parsed.appUserId) return acc;

    acc.push({
      traceId: row.id,
      eventType: traceEventType,
      eventId: stringOr(payload.eventId, null),
      appUserId: stringOr(payload.appUserId, ""),
      customerId: stringOr(payload.customerId, ""),
      packageId: stringOr(payload.packageId, null),
      timestamp: stringOr(payload.timestamp, row.created_at),
      receivedAt: stringOr(payload.receivedAt, row.created_at),
      isPurchaseTransition: payload.isPurchaseTransition === true,
      isReplay: payload.isReplay === true,
      signatureVerified: payload.signatureVerified === true,
      signatureStatus: stringOr(payload.signatureStatus, null),
      eventName: stringOr(payload.eventName, "billing.revenuecat_webhook"),
      source: stringOr(payload.source, "revenuecat_webhook"),
      sellerAccountId: row.seller_account_id,
      eventPayload: asRecord(payload.eventPayload) ?? undefined,
      rawPayload: asRecord(payload.rawPayload) ?? undefined,
      rawType: stringOr(payload.rawType, null),
    });
    return acc;
  }, []);

  const response: RevenueCatWebhookTraceResponse = RevenueCatWebhookTraceResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    traces,
    limit: eventLimit,
  });
  return c.json(response);
});

app.post("/api/devices/push-token", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const body = PushTokenRegistrationSchema.parse(await c.req.json().catch(() => ({})));
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO device_push_tokens (id, seller_account_id, token, platform, device_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(token) DO UPDATE SET
       seller_account_id = excluded.seller_account_id,
       platform = excluded.platform,
       device_name = excluded.device_name,
       status = 'active',
       updated_at = excluded.updated_at`,
  ).bind(
    crypto.randomUUID(),
    seller.id,
    body.token,
    body.platform,
    body.deviceName ?? null,
    now,
    now,
  ).run();
  return c.json({ ok: true });
});

app.post("/api/devices/test-notification", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const result = await notifySellerDevices(c.env, seller.id, {
    title: "ListingOS alerts are live",
    body: "Background listing updates can reach this device.",
    data: {
      type: "test_notification",
      sellerAccountId: seller.id,
      sentAt: new Date().toISOString(),
    },
  });
  return c.json({
    ok: result.sentCount > 0,
    ...result,
  });
});

app.get("/api/queue", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const rows = await c.env.DB.prepare(
    `SELECT
      j.id AS job_id,
      j.batch_id AS batch_id,
      j.draft_id AS draft_id,
      j.marketplace_id AS marketplace_id,
      j.cluster_label AS cluster_label,
      j.pricing_strategy AS pricing_strategy,
      j.listing_mode AS job_listing_mode,
      j.status AS job_status,
      j.error_message AS job_error_message,
      j.created_at AS job_created_at,
      j.updated_at AS job_updated_at,
      b.status AS batch_status,
      b.updated_at AS batch_updated_at,
      d.status AS draft_status,
      d.title AS draft_title,
      d.payload_json AS draft_payload_json,
      d.updated_at AS draft_updated_at,
      p.id AS publish_attempt_id,
      p.status AS publish_status,
      p.response_json AS publish_response_json,
      p.ebay_listing_id AS ebay_listing_id,
      p.updated_at AS publish_updated_at
    FROM draft_jobs j
    JOIN upload_batches b ON b.id = j.batch_id
    LEFT JOIN drafts d ON d.id = j.draft_id
    LEFT JOIN publish_attempts p ON p.id = (
      SELECT pa.id FROM publish_attempts pa
      WHERE pa.draft_id = j.draft_id AND pa.seller_account_id = j.seller_account_id
      ORDER BY pa.created_at DESC LIMIT 1
    )
    WHERE j.seller_account_id = ?
    ORDER BY COALESCE(p.updated_at, d.updated_at, j.updated_at, b.updated_at) DESC
    LIMIT 20`,
  ).bind(seller.id).all<QueueRow>();
  for (const row of rows.results ?? []) {
    maybeKickStaleDraftJob(c, {
      id: row.job_id,
      batch_id: row.batch_id,
      draft_id: row.draft_id,
      marketplace_id: row.marketplace_id,
      cluster_label: row.cluster_label,
      pricing_strategy: row.pricing_strategy,
      listing_mode: row.job_listing_mode,
      status: row.job_status,
      error_message: row.job_error_message,
      created_at: row.job_created_at,
      updated_at: row.job_updated_at,
      seller_account_id: seller.id,
    });
  }
  return c.json((rows.results ?? []).map((row) => buildQueueItem(c.env, row)));
});

app.post("/api/queue/:itemId/cancel", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const itemId = c.req.param("itemId");
  const job = await c.env.DB.prepare(
    "SELECT id, batch_id, draft_id, marketplace_id, cluster_label, pricing_strategy, listing_mode, status, error_message, created_at, updated_at FROM draft_jobs WHERE id = ? AND seller_account_id = ?",
  ).bind(itemId, seller.id).first<DraftJobRecord>();
  if (!job) {
    return c.json({ error: "Queue item not found." }, 404);
  }
  const now = new Date().toISOString();
  if (job.draft_id) {
    await c.env.DB.prepare(
      "UPDATE publish_attempts SET status = 'canceled', updated_at = ? WHERE draft_id = ? AND seller_account_id = ? AND status IN ('queued', 'publishing')",
    ).bind(now, job.draft_id, seller.id).run();
    const draft = await loadDraft(c.env, job.draft_id, seller.id);
    if (draft) {
      const draftStatus = draft.blockers.length > 0
        ? draft.blockers.some((blocker) => blocker.type === "low_confidence_product_match") ? "needs_input" : "blocked"
        : "ready";
      await saveDraftPayload(c.env, DraftPayloadSchema.parse({
        ...draft,
        status: draftStatus,
      }), seller.id);
      await c.env.DB.prepare(
        "UPDATE draft_jobs SET status = ?, error_message = NULL, updated_at = ? WHERE id = ? AND seller_account_id = ?",
      ).bind(draftStatus === "ready" ? "ready" : "needs_input", now, job.id, seller.id).run();
    }
  } else {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE draft_jobs SET status = 'canceled', error_message = NULL, updated_at = ? WHERE id = ? AND seller_account_id = ?",
      ).bind(now, job.id, seller.id),
      c.env.DB.prepare(
        "UPDATE upload_batches SET status = 'canceled', updated_at = ? WHERE id = ? AND seller_account_id = ?",
      ).bind(now, job.batch_id, seller.id),
    ]);
  }
  const item = await loadQueueItem(c.env, seller.id, job.id);
  return item ? c.json(item) : c.json({ error: "Canceled but could not reload queue item." }, 500);
});

app.post("/api/queue/:itemId/retry", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const itemId = c.req.param("itemId");
  const job = await c.env.DB.prepare(
    "SELECT id, batch_id, draft_id, marketplace_id, cluster_label, pricing_strategy, listing_mode, status, error_message, created_at, updated_at FROM draft_jobs WHERE id = ? AND seller_account_id = ?",
  ).bind(itemId, seller.id).first<DraftJobRecord>();
  if (!job) {
    return c.json({ error: "Queue item not found." }, 404);
  }
  if (job.draft_id) {
    const attempt = await c.env.DB.prepare(
      "SELECT id, payload_json FROM publish_attempts WHERE draft_id = ? AND seller_account_id = ? AND status IN ('failed', 'canceled') ORDER BY created_at DESC LIMIT 1",
    ).bind(job.draft_id, seller.id).first<{ id: string; payload_json: string }>();
    if (attempt) {
      const request = PublishRequestSchema.parse(JSON.parse(attempt.payload_json));
      const now = new Date().toISOString();
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE publish_attempts SET status = 'queued', response_json = NULL, updated_at = ? WHERE id = ? AND seller_account_id = ?",
        ).bind(now, attempt.id, seller.id),
        c.env.DB.prepare(
          "UPDATE draft_jobs SET status = 'publishing', error_message = NULL, updated_at = ? WHERE id = ? AND seller_account_id = ?",
        ).bind(now, job.id, seller.id),
      ]);
      const draft = await loadDraft(c.env, job.draft_id, seller.id);
      if (draft) {
        await saveDraftPayload(c.env, DraftPayloadSchema.parse({
          ...draft,
          status: "publishing",
        }), seller.id);
      }
      await c.env.PUBLISH_LISTING_QUEUE.send({
        type: "publish_listing",
        draftId: job.draft_id,
        attemptId: attempt.id,
        strategy: request.strategy,
      });
    }
    const item = await loadQueueItem(c.env, seller.id, job.id);
    return item ? c.json(item) : c.json({ error: "Draft is ready to edit. Open it to retry publishing." }, 409);
  }
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE draft_jobs SET status = 'queued', error_message = NULL, updated_at = ? WHERE id = ? AND seller_account_id = ?",
    ).bind(now, job.id, seller.id),
    c.env.DB.prepare(
      "UPDATE upload_batches SET status = 'queued', updated_at = ? WHERE id = ? AND seller_account_id = ?",
    ).bind(now, job.batch_id, seller.id),
  ]);
  c.executionCtx.waitUntil(processDraftJob(c.env, job.id));
  const item = await loadQueueItem(c.env, seller.id, job.id);
  return item ? c.json(item) : c.json({ error: "Retried but could not reload queue item." }, 500);
});

app.post("/api/uploads/batches", requireSession, async (c) => {
  const seller = c.get("seller")!;
  try {
    await assertCanStartDraft(c.env, seller.id);
  } catch (error) {
    if (error instanceof BillingBlockedError) {
      return c.json({ error: error.message, billing: error.summary }, 402);
    }
    throw error;
  }
  const body = await c.req.json().catch(() => ({}));
  const payload = {
    ...body,
    marketplaceId: stringOr(body.marketplaceId, c.env.EBAY_MARKETPLACE_ID ?? "EBAY_US"),
    pricingStrategy: body.pricingStrategy ?? "balanced",
    captureSource: body.captureSource ?? "manual",
    captureSessionId: body.captureSessionId ?? null,
    captureDeviceModel: body.captureDeviceModel ?? null,
    captureProfile: body.captureProfile ?? null,
  };
  const pricingStrategy = PricingStrategySchema.parse(payload.pricingStrategy);
  const captureSource = stringOr(payload.captureSource, "manual");
  const captureSessionId = stringOr(payload.captureSessionId, null);
  const captureDeviceModel = stringOr(payload.captureDeviceModel, null);
  const captureProfile = stringOr(payload.captureProfile, null);
  const marketplaceId = stringOr(body.marketplaceId, c.env.EBAY_MARKETPLACE_ID ?? "EBAY_US");
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO upload_batches (id, seller_account_id, marketplace_id, pricing_strategy, capture_source, capture_session_id, capture_device_model, capture_profile, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
  ).bind(
    batchId,
    seller.id,
    marketplaceId,
    pricingStrategy,
    captureSource,
    captureSessionId,
    captureDeviceModel,
    captureProfile,
    now,
    now,
  ).run();
  return c.json(
    UploadBatchSchema.parse({
      id: batchId,
      marketplaceId,
      pricingStrategy,
      captureSource: captureSource as "manual" | "sony_monitor" | "sony_remote",
      captureSessionId: captureSessionId,
      captureDeviceModel,
      captureProfile,
      status: "open",
      createdAt: now,
      updatedAt: now,
    }),
  );
});

app.post("/api/camera/sessions", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const body = await c.req.json().catch(() => ({}));
  const parsed = CameraSessionCreateInputSchema.parse(body);
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO camera_capture_sessions (id, seller_account_id, batch_id, source, camera_model, device_profile, metadata_json, status, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
  ).bind(
    sessionId,
    seller.id,
    parsed.batchId,
    parsed.source,
    parsed.deviceModel ?? null,
    parsed.profile ?? null,
    JSON.stringify(parsed.metadata ?? {}),
    now,
    now,
    now,
  ).run();

  if (parsed.batchId) {
    await c.env.DB.prepare(
      "UPDATE upload_batches SET capture_source = ?, capture_session_id = ?, capture_device_model = ?, capture_profile = ?, updated_at = ? WHERE id = ? AND seller_account_id = ?",
    ).bind(
      parsed.source,
      sessionId,
      parsed.deviceModel ?? null,
      parsed.profile ?? null,
      now,
      parsed.batchId,
      seller.id,
    ).run();
  }

  return c.json(CameraSessionSchema.parse({
    sessionId,
    source: parsed.source,
    batchId: parsed.batchId ?? null,
    startedAt: now,
    status: "active",
    deviceModel: parsed.deviceModel ?? null,
    profile: parsed.profile ?? null,
  }));
});

app.post("/api/uploads/init", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const body = await c.req.json().catch(() => ({}));
  const batchId = stringOr(body.batchId, "");
  const fileName = stringOr(body.fileName, "upload.jpg");
  const contentType = stringOr(body.contentType, "image/jpeg");
  const sizeBytes = optionalNumber(body.sizeBytes);
  const batch = await c.env.DB.prepare(
    "SELECT id FROM upload_batches WHERE id = ? AND seller_account_id = ?",
  ).bind(batchId, seller.id).first<{ id: string }>();
  if (!batch) return c.json({ error: "Upload batch not found." }, 404);
  const photoCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM batch_photos WHERE batch_id = ?",
  ).bind(batchId).first<{ count: number }>();
  if ((photoCount?.count ?? 0) >= MAX_BATCH_PHOTOS) {
    return c.json({ error: `A product can contain at most ${MAX_BATCH_PHOTOS} photos.` }, 413);
  }
  if (!contentType.startsWith("image/")) return c.json({ error: "Only image uploads are supported." }, 415);
  if (sizeBytes !== null && sizeBytes > MAX_UPLOAD_BYTES) {
    return c.json({ error: "That image is too large. Use an image under 12 MB." }, 413);
  }
  const visionContextResult = body.visionContext == null
    ? { success: true as const, data: null }
    : VisionFrameContextSchema.safeParse(body.visionContext);
  if (!visionContextResult.success) {
    return c.json({ error: "Invalid on-device vision context." }, 400);
  }
  const visionContextJson = visionContextResult.data ? JSON.stringify(visionContextResult.data) : null;
  const objectKey = `${batchId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const photoId = crypto.randomUUID();
  const uploadToken = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO batch_photos (id, batch_id, object_key, file_name, content_type, size_bytes, vision_context_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(photoId, batchId, objectKey, fileName, contentType, sizeBytes, visionContextJson, now).run();
  await c.env.DB.prepare(
    "UPDATE upload_batches SET status = 'uploading', updated_at = ? WHERE id = ?",
  ).bind(now, batchId).run();
  await c.env.SESSION_KV.put(`upload:${uploadToken}`, JSON.stringify({ objectKey, photoId, batchId }), {
    expirationTtl: 60 * 60,
  });
  return c.json(
    UploadInitResponseSchema.parse({
      photoId,
      objectKey,
      uploadUrl: `${new URL(c.req.url).origin}/api/uploads/object/${encodeURIComponent(objectKey)}?token=${uploadToken}`,
      uploadHeaders: {
        "Content-Type": contentType,
      },
    }),
  );
});

app.put("/api/uploads/object/:objectKey", async (c) => {
  const token = c.req.query("token") ?? "";
  const uploadState = await c.env.SESSION_KV.get(`upload:${token}`, "json") as { objectKey: string; photoId: string; batchId: string } | null;
  if (!uploadState || uploadState.objectKey !== c.req.param("objectKey")) {
    return c.json({ error: "Upload token is invalid or expired." }, 401);
  }
  const body = await c.req.arrayBuffer();
  if (!body.byteLength) {
    return c.json({ error: "Upload body is empty." }, 400);
  }
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "That image is too large. Use an image under 12 MB." }, 413);
  }
  await c.env.UPLOADS_BUCKET.put(uploadState.objectKey, body, {
    httpMetadata: {
      contentType: c.req.header("Content-Type") ?? "image/jpeg",
    },
  });
  await c.env.SESSION_KV.delete(`upload:${token}`);
  return c.json({ ok: true, objectKey: uploadState.objectKey });
});

app.get("/api/public/photos/:photoId", async (c) => {
  const photo = await c.env.DB.prepare(
    "SELECT id, object_key, content_type FROM batch_photos WHERE id = ?",
  ).bind(c.req.param("photoId")).first<{ id: string; object_key: string; content_type: string | null }>();
  if (!photo) {
    return c.json({ error: "Photo not found." }, 404);
  }
  const object = await c.env.UPLOADS_BUCKET.get(photo.object_key);
  if (!object?.body) {
    return c.json({ error: "Photo asset is missing." }, 404);
  }
  return new Response(object.body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": object.httpMetadata?.contentType ?? photo.content_type ?? "image/jpeg",
    },
  });
});

app.post("/api/drafts/jobs", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const body = await c.req.json().catch(() => ({}));
  const batchId = stringOr(body.batchId, "");
  const pricingStrategy = PricingStrategySchema.parse(body.pricingStrategy ?? "balanced");
  let autoPublish = body.autoPublish !== false;
  if (autoPublish) {
    try {
      await assertCanAutoPublish(c.env, seller.id);
    } catch (error) {
      if (error instanceof BillingBlockedError) {
        autoPublish = false;
      } else {
        throw error;
      }
    }
  }
  const batch = await c.env.DB.prepare(
    "SELECT id, marketplace_id, capture_profile FROM upload_batches WHERE id = ? AND seller_account_id = ?",
  ).bind(batchId, seller.id).first<{ id: string; marketplace_id: string; capture_profile: string | null }>();
  if (!batch) {
    return c.json({ error: "Upload batch not found." }, 404);
  }
  await c.env.DB.prepare(
    "UPDATE upload_batches SET pricing_strategy = ?, status = 'queued', updated_at = ? WHERE id = ?",
  ).bind(pricingStrategy, new Date().toISOString(), batchId).run();
  const jobIds = await createSingleProductDraftJobs(c.env, {
    id: batchId,
    seller_account_id: seller.id,
    marketplace_id: batch.marketplace_id,
    pricing_strategy: pricingStrategy,
    capture_profile: batch.capture_profile,
  });
  if (autoPublish) {
    await Promise.all(jobIds.map((jobId) => c.env.SESSION_KV.put(
      `auto-publish:${jobId}`,
      JSON.stringify({ strategy: pricingStrategy }),
      { expirationTtl: 6 * 60 * 60 },
    )));
  }
  return c.json({
    ok: true,
    batchId,
    marketplaceId: batch.marketplace_id,
    pricingStrategy,
    autoPublish,
    jobIds,
    status: "queued",
  });
});

app.get("/api/drafts/jobs", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const batchId = c.req.query("batchId") ?? "";
  const rows = await c.env.DB.prepare(
    "SELECT id, batch_id, draft_id, marketplace_id, cluster_label, pricing_strategy, listing_mode, status, error_message, created_at, updated_at FROM draft_jobs WHERE batch_id = ? AND seller_account_id = ? ORDER BY created_at ASC",
  ).bind(batchId, seller.id).all<DraftJobRecord>();
  for (const row of rows.results ?? []) {
    maybeKickStaleDraftJob(c, row);
  }
  return c.json((rows.results ?? []).map((row) => DraftJobSchema.parse({
    id: row.id,
    batchId: row.batch_id,
    draftId: row.draft_id,
    marketplaceId: row.marketplace_id,
    clusterLabel: row.cluster_label,
    pricingStrategy: row.pricing_strategy,
    listingMode: row.listing_mode ? ListingModeSchema.parse(row.listing_mode) : null,
    status: DraftJobStatusSchema.parse(row.status),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
});

app.get("/api/drafts/jobs/:jobId", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const row = await c.env.DB.prepare(
    "SELECT id, batch_id, draft_id, marketplace_id, cluster_label, pricing_strategy, listing_mode, status, error_message, created_at, updated_at FROM draft_jobs WHERE id = ? AND seller_account_id = ?",
  ).bind(c.req.param("jobId"), seller.id).first<DraftJobRecord>();
  if (!row) {
    return c.json({ error: "Draft job not found." }, 404);
  }
  maybeKickStaleDraftJob(c, row);
  return c.json(DraftJobSchema.parse({
    id: row.id,
    batchId: row.batch_id,
    draftId: row.draft_id,
    marketplaceId: row.marketplace_id,
    clusterLabel: row.cluster_label,
    pricingStrategy: row.pricing_strategy,
    listingMode: row.listing_mode ? ListingModeSchema.parse(row.listing_mode) : null,
    status: DraftJobStatusSchema.parse(row.status),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

app.get("/api/drafts/:draftId", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const row = await c.env.DB.prepare(
    "SELECT id, batch_id, marketplace_id, status, listing_mode, payload_json FROM drafts WHERE id = ? AND seller_account_id = ?",
  ).bind(c.req.param("draftId"), seller.id).first<DraftRecord>();
  if (!row) {
    return c.json({ error: "Draft not found." }, 404);
  }
  const draft = await hydrateDraftPhotos(c.env, DraftPayloadSchema.parse(JSON.parse(row.payload_json)));
  return c.json(await enrichPublishErrorBlockers(c.env, seller.id, draft));
});

app.patch("/api/drafts/:draftId", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const row = await c.env.DB.prepare(
    "SELECT id, payload_json FROM drafts WHERE id = ? AND seller_account_id = ?",
  ).bind(c.req.param("draftId"), seller.id).first<DraftRecord>();
  if (!row) {
    return c.json({ error: "Draft not found." }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  const draft = DraftPayloadSchema.parse(JSON.parse(row.payload_json));
  const categoryInput = stringOr(body.category, null);
  const manualPrice = optionalNumber(body.manualPrice);
  const manualPriceOverride = manualPrice && manualPrice > 0
    ? {
      price: roundMoney(manualPrice),
      strategy: body.manualPriceStrategy ? PricingStrategySchema.parse(body.manualPriceStrategy) : draft.pricing.recommendedStrategy,
      source: "seller" as const,
      updatedAt: new Date().toISOString(),
    }
    : body.clearManualPrice === true
      ? null
      : draft.manualPriceOverride;
  const leadPhotoId = typeof body.leadPhotoId === "string" && draft.photos.some((photo) => photo.id === body.leadPhotoId)
    ? body.leadPhotoId
    : draft.leadPhotoId;
  const validPhotoIds = new Set(draft.photos.map((photo) => photo.id));
  const requestedPhotoOrderIds = Array.isArray(body.photoOrderIds)
    ? body.photoOrderIds.filter((id: unknown): id is string => typeof id === "string" && validPhotoIds.has(id))
    : draft.photoOrderIds;
  const normalizedPhotoOrderIds = [
    ...requestedPhotoOrderIds,
    ...draft.photos.map((photo) => photo.id).filter((id) => !requestedPhotoOrderIds.includes(id)),
  ];
  const resolvedLeadPhotoId = normalizedPhotoOrderIds[0] ?? leadPhotoId;
  const confirmManualReview = Boolean(body.confirmManualReview === true && manualPriceOverride && draft.identity?.status === "verified");
  const blockers = confirmManualReview
    ? draft.blockers.filter((blocker) => blocker.title.toLowerCase().includes("comps") ? false : true)
    : draft.blockers;
  const nextStatus = blockers.length === 0 && draft.status !== "published" && draft.status !== "publishing"
    ? "ready"
    : draft.status;
  const updated = DraftPayloadSchema.parse({
    ...draft,
    status: nextStatus,
    leadPhotoId: resolvedLeadPhotoId,
    photoOrderIds: normalizedPhotoOrderIds,
    selectedTitle: stringOr(body.selectedTitle, draft.selectedTitle),
    description: stringOr(body.description, draft.description),
    condition: stringOr(body.condition, draft.condition),
    conditionNotes: stringOr(body.conditionNotes, draft.conditionNotes),
    listingMode: body.listingMode ? ListingModeSchema.parse(body.listingMode) : draft.listingMode,
    categoryGuess: categoryInput ? await suggestCategory(c.env, categoryInput, draft.marketplaceId) : draft.categoryGuess,
    itemSpecifics: Array.isArray(body.itemSpecifics) ? body.itemSpecifics : draft.itemSpecifics,
    manualPriceOverride,
    blockers,
  });
  await c.env.DB.prepare(
    "UPDATE drafts SET title = ?, listing_mode = ?, confidence = ?, payload_json = ?, updated_at = ? WHERE id = ?",
  ).bind(updated.selectedTitle, updated.listingMode, updated.confidence, JSON.stringify(updated), new Date().toISOString(), row.id).run();
  return c.json(await hydrateDraftPhotos(c.env, updated));
});

app.get("/api/seller/readiness", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const marketplaceId = c.req.query("marketplaceId") ?? c.env.EBAY_MARKETPLACE_ID ?? "EBAY_US";
  const accessToken = await getSellerAccessToken(c.env, seller);
  // Readiness is observational. A new seller may not be opted into business
  // policies yet, so unavailable policy collections should appear as blockers
  // instead of turning the dashboard into a server error.
  const policies = await getSellerPolicies(c.env, accessToken, marketplaceId, { tolerateFailures: true });
  const blockers = buildMarketplaceBlockers(seller.id, marketplaceId, policies);
  const payload = SellerReadinessSchema.parse({
    marketplaceId,
    sellerUsername: seller.seller_username,
    publishReady: blockers.length === 0,
    counts: {
      fulfillmentPolicies: policies.fulfillmentPolicies.length,
      paymentPolicies: policies.paymentPolicies.length,
      returnPolicies: policies.returnPolicies.length,
      inventoryLocations: policies.inventoryLocations.length,
    },
    blockers,
  });
  return c.json(payload);
});

app.get("/api/seller/blockers", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const draftId = c.req.query("draftId");
  const rows = draftId
    ? await c.env.DB.prepare(
      "SELECT id, type, status, title, description, payload_json FROM blockers WHERE draft_id = ? AND seller_account_id = ? ORDER BY created_at ASC",
    ).bind(draftId, seller.id).all<{
      id: string;
      type: string;
      status: string;
      title: string;
      description: string;
      payload_json: string;
    }>()
    : { results: [] };
  return c.json((rows.results ?? []).map((row) => BlockerSchema.parse({
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description,
    payload: JSON.parse(row.payload_json),
  })));
});

app.post("/api/seller/blockers/:blockerId/resolve", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const blocker = await c.env.DB.prepare(
    "SELECT id, draft_id, type, payload_json FROM blockers WHERE id = ? AND seller_account_id = ?",
  ).bind(c.req.param("blockerId"), seller.id).first<{ id: string; draft_id: string; type: string; payload_json: string }>();
  if (!blocker) {
    return c.json({ error: "Blocker not found." }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  const payload = blockerPayload(blocker);
  if (blocker.type === "missing_fulfillment_policy" || blocker.type === "missing_payment_policy" || blocker.type === "missing_return_policy") {
    const marketplaceId = stringOr(body.marketplaceId, stringOr(payload.marketplaceId, c.env.EBAY_MARKETPLACE_ID ?? "EBAY_US"));
    await ensureSellerDefaults(c.env, seller, marketplaceId);
  } else if (blocker.type === "missing_inventory_location") {
    await ensureInventoryLocation(c.env, seller, body);
  } else if (blocker.type === "missing_required_aspects") {
    await applyDraftResolutionValues(c.env, blocker.draft_id, body.values ?? {});
  }
  await c.env.DB.prepare(
    "UPDATE blockers SET status = 'resolved', updated_at = ? WHERE id = ?",
  ).bind(new Date().toISOString(), blocker.id).run();
  return c.json({ ok: true });
});

app.post("/api/listings/:draftId/verify", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const draftId = c.req.param("draftId");
  if (!draftId) {
    return c.json({ error: "Draft ID is required." }, 400);
  }
  const draft = await loadDraft(c.env, draftId, seller.id);
  if (!draft) {
    return c.json({ error: "Draft not found." }, 404);
  }
  const preparedDraft = await prepareDraftForVerification(c.env, seller, draft);
  const blockers = await verifyDraft(c.env, seller, preparedDraft);
  await replaceDraftBlockers(c.env, seller.id, draft.draftId, blockers);
  const status = blockers.length === 0 ? "ready" : blockers.some((item) => item.type === "low_confidence_product_match") ? "needs_input" : "blocked";
  const updatedDraft = DraftPayloadSchema.parse({
    ...preparedDraft,
    status,
    blockers,
  });
  await saveDraftPayload(c.env, updatedDraft, seller.id);
  return c.json(updatedDraft);
});

app.post("/api/listings/:draftId/publish", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const draftId = c.req.param("draftId");
  if (!draftId) {
    return c.json({ error: "Draft ID is required." }, 400);
  }
  const draft = await loadDraft(c.env, draftId, seller.id);
  if (!draft) {
    return c.json({ error: "Draft not found." }, 404);
  }
  const body = PublishRequestSchema.parse(await c.req.json().catch(() => ({})));
  const preparedDraft = await prepareDraftForVerification(c.env, seller, draft);
  const setupBlockers = await prepareSellerForPublish(c.env, seller, preparedDraft);
  const blockers = setupBlockers.length > 0 ? setupBlockers : await verifyDraft(c.env, seller, preparedDraft);
  if (blockers.length > 0) {
    await replaceDraftBlockers(c.env, seller.id, preparedDraft.draftId, blockers);
    return c.json({ error: "Draft is blocked from publishing.", blockers }, 409);
  }
  const queued = await queuePublishAttempt(c.env, seller, preparedDraft, body);
  return c.json(queued);
});

// One-press bulk publish: queue every publish-ready draft for this seller.
// Each draft still runs the full verify -> publish -> blocker pipeline
// individually, so failures surface per listing without stopping the rest.
app.post("/api/listings/publish-all", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const billing = await getBillingSummary(c.env, seller.id);
  if (!billing.featureAccess.canUseBulkQueue) {
    return c.json({ error: "Bulk publishing requires a plan with bulk queue access." }, 403);
  }
  const rows = await c.env.DB.prepare(
    "SELECT id, payload_json FROM drafts WHERE seller_account_id = ? AND status = 'ready' ORDER BY updated_at ASC LIMIT 25",
  ).bind(seller.id).all<{ id: string; payload_json: string }>();
  const queued: { draftId: string; attemptId: string }[] = [];
  const skipped: { draftId: string; reason: string }[] = [];
  for (const row of rows.results ?? []) {
    const draft = DraftPayloadSchema.parse(JSON.parse(row.payload_json));
    const preparedDraft = await prepareDraftForVerification(c.env, seller, draft);
    if (preparedDraft.blockers.length > 0) {
      skipped.push({ draftId: draft.draftId, reason: "Draft has unresolved blockers." });
      continue;
    }
    const setupBlockers = await prepareSellerForPublish(c.env, seller, preparedDraft);
    const blockers = setupBlockers.length > 0 ? setupBlockers : await verifyDraft(c.env, seller, preparedDraft);
    if (blockers.length > 0) {
      await replaceDraftBlockers(c.env, seller.id, preparedDraft.draftId, blockers);
      skipped.push({ draftId: draft.draftId, reason: "Draft failed publish verification." });
      continue;
    }
    const result = await queuePublishAttempt(c.env, seller, preparedDraft, {
      strategy: preparedDraft.pricing.recommendedStrategy,
    });
    queued.push({ draftId: draft.draftId, attemptId: result.attemptId });
  }
  return c.json({ queuedCount: queued.length, skippedCount: skipped.length, queued, skipped });
});

app.get("/api/listings/:draftId", requireSession, async (c) => {
  const seller = c.get("seller")!;
  const row = await c.env.DB.prepare(
    "SELECT id, status, adapter, ebay_listing_id, ebay_offer_id, response_json FROM publish_attempts WHERE draft_id = ? AND seller_account_id = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(c.req.param("draftId"), seller.id).first<{
    id: string;
    status: string;
    adapter: string;
    ebay_listing_id: string | null;
    ebay_offer_id: string | null;
    response_json: string | null;
  }>();
  if (!row) {
    return c.json({ error: "No publish attempts found." }, 404);
  }
  const response = row.response_json ? JSON.parse(row.response_json) : {};
  const failedDraft = row.status === "failed" ? await loadDraft(c.env, c.req.param("draftId")!, seller.id) : null;
  const derivedFailure = row.status === "failed"
    ? friendlyPublishError(stringOr(response?.error, "Listing publish failed."), failedDraft)
    : null;
  const friendlyError = stringOr(response?.friendlyError, null) ?? derivedFailure?.message ?? null;
  const fixHint = stringOr(response?.fixHint, null) ?? derivedFailure?.fixHint ?? null;
  return c.json(PublishResultSchema.parse({
    attemptId: row.id,
    draftId: c.req.param("draftId"),
    status: row.status,
    adapter: row.adapter,
    ebayListingId: row.ebay_listing_id,
    ebayOfferId: row.ebay_offer_id,
    buyerFacingUrl: typeof response?.listing?.listingUrl === "string" ? response.listing.listingUrl : null,
    message: row.status === "published"
      ? "Listing published successfully."
      : row.status === "failed"
        ? friendlyError ?? "Listing publish failed."
        : row.status === "canceled"
          ? "Publish was canceled. The draft is editable again."
          : "Listing publish still in progress.",
    friendlyError,
    fixHint,
    ebayField: derivedFailure?.ebayField ?? null,
    requiredFields: derivedFailure?.requiredFields ?? [],
    fieldLabels: derivedFailure?.fieldLabels ?? {},
    fieldHints: derivedFailure?.fieldHints ?? {},
  }));
});

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return c.json({ error: "The request did not match the expected format." }, 400);
  }
  console.error("Unhandled Worker request error", error);
  return c.json({ error: "An unexpected server error occurred." }, 500);
});

export default {
  fetch: app.fetch,
  queue: async (batch: MessageBatch<QueueMessage>, env: Bindings) => {
    for (const message of batch.messages) {
      const context = await queueMessageContext(env, message.body);
      logWorkerItem("info", "queue.item.started", context, { messageType: message.body.type });
      try {
        if (message.body.type === "process_upload_batch") {
          await processUploadBatch(env, message.body.batchId);
        } else if (message.body.type === "generate_draft") {
          await processDraftJob(env, message.body.jobId);
        } else if (message.body.type === "publish_listing") {
          await processPublishAttempt(env, message.body.attemptId, message.body.draftId, message.body.strategy);
        }
        logWorkerItem("info", "queue.item.completed", context, { messageType: message.body.type });
        message.ack();
      } catch (error) {
        logWorkerItem("error", "queue.item.failed", context, {
          messageType: message.body.type,
          error: error instanceof Error ? error.message : "Unknown queue error.",
        });
        await markQueueMessageFailed(env, message.body, error);
        if (message.body.type === "publish_listing") {
          await env.DB.prepare(
            "UPDATE publish_attempts SET status = 'queued', updated_at = ? WHERE id = ? AND status = 'publishing'",
          ).bind(new Date().toISOString(), message.body.attemptId).run();
          message.retry();
        } else {
          message.ack();
        }
      }
    }
  },
};

function requireSession(c: Context<AppEnvironment>, next: Next) {
  if (!c.get("session") || !c.get("seller")) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  return next();
}

function isAllowedWebOrigin(origin: string, configuredOrigin?: string) {
  if (!origin) return false;
  try {
    const candidate = new URL(origin);
    const configured = configuredOrigin ? new URL(configuredOrigin) : null;
    if (configured && candidate.origin === configured.origin) return true;
    if (candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname)) return true;
    return candidate.protocol === "https:"
      && candidate.hostname.endsWith(".expo.app")
      && /^listingos(?:--[a-z0-9-]+)?\.expo\.app$/.test(candidate.hostname);
  } catch {
    return false;
  }
}

async function getBillingSummary(env: Bindings, sellerAccountId: string): Promise<BillingSummary> {
  const profile = await env.DB.prepare(
    "SELECT revenuecat_app_user_id, active_entitlement, active_entitlements_json, subscription_status, source, management_url, updated_at FROM billing_profiles WHERE seller_account_id = ?",
  ).bind(sellerAccountId).first<{
    revenuecat_app_user_id: string;
    active_entitlement: string;
    active_entitlements_json: string;
    subscription_status: string;
    source: string;
    management_url: string | null;
    updated_at: string;
  }>();
  const plan = BillingPlanSchema.catch("free").parse(profile?.active_entitlement ?? "free");
  const period = await getOrCreateUsagePeriod(env, sellerAccountId, plan);
  const activeJobCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM draft_jobs WHERE seller_account_id = ? AND status IN ('queued', 'processing')",
  ).bind(sellerAccountId).first<{ count: number }>();
  const activeJobs = activeJobCount?.count ?? 0;
  const maxActiveJobs = BILLING_PLANS[plan].maxActiveJobs;
  const remainingCredits = Math.max(0, period.included_credits + period.extra_credits - period.used_credits);
  const enforcementMode = billingEnforcementMode(env);
  const featureAccess = {
    canCreateDraft: enforcementMode === "observe" || (remainingCredits > 0 && activeJobs < maxActiveJobs),
    canAutoPublish: enforcementMode === "observe" || (plan !== "free" && BILLING_PLANS[plan].canAutoPublish),
    canUseBulkQueue: enforcementMode === "observe" || BILLING_PLANS[plan].canUseBulkQueue,
    canUseAdvancedCardChecks: enforcementMode === "observe" || BILLING_PLANS[plan].canUseAdvancedCardChecks,
    enforcementMode,
    blockingReason: enforcementMode === "enforce" && remainingCredits <= 0
      ? "You have used this month's AI listing credits."
      : enforcementMode === "enforce" && activeJobs >= maxActiveJobs
        ? "Your current plan is already processing its maximum number of listings."
        : null,
  };
  return BillingSummarySchema.parse({
    sellerAccountId,
    appUserId: profile?.revenuecat_app_user_id ?? revenueCatAppUserId(sellerAccountId),
    plan,
    activeEntitlements: parseJsonArray(profile?.active_entitlements_json),
    subscriptionStatus: profile?.subscription_status ?? "free",
    source: profile?.source ?? "fallback",
    usage: {
      periodStart: period.period_start,
      periodEnd: period.period_end,
      includedCredits: period.included_credits,
      extraCredits: period.extra_credits,
      usedCredits: period.used_credits,
      remainingCredits,
      activeJobs,
      maxActiveJobs,
    },
    featureAccess,
    managementUrl: profile?.management_url ?? null,
    updatedAt: profile?.updated_at ?? new Date().toISOString(),
  });
}

async function resolveClientBillingSync(
  env: Bindings,
  sellerAccountId: string,
  body: BillingSyncRequest,
): Promise<BillingSyncRequest> {
  const appUserId = revenueCatAppUserId(sellerAccountId);
  const enforcementMode = billingEnforcementMode(env);
  const existing = await loadBillingProfile(env, sellerAccountId);
  const secretApiKey = env.REVENUECAT_SECRET_API_KEY?.trim();

  if (secretApiKey) {
    try {
      const subscriber = await fetchRevenueCatSubscriber(appUserId, secretApiKey);
      const activeEntitlements = activeSubscriberEntitlements(subscriber);
      return {
        ...body,
        appUserId,
        source: "revenuecat_rest",
        activeEntitlements,
        subscriptionStatus: activeEntitlements.length > 0 ? "active" : "free",
        managementUrl: subscriberManagementUrl(subscriber) ?? body.managementUrl ?? null,
        customerInfo: subscriber,
      };
    } catch (error) {
      if (enforcementMode === "observe") {
        console.warn("RevenueCat REST sync failed; using SDK sync in observe mode", error);
        return { ...body, appUserId, source: "revenuecat_sdk" };
      }
      if (existing && isTrustedBillingSource(existing.source)) {
        return trustedExistingBillingSync(body, appUserId, existing, "revenuecat_rest_failed");
      }
      console.error("RevenueCat REST sync failed; falling back to free in enforce mode", error);
    }
  }

  if (enforcementMode === "enforce") {
    if (existing && isTrustedBillingSource(existing.source)) {
      return trustedExistingBillingSync(body, appUserId, existing, "missing_revenuecat_secret");
    }
    return {
      ...body,
      appUserId,
      source: "fallback",
      activeEntitlements: [],
      subscriptionStatus: "free",
      managementUrl: null,
      customerInfo: {
        client: body.customerInfo ?? null,
        ignoredReason: "server_verification_required",
      },
    };
  }

  return { ...body, appUserId, source: "revenuecat_sdk" };
}

async function loadBillingProfile(env: Bindings, sellerAccountId: string) {
  return env.DB.prepare(
    "SELECT revenuecat_app_user_id, active_entitlement, active_entitlements_json, subscription_status, source, management_url, customer_info_json FROM billing_profiles WHERE seller_account_id = ?",
  ).bind(sellerAccountId).first<{
    revenuecat_app_user_id: string;
    active_entitlement: string;
    active_entitlements_json: string;
    subscription_status: string;
    source: string;
    management_url: string | null;
    customer_info_json: string;
  }>();
}

function isTrustedBillingSource(source: string) {
  return source === "revenuecat_webhook" || source === "revenuecat_rest" || source === "manual";
}

function trustedExistingBillingSync(
  body: BillingSyncRequest,
  appUserId: string,
  existing: Awaited<ReturnType<typeof loadBillingProfile>>,
  preserveReason: string,
): BillingSyncRequest {
  return {
    ...body,
    appUserId,
    source: BillingSyncRequestSchema.shape.source.parse(existing?.source ?? "fallback"),
    activeEntitlements: parseJsonArray(existing?.active_entitlements_json),
    subscriptionStatus: existing?.subscription_status ?? "free",
    managementUrl: existing?.management_url ?? null,
    customerInfo: {
      client: body.customerInfo ?? null,
      preservedTrustedSource: existing?.source ?? null,
      preserveReason,
    },
  };
}

async function syncBillingProfile(env: Bindings, sellerAccountId: string, body: {
  appUserId: string;
  activeEntitlements: string[];
  subscriptionStatus: string;
  source: string;
  managementUrl?: string | null;
  customerInfo?: unknown;
}) {
  const now = new Date().toISOString();
  const activeEntitlements = Array.from(new Set(body.activeEntitlements.filter(Boolean)));
  const plan = entitlementPlan(activeEntitlements);
  await env.DB.prepare(
    `INSERT INTO billing_profiles (
      seller_account_id, revenuecat_app_user_id, active_entitlement, active_entitlements_json,
      subscription_status, source, customer_info_json, management_url, last_synced_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(seller_account_id) DO UPDATE SET
      revenuecat_app_user_id = excluded.revenuecat_app_user_id,
      active_entitlement = excluded.active_entitlement,
      active_entitlements_json = excluded.active_entitlements_json,
      subscription_status = excluded.subscription_status,
      source = excluded.source,
      customer_info_json = excluded.customer_info_json,
      management_url = excluded.management_url,
      last_synced_at = excluded.last_synced_at,
      updated_at = excluded.updated_at`,
  ).bind(
    sellerAccountId,
    body.appUserId,
    plan,
    JSON.stringify(activeEntitlements),
    body.subscriptionStatus || (plan === "free" ? "free" : "active"),
    body.source,
    JSON.stringify(body.customerInfo ?? {}),
    body.managementUrl ?? null,
    now,
    now,
    now,
  ).run();
  await getOrCreateUsagePeriod(env, sellerAccountId, plan);
}

async function assertCanStartDraft(env: Bindings, sellerAccountId: string) {
  const summary = await getBillingSummary(env, sellerAccountId);
  if (summary.featureAccess.enforcementMode === "observe" || summary.featureAccess.canCreateDraft) return summary;
  throw new BillingBlockedError(summary.featureAccess.blockingReason ?? "Upgrade to keep creating AI listings.", summary);
}

async function assertCanAutoPublish(env: Bindings, sellerAccountId: string) {
  const summary = await getBillingSummary(env, sellerAccountId);
  if (summary.featureAccess.enforcementMode === "observe" || summary.featureAccess.canAutoPublish) return summary;
  throw new BillingBlockedError("Autopublish requires an active paid plan.", summary);
}

async function chargeDraftCredit(env: Bindings, draft: DraftPayload, sellerAccountId: string) {
  const plan = (await getBillingSummary(env, sellerAccountId)).plan;
  const period = await getOrCreateUsagePeriod(env, sellerAccountId, plan);
  const idempotencyKey = `draft-credit:${draft.draftId}`;
  const now = new Date().toISOString();
  const cost = await env.DB.prepare(
    "SELECT COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd FROM ai_operation_events WHERE draft_id = ?",
  ).bind(draft.draftId).first<{ estimated_cost_usd: number }>();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO usage_events (
      id, seller_account_id, period_id, draft_id, batch_id, event_type, quantity, cost_estimate_usd, idempotency_key, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, 'ai_listing_credit', 1, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    sellerAccountId,
    period.id,
    draft.draftId,
    draft.batchId,
    Math.max(0, cost?.estimated_cost_usd ?? 0),
    idempotencyKey,
    JSON.stringify({ status: draft.status, confidence: draft.confidence, source: "draft_terminal_state" }),
    now,
  ).run();
  if ((inserted.meta.changes ?? 0) > 0) {
    await env.DB.prepare(
      "UPDATE usage_periods SET used_credits = used_credits + 1, updated_at = ? WHERE id = ?",
    ).bind(now, period.id).run();
  }
}

async function getOrCreateUsagePeriod(env: Bindings, sellerAccountId: string, plan: BillingPlan) {
  const nowDate = new Date();
  const periodStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString();
  const periodEnd = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 1)).toISOString();
  const existing = await env.DB.prepare(
    "SELECT id, seller_account_id, period_start, period_end, entitlement, included_credits, extra_credits, used_credits FROM usage_periods WHERE seller_account_id = ? AND period_start = ?",
  ).bind(sellerAccountId, periodStart).first<{
    id: string;
    seller_account_id: string;
    period_start: string;
    period_end: string;
    entitlement: string;
    included_credits: number;
    extra_credits: number;
    used_credits: number;
  }>();
  const includedCredits = BILLING_PLANS[plan].includedCredits;
  if (existing) {
    if (existing.entitlement !== plan || existing.included_credits !== includedCredits) {
      await env.DB.prepare(
        "UPDATE usage_periods SET entitlement = ?, included_credits = ?, updated_at = ? WHERE id = ?",
      ).bind(plan, includedCredits, new Date().toISOString(), existing.id).run();
      return { ...existing, entitlement: plan, included_credits: includedCredits };
    }
    return existing;
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO usage_periods (id, seller_account_id, period_start, period_end, entitlement, included_credits, extra_credits, used_credits, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
  ).bind(id, sellerAccountId, periodStart, periodEnd, plan, includedCredits, now, now).run();
  return {
    id,
    seller_account_id: sellerAccountId,
    period_start: periodStart,
    period_end: periodEnd,
    entitlement: plan,
    included_credits: includedCredits,
    extra_credits: 0,
    used_credits: 0,
  };
}

async function recordAppEvent(env: Bindings, sellerAccountId: string | null, eventType: string, payload: Record<string, unknown>) {
  await env.DB.prepare(
    "INSERT INTO app_events (id, seller_account_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), sellerAccountId, eventType, JSON.stringify(payload), new Date().toISOString()).run();
}

async function recordAiOperation(env: Bindings, context: AiOperationContext, input: {
  operation: string;
  model?: string | null;
  providerRequestId?: string | null;
  responsePayload?: Record<string, unknown> | null;
  latencyMs: number;
  imageCount?: number | null;
  imageDetail?: string | null;
  success: boolean;
  errorCode?: string | null;
  cacheHit?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const payload = input.responsePayload ?? {};
  const usage = asRecord(payload.usage);
  const inputDetails = asRecord(usage?.input_tokens_details);
  const outputDetails = asRecord(usage?.output_tokens_details);
  const model = input.model ?? stringOr(payload.model, null);
  const inputTokens = integerOrNull(usage?.input_tokens);
  const cachedInputTokens = integerOrNull(inputDetails?.cached_tokens);
  const outputTokens = integerOrNull(usage?.output_tokens);
  const reasoningTokens = integerOrNull(outputDetails?.reasoning_tokens);
  const estimatedCostUsd = estimateAiCost(env, model, inputTokens, cachedInputTokens, outputTokens);
  const providerRequestId = input.providerRequestId ?? stringOr(payload.id, null);
  await env.DB.prepare(
    `INSERT INTO ai_operation_events (
      id, seller_account_id, batch_id, job_id, draft_id, operation, provider, model,
      provider_request_id, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens,
      image_count, image_detail, latency_ms, cache_hit, success, error_code,
      estimated_cost_usd, pricing_version, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'openai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    context.sellerAccountId,
    context.batchId ?? null,
    context.jobId ?? null,
    context.draftId ?? null,
    input.operation,
    model,
    providerRequestId,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    input.imageCount ?? null,
    input.imageDetail ?? null,
    Math.max(0, Math.round(input.latencyMs)),
    input.cacheHit ? 1 : 0,
    input.success ? 1 : 0,
    input.errorCode ?? null,
    estimatedCostUsd,
    AI_PRICING_VERSION,
    JSON.stringify(input.metadata ?? {}),
    new Date().toISOString(),
  ).run();
}

function estimateAiCost(
  env: Bindings,
  model: string | null,
  inputTokens: number | null,
  cachedInputTokens: number | null,
  outputTokens: number | null,
) {
  const pricing = model ? AI_MODEL_PRICING[model] : null;
  const fallback = {
    input: numericEnv(env.AI_UNKNOWN_MODEL_INPUT_USD_PER_MILLION, 10),
    cachedInput: numericEnv(env.AI_UNKNOWN_MODEL_CACHED_INPUT_USD_PER_MILLION, 1),
    output: numericEnv(env.AI_UNKNOWN_MODEL_OUTPUT_USD_PER_MILLION, 60),
  };
  const rates = pricing ?? fallback;
  const totalInput = Math.max(0, inputTokens ?? 0);
  const cached = Math.min(totalInput, Math.max(0, cachedInputTokens ?? 0));
  const uncached = Math.max(0, totalInput - cached);
  return Number(((uncached * rates.input + cached * rates.cachedInput + Math.max(0, outputTokens ?? 0) * rates.output) / 1_000_000).toFixed(8));
}

function isInternalAnalyticsAuthorized(authorization: string | undefined, expectedToken: string | undefined) {
  if (!expectedToken?.trim() || !authorization?.startsWith("Bearer ")) return false;
  return authorization.slice("Bearer ".length).trim() === expectedToken.trim();
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * fraction) - 1));
  return values[index];
}

function entitlementPlan(activeEntitlements: string[]): BillingPlan {
  const normalized = new Set(activeEntitlements.map((item) => item.toLowerCase()));
  if (normalized.has("studio")) return "studio";
  if (normalized.has("pro")) return "pro";
  if (normalized.has("starter")) return "starter";
  return "free";
}

async function fetchRevenueCatSubscriber(appUserId: string, secretApiKey: string) {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${secretApiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REVENUECAT_REST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`RevenueCat subscriber lookup failed with ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function activeSubscriberEntitlements(response: Record<string, unknown>) {
  const subscriber = typeof response.subscriber === "object" && response.subscriber
    ? response.subscriber as Record<string, unknown>
    : {};
  const entitlements = typeof subscriber.entitlements === "object" && subscriber.entitlements
    ? subscriber.entitlements as Record<string, unknown>
    : {};
  const now = Date.now();
  return Object.entries(entitlements)
    .filter(([id, entitlement]) => {
      if (!["starter", "pro", "studio"].includes(id)) return false;
      if (typeof entitlement !== "object" || !entitlement) return false;
      const expiresDate = (entitlement as { expires_date?: unknown }).expires_date;
      if (expiresDate === null || typeof expiresDate === "undefined") return true;
      if (typeof expiresDate !== "string") return false;
      const expiry = Date.parse(expiresDate);
      return Number.isFinite(expiry) && expiry > now;
    })
    .map(([id]) => id);
}

function subscriberManagementUrl(response: Record<string, unknown>) {
  const subscriber = typeof response.subscriber === "object" && response.subscriber
    ? response.subscriber as Record<string, unknown>
    : {};
  return typeof subscriber.management_url === "string" ? subscriber.management_url : null;
}

function billingEnforcementMode(env: Bindings): "observe" | "enforce" {
  return env.BILLING_ENFORCEMENT_MODE === "enforce" ? "enforce" : "observe";
}

function revenueCatAppUserId(sellerAccountId: string) {
  return `seller:${sellerAccountId}`;
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

class BillingBlockedError extends Error {
  constructor(message: string, public readonly summary: BillingSummary) {
    super(message);
    this.name = "BillingBlockedError";
  }
}

async function loadQueueItem(env: Bindings, sellerAccountId: string, jobId: string) {
  const row = await env.DB.prepare(
    `SELECT
      j.id AS job_id,
      j.batch_id AS batch_id,
      j.draft_id AS draft_id,
      j.marketplace_id AS marketplace_id,
      j.cluster_label AS cluster_label,
      j.pricing_strategy AS pricing_strategy,
      j.listing_mode AS job_listing_mode,
      j.status AS job_status,
      j.error_message AS job_error_message,
      j.created_at AS job_created_at,
      j.updated_at AS job_updated_at,
      b.status AS batch_status,
      b.updated_at AS batch_updated_at,
      d.status AS draft_status,
      d.title AS draft_title,
      d.payload_json AS draft_payload_json,
      d.updated_at AS draft_updated_at,
      p.id AS publish_attempt_id,
      p.status AS publish_status,
      p.response_json AS publish_response_json,
      p.ebay_listing_id AS ebay_listing_id,
      p.updated_at AS publish_updated_at
    FROM draft_jobs j
    JOIN upload_batches b ON b.id = j.batch_id
    LEFT JOIN drafts d ON d.id = j.draft_id
    LEFT JOIN publish_attempts p ON p.id = (
      SELECT pa.id FROM publish_attempts pa
      WHERE pa.draft_id = j.draft_id AND pa.seller_account_id = j.seller_account_id
      ORDER BY pa.created_at DESC LIMIT 1
    )
    WHERE j.id = ? AND j.seller_account_id = ?`,
  ).bind(jobId, sellerAccountId).first<QueueRow>();
  return row ? buildQueueItem(env, row) : null;
}

function buildQueueItem(env: Bindings, row: QueueRow) {
  let draft: DraftPayload | null = null;
  if (row.draft_payload_json) {
    draft = DraftPayloadSchema.parse(JSON.parse(row.draft_payload_json));
  }
  const publishStatus = row.publish_status;
  const rawDraftStatus = draft?.status ?? row.draft_status;
  const publishResponse = parsePublishResponse(row.publish_response_json);
  const publishError = publishResponse.error
    ? publishResponse.fixHint ? `${publishResponse.error} ${publishResponse.fixHint}` : publishResponse.error
    : null;
  const buyerFacingUrl = stringOr(publishResponse.listing?.listingUrl, null)
    ?? (row.ebay_listing_id ? `https://www.ebay.com/itm/${row.ebay_listing_id}` : null);
  const status = publishStatus === "published"
    ? "published"
    : publishStatus === "publishing" || publishStatus === "queued"
      ? "publishing"
      : publishStatus === "failed"
        ? "failed"
        : publishStatus === "canceled"
          ? "canceled"
          : rawDraftStatus === "published"
            ? "published"
            : rawDraftStatus === "publishing"
              ? "publishing"
              : rawDraftStatus === "ready" || rawDraftStatus === "needs_input" || rawDraftStatus === "blocked"
                ? "ready_for_review"
                : row.job_status === "failed"
                  ? "failed"
                  : row.job_status === "canceled" || row.batch_status === "canceled"
                    ? "canceled"
                    : row.job_status === "queued"
                      ? "queued"
                      : "processing";
  const thumbnailId = draft?.photoOrderIds[0] ?? draft?.leadPhotoId ?? draft?.photos[0]?.id ?? null;
  const statusLabel = queueStatusLabel(status, rawDraftStatus);
  return QueueItemSchema.parse({
    id: row.job_id,
    batchId: row.batch_id,
    jobId: row.job_id,
    draftId: row.draft_id,
    title: draft?.selectedTitle ?? row.draft_title ?? row.cluster_label ?? "Product in progress",
    subtitle: queueSubtitle(status, row, draft),
    status,
    statusLabel,
    progress: queueProgress(status),
    thumbnailUrl: thumbnailId ? `${getPublicApiBaseUrl(env)}/api/public/photos/${encodeURIComponent(thumbnailId)}` : null,
    errorMessage: publishError ?? row.job_error_message,
    buyerFacingUrl,
    updatedAt: row.publish_updated_at ?? row.draft_updated_at ?? row.job_updated_at ?? row.batch_updated_at,
    canOpen: Boolean(row.draft_id),
    canCancel: status === "queued" || status === "processing" || status === "publishing",
    canRetry: status === "failed",
  });
}

function queueStatusLabel(status: string, draftStatus?: string | null) {
  if (status === "ready_for_review") return draftStatus === "ready" ? "Ready for Review" : "Needs Review";
  if (status === "queued") return "Draft";
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function queueSubtitle(status: string, row: QueueRow, draft: DraftPayload | null) {
  if (status === "published") return "Live on eBay.";
  if (status === "publishing") return "Publishing in the background. You can start the next item.";
  if (status === "ready_for_review") {
    if (draft?.blockers.length) return `${draft.blockers.length} detail${draft.blockers.length === 1 ? "" : "s"} need confirmation.`;
    return "Draft is ready to edit, verify, or list.";
  }
  if (status === "failed") return row.job_error_message ?? "This step failed. Retry without starting over.";
  if (status === "canceled") return "Canceled. Open the draft if you want to edit and resubmit.";
  if (status === "queued") return "Queued for AI listing generation.";
  return "AI is identifying, pricing, and preparing the listing.";
}

function queueProgress(status: string) {
  if (status === "published" || status === "failed" || status === "canceled") return 1;
  if (status === "ready_for_review") return 0.92;
  if (status === "publishing") return 0.78;
  if (status === "processing") return 0.52;
  return 0.22;
}

function parsePublishResponse(value: string | null) {
  const parsed = value ? asRecord(safeJsonParse(value)) : null;
  const listing = asRecord(parsed?.listing);
  return {
    error: stringOr(parsed?.friendlyError, null) ?? stringOr(parsed?.error, null),
    fixHint: stringOr(parsed?.fixHint, null),
    listing,
  };
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseVisionContext(value: string | null | undefined) {
  if (!value) return null;
  const parsed = VisionFrameContextSchema.safeParse(safeJsonParse(value));
  return parsed.success ? parsed.data : null;
}

function maybeKickStaleDraftJob(c: Context<AppEnvironment>, row: DraftJobRecord) {
  const staleForMs = Date.now() - Date.parse(row.updated_at || row.created_at);
  if (!Number.isFinite(staleForMs)) return;
  if (row.status === "queued" && staleForMs >= 15_000) {
    c.executionCtx.waitUntil(processDraftJob(c.env, row.id));
    return;
  }
  if (row.status === "processing" && !row.draft_id && staleForMs >= 120_000) {
    c.executionCtx.waitUntil(retryStaleDraftJob(c.env, row.id, row.updated_at));
  }
}

async function retryStaleDraftJob(env: Bindings, jobId: string, previousUpdatedAt: string) {
  await env.DB.prepare(
    "UPDATE draft_jobs SET status = 'queued', error_message = NULL, updated_at = ? WHERE id = ? AND status = 'processing' AND draft_id IS NULL AND updated_at = ?",
  ).bind(new Date().toISOString(), jobId, previousUpdatedAt).run();
  await processDraftJob(env, jobId);
}

async function processUploadBatch(env: Bindings, batchId: string) {
  const batch = await env.DB.prepare(
    "SELECT id, seller_account_id, marketplace_id, pricing_strategy, capture_profile FROM upload_batches WHERE id = ?",
  ).bind(batchId).first<{
    id: string;
    seller_account_id: string;
    marketplace_id: string;
    pricing_strategy: PricingStrategy;
    capture_profile: string | null;
  }>();
  if (!batch) return;
  await createSingleProductDraftJobs(env, batch);
}

async function createSingleProductDraftJobs(
  env: Bindings,
  batch: {
    id: string;
    seller_account_id: string;
    marketplace_id: string;
    pricing_strategy: PricingStrategy;
    capture_profile: string | null;
  },
) {
  const existingRows = await env.DB.prepare(
    "SELECT id FROM draft_jobs WHERE batch_id = ? AND seller_account_id = ? ORDER BY created_at ASC",
  ).bind(batch.id, batch.seller_account_id).all<{ id: string }>();
  const existingJobIds = (existingRows.results ?? []).map((row) => row.id);
  if (existingJobIds.length > 0) {
    return existingJobIds;
  }

  await env.DB.prepare("UPDATE upload_batches SET status = 'processing', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), batch.id).run();
  const photosResult = await env.DB.prepare(
    "SELECT id, batch_id, object_key, file_name, content_type, size_bytes, vision_context_json FROM batch_photos WHERE batch_id = ? ORDER BY created_at ASC",
  ).bind(batch.id).all<BatchPhotoRecord>();
  const photos = photosResult.results ?? [];
  if (photos.length === 0) {
    await env.DB.prepare("UPDATE upload_batches SET status = 'failed', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), batch.id).run();
    throw new Error("No photos were uploaded for this batch.");
  }
  // A capture session may cover several distinct products. Partition the
  // photos by physical item (single group when the model is unsure or the
  // batch is small) and run one draft job per product through the existing
  // queue pipeline.
  const partitionInputs = await Promise.all(photos.map(async (photo) => {
    const object = await env.UPLOADS_BUCKET.get(photo.object_key);
    if (!object) throw new Error(`Missing R2 object for ${photo.object_key}`);
    const buffer = await object.arrayBuffer();
    return {
      id: photo.id,
      dataUrl: `data:${photo.content_type};base64,${base64FromArrayBuffer(buffer)}`,
    };
  }));
  const groups = batch.capture_profile === "phone_camera_single_product_v1"
    ? [{ label: "Product 1", photoIds: photos.map((photo) => photo.id) }]
    : await partitionPhotosIntoProducts(env, partitionInputs);
  const now = new Date().toISOString();
  const jobs = groups.map((group, index) => ({
    jobId: crypto.randomUUID(),
    label: group.label || `Product ${index + 1}`,
    photoIds: group.photoIds,
  }));
  const fingerprintedJobs = await Promise.all(jobs.map(async (job) => ({
    ...job,
    inputFingerprint: await fingerprintPhotoIds(job.photoIds),
  })));
  const existingFingerprintRows = await env.DB.prepare(
    "SELECT id, input_fingerprint FROM draft_jobs WHERE seller_account_id = ? AND input_fingerprint IS NOT NULL AND status NOT IN ('failed', 'canceled') ORDER BY created_at DESC LIMIT 200",
  ).bind(batch.seller_account_id).all<{ id: string; input_fingerprint: string | null }>();
  const existingByFingerprint = new Map(
    (existingFingerprintRows.results ?? [])
      .filter((row): row is { id: string; input_fingerprint: string } => Boolean(row.input_fingerprint))
      .map((row) => [row.input_fingerprint, row.id]),
  );
  const jobsToCreate = fingerprintedJobs.filter((job) => !existingByFingerprint.has(job.inputFingerprint));
  await env.DB.batch([
    ...jobsToCreate.flatMap((job) => [
      env.DB.prepare(
        "INSERT INTO draft_jobs (id, batch_id, seller_account_id, marketplace_id, cluster_label, pricing_strategy, listing_mode, status, input_fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 'queued', ?, ?, ?)",
      ).bind(job.jobId, batch.id, batch.seller_account_id, batch.marketplace_id, job.label, batch.pricing_strategy, job.inputFingerprint, now, now),
      ...job.photoIds.map((photoId) => env.DB.prepare(
        "INSERT INTO draft_job_photos (job_id, photo_id, created_at) VALUES (?, ?, ?)",
      ).bind(job.jobId, photoId, now)),
    ]),
    env.DB.prepare("UPDATE upload_batches SET status = 'queued', updated_at = ? WHERE id = ?")
      .bind(now, batch.id),
  ]);
  for (const job of jobsToCreate) {
    await env.GENERATE_DRAFT_QUEUE.send({
      type: "generate_draft",
      jobId: job.jobId,
    });
  }
  return fingerprintedJobs.map((job) => existingByFingerprint.get(job.inputFingerprint) ?? job.jobId);
}

async function fingerprintPhotoIds(photoIds: string[]) {
  const normalized = [...photoIds].sort().join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function markQueueMessageFailed(env: Bindings, message: QueueMessage, error: unknown) {
  const now = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (message.type === "process_upload_batch") {
    await env.DB.prepare(
      "UPDATE upload_batches SET status = 'failed', updated_at = ? WHERE id = ?",
    ).bind(now, message.batchId).run();
    return;
  }
  if (message.type === "generate_draft") {
    const job = await env.DB.prepare(
      "SELECT batch_id FROM draft_jobs WHERE id = ?",
    ).bind(message.jobId).first<{ batch_id: string }>();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE draft_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
      ).bind(errorMessage.slice(0, 500), now, message.jobId),
      ...(job?.batch_id ? [
        env.DB.prepare(
          "UPDATE upload_batches SET status = 'failed', updated_at = ? WHERE id = ?",
        ).bind(now, job.batch_id),
      ] : []),
    ]);
  }
}

async function processDraftJob(env: Bindings, jobId: string) {
  const job = await env.DB.prepare(
    "SELECT id, batch_id, seller_account_id, marketplace_id, pricing_strategy FROM draft_jobs WHERE id = ?",
  ).bind(jobId).first<{ id: string; batch_id: string; seller_account_id: string; marketplace_id: string; pricing_strategy: PricingStrategy }>();
  if (!job) return;
  const claim = await env.DB.prepare("UPDATE draft_jobs SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'queued'")
    .bind(new Date().toISOString(), jobId).run();
  if ((claim.meta.changes ?? 0) === 0) {
    return;
  }
  const photoRows = await env.DB.prepare(
    "SELECT p.id, p.object_key, p.file_name, p.content_type, p.size_bytes, p.vision_context_json, p.batch_id FROM batch_photos p JOIN draft_job_photos j ON j.photo_id = p.id WHERE j.job_id = ? ORDER BY p.created_at ASC",
  ).bind(jobId).all<BatchPhotoRecord>();
  const photos = photoRows.results ?? [];
  const imageInputs = await Promise.all(photos.slice(0, DRAFT_IMAGE_LIMIT).map(async (photo) => {
    const object = await env.UPLOADS_BUCKET.get(photo.object_key);
    if (!object) {
      throw new Error(`Missing R2 object for ${photo.object_key}`);
    }
    const buffer = await object.arrayBuffer();
    return {
      id: photo.id,
      objectKey: photo.object_key,
      dataUrl: `data:${photo.content_type};base64,${base64FromArrayBuffer(buffer)}`,
      visionContext: parseVisionContext(photo.vision_context_json),
    };
  }));
  const operationContext: AiOperationContext = {
    sellerAccountId: job.seller_account_id,
    batchId: job.batch_id,
    jobId,
  };
  const aiDraft = await createListingDraft(env, imageInputs, job.marketplace_id, job.pricing_strategy, operationContext);
  const identity = await resolveProductIdentity(env, aiDraft, imageInputs, job.marketplace_id, operationContext);
  const draftSearchQuery = identity.searchQuery || aiDraft.searchQuery || aiDraft.titleOptions[0]?.title || aiDraft.categoryGuessText || "product";
  const [categoryResult, marketResult] = await Promise.allSettled([
    suggestBestCategory(env, {
      categoryText: aiDraft.categoryGuessText,
      searchQuery: aiDraft.searchQuery,
      title: aiDraft.titleOptions[0]?.title ?? "",
      marketplaceId: job.marketplace_id,
    }),
    searchMarketComparables(env, {
      identity,
      image: imageInputs[0] ?? null,
      marketplaceId: job.marketplace_id,
      queries: [
        draftSearchQuery,
        aiDraft.searchQuery,
        aiDraft.titleOptions[0]?.title ?? "",
        aiDraft.categoryGuessText,
      ],
    }),
  ]);
  const categoryGuess = categoryResult.status === "fulfilled"
    ? categoryResult.value
    : fallbackCategoryGuess(aiDraft.categoryGuessText);
  const market = marketResult.status === "fulfilled"
    ? marketResult.value
    : {
      accepted: [],
      rejected: [],
      evidence: PricingEvidenceSchema.parse({
        source: "ai_fallback",
        confidence: 0.1,
        exactMatchCount: 0,
        rejectedCount: 0,
        notes: ["Market lookup timed out or failed; price falls back to AI estimate and needs review."],
      }),
    };
  const cardNeedsConfirmation = identity.vertical !== "general" && (identity.status !== "verified" || market.evidence.exactMatchCount < 2);
  const comparables = cardNeedsConfirmation && identity.vertical !== "general" ? [] : market.accepted;
  const pricing = cardNeedsConfirmation && identity.vertical !== "general"
    ? buildCardNeedsReviewPricing(job.pricing_strategy)
    : buildPricingSuggestions(comparables, aiDraft.suggestedPriceFloor, job.pricing_strategy, aiDraft.listingModeRecommendation);
  const pricingEvidence = cardNeedsConfirmation && identity.vertical !== "general"
    ? PricingEvidenceSchema.parse({
      ...market.evidence,
      confidence: Math.min(market.evidence.confidence, 0.24),
      notes: [
        ...market.evidence.notes,
        "Pricing is locked until exact graded-card identity and sufficient matching comps are verified.",
      ],
    })
    : market.evidence;
  const draftStatus = aiDraft.confidence < 0.65 || cardNeedsConfirmation ? "needs_input" : "ready";
  const draftId = crypto.randomUUID();
  const identityWarnings = identity.warnings.length > 0 ? identity.warnings : [];
  const missingInfo = Array.from(new Set([
    ...aiDraft.missingInfo,
    ...(cardNeedsConfirmation ? ["Confirm exact card identity and price comps before publishing."] : []),
    ...identityWarnings,
  ]));
  const payload = DraftPayloadSchema.parse({
    draftId,
    batchId: job.batch_id,
    marketplaceId: job.marketplace_id,
    status: draftStatus,
    listingMode: aiDraft.listingModeRecommendation,
    photos: photos.map((photo) => ({
      id: photo.id,
      fileName: photo.file_name,
      url: `${getPublicApiBaseUrl(env)}/api/public/photos/${encodeURIComponent(photo.id)}`,
    })),
    leadPhotoId: photos[0]?.id ?? null,
    photoOrderIds: photos.map((photo) => photo.id),
    titleOptions: identity.canonicalTitle
      ? [
        { title: identity.canonicalTitle, rationale: `Built from ${identity.source.replaceAll("_", " ")} identity data.` },
        ...aiDraft.titleOptions.filter((option) => option.title !== identity.canonicalTitle),
      ].slice(0, 3)
      : aiDraft.titleOptions,
    selectedTitle: identity.canonicalTitle ?? aiDraft.titleOptions[0]?.title ?? "Untitled Listing",
    searchQuery: draftSearchQuery,
    categoryGuess,
    condition: aiDraft.condition,
    conditionNotes: aiDraft.conditionNotes,
    description: aiDraft.description,
    confidence: Math.min(aiDraft.confidence, identity.vertical === "general" ? aiDraft.confidence : identity.confidence),
    itemSpecifics: mergeIdentitySpecifics(aiDraft.itemSpecifics, identity),
    photoChecklist: aiDraft.photoChecklist,
    missingInfo,
    enhancementPlan: aiDraft.enhancementPlan,
    identity,
    pricing,
    pricingEvidence,
    listingStrategies: pricing.options.map((option) => ({
      strategy: option.strategy,
      listingMode: option.strategy === "fast_sale" && aiDraft.allowAuction ? "auction" : aiDraft.listingModeRecommendation,
      rationale: option.rationale,
      expectedSpeedBand: option.speedBand,
    })),
    comparables: [...comparables, ...market.rejected.slice(0, 8)],
    blockers: draftStatus === "needs_input" ? [createBlocker({
      draftId,
      sellerAccountId: job.seller_account_id,
      type: identity.vertical === "general" ? "low_confidence_product_match" : "missing_required_aspects",
      title: identity.vertical === "general" ? "AI needs a quick product confirmation" : "Card identity or comps need confirmation",
      description: identity.vertical === "general"
        ? "The model is not confident enough to publish without a fast review."
        : "Trading cards require exact set, card number, grader, grade, and matching comps before price can be trusted.",
      payload: {
        suggestedTitles: aiDraft.titleOptions,
        identity,
        pricingEvidence,
      },
    })] : [],
  });
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO drafts (id, seller_account_id, batch_id, marketplace_id, status, listing_mode, title, confidence, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      draftId,
      job.seller_account_id,
      job.batch_id,
      job.marketplace_id,
      payload.status,
      payload.listingMode,
      payload.selectedTitle,
      payload.confidence,
      JSON.stringify(payload),
      now,
      now,
    ),
    env.DB.prepare(
      "UPDATE draft_jobs SET draft_id = ?, listing_mode = ?, status = ?, updated_at = ? WHERE id = ?",
    ).bind(draftId, payload.listingMode, payload.status === "ready" ? "ready" : "needs_input", now, jobId),
    env.DB.prepare(
      "UPDATE upload_batches SET status = 'partial_ready', updated_at = ? WHERE id = ?",
    ).bind(now, job.batch_id),
  ]);
  await env.DB.prepare(
    "UPDATE ai_operation_events SET draft_id = ? WHERE job_id = ? AND draft_id IS NULL",
  ).bind(draftId, jobId).run().catch((error) => {
    logWorkerItem("warn", "analytics.draft_link.failed", { batchId: job.batch_id, jobId, draftId }, {
      error: error instanceof Error ? error.message : "Unknown analytics link error.",
    });
  });
  await replaceDraftBlockers(env, job.seller_account_id, draftId, payload.blockers);
  await chargeDraftCredit(env, payload, job.seller_account_id);
  await maybeAutoPublishDraft(env, jobId, job.seller_account_id, payload);
}

async function processPublishAttempt(env: Bindings, attemptId: string, draftId: string, strategy: PricingStrategy) {
  const attempt = await env.DB.prepare(
    "SELECT id, draft_id, seller_account_id, payload_json, status FROM publish_attempts WHERE id = ?",
  ).bind(attemptId).first<{ id: string; draft_id: string; seller_account_id: string; payload_json: string; status: string }>();
  const seller = await env.DB.prepare(
    "SELECT id, user_id, seller_username, ebay_user_id, access_token_cipher, refresh_token_cipher, access_token_expires_at FROM seller_accounts WHERE id = ?",
  ).bind(attempt?.seller_account_id ?? "").first<SellerAccountRecord>();
  if (!attempt || !seller) return;
  if (attempt.status === "published") return;
  const claim = await env.DB.prepare(
    "UPDATE publish_attempts SET status = 'publishing', updated_at = ? WHERE id = ? AND status = 'queued'",
  ).bind(new Date().toISOString(), attemptId).run();
  if ((claim.meta.changes ?? 0) === 0) return;
  logWorkerItem("info", "publish.attempt.started", { attemptId, draftId }, { strategy });
  try {
    const request = PublishRequestSchema.parse(JSON.parse(attempt.payload_json));
    const draft = await loadDraft(env, draftId, seller.id);
    if (!draft) {
      await failPublishAttempt(env, attemptId, draftId, seller.id, "Draft disappeared before publish could complete.");
      return;
    }
    const resolvedDraft = DraftPayloadSchema.parse({
      ...draft,
      selectedTitle: request.selectedTitle ?? draft.selectedTitle,
      listingMode: request.listingMode ?? draft.listingMode,
    });
    if (resolvedDraft.selectedTitle !== draft.selectedTitle || resolvedDraft.listingMode !== draft.listingMode) {
      await saveDraftPayload(env, resolvedDraft, seller.id);
    }
    const accessToken = await getSellerAccessToken(env, seller);
    const defaults = await ensureSellerDefaults(env, seller, resolvedDraft.marketplaceId);
    const publishPayload = await buildInventoryOfferPayload(env, seller, resolvedDraft, request.strategy ?? strategy, defaults, accessToken);
    const publishResponse = await publishInventoryOffer(env, accessToken, resolvedDraft.marketplaceId, publishPayload);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE publish_attempts SET status = ?, ebay_listing_id = ?, ebay_offer_id = ?, response_json = ?, updated_at = ? WHERE id = ?",
    ).bind(
      publishResponse.ok ? "published" : "failed",
      publishResponse.listingId,
      publishResponse.offerId,
      JSON.stringify(publishResponse.body),
      now,
      attemptId,
    ).run();
    await saveDraftPayload(env, DraftPayloadSchema.parse({
      ...resolvedDraft,
      status: publishResponse.ok ? "published" : "failed",
    }), seller.id);
    logWorkerItem(publishResponse.ok ? "info" : "error", "publish.attempt.completed", { attemptId, draftId, batchId: resolvedDraft.batchId }, {
      status: publishResponse.ok ? "published" : "failed",
      ebayListingId: publishResponse.listingId,
      ebayOfferId: publishResponse.offerId,
    });
    if (publishResponse.ok) {
      await recordPublishOutcome(env, {
        message: request.autoRepairAttempted ? request.autoRepairNote ?? "repaired publish" : null,
        categoryId: resolvedDraft.categoryGuess.categoryId,
        vertical: resolvedDraft.identity?.vertical ?? "general",
        repairKind: request.autoRepairAttempted ? "deterministic" : "none",
        success: true,
      });
      await notifySellerDevices(env, seller.id, {
        title: "Published to eBay",
        body: `${resolvedDraft.selectedTitle} is live.`,
        data: {
          type: "published",
          draftId,
          listingId: publishResponse.listingId,
          url: publishResponse.listingId ? `https://www.ebay.com/itm/${publishResponse.listingId}` : null,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publish error.";
    logWorkerItem("error", "publish.attempt.failed", { attemptId, draftId }, { error: simplifyEbayError(message) });
    const request = PublishRequestSchema.parse(JSON.parse(attempt.payload_json));
    const draft = await loadDraft(env, draftId, seller.id);
    await recordPublishOutcome(env, {
      message,
      categoryId: draft?.categoryGuess.categoryId ?? null,
      vertical: draft?.identity?.vertical ?? "general",
      repairKind: request.autoRepairAttempted ? "deterministic" : "none",
      success: false,
    });
    if (draft && await retryAfterDeterministicRepair(env, seller, attemptId, draft, request, message)) {
      return;
    }
    await failPublishAttempt(env, attemptId, draftId, seller.id, message);
  }
}

async function failPublishAttempt(env: Bindings, attemptId: string, draftId: string, sellerAccountId: string, message: string) {
  const now = new Date().toISOString();
  const draft = await loadDraft(env, draftId, sellerAccountId);
  const friendlyError = friendlyPublishError(message, draft);
  await env.DB.prepare(
    "UPDATE publish_attempts SET status = 'failed', response_json = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'publishing')",
  ).bind(JSON.stringify({
    error: message,
    friendlyError: friendlyError.message,
    fixHint: friendlyError.fixHint,
  }), now, attemptId).run();
  if (draft && draft.status !== "published") {
    const failureBlocker = createBlocker({
      draftId,
      sellerAccountId,
      type: friendlyError.blockerType,
      title: friendlyError.title,
      description: `${friendlyError.message} ${friendlyError.fixHint}`,
      payload: {
        source: "ebay_publish_error",
        rawError: message,
        ebayField: friendlyError.ebayField,
        fieldLabels: friendlyError.fieldLabels,
        fieldHints: friendlyError.fieldHints,
        explanation: friendlyError.message,
        requiredFields: friendlyError.requiredFields,
        suggestedCondition: friendlyError.suggestedCondition,
      },
    });
    await saveDraftPayload(env, DraftPayloadSchema.parse({
      ...draft,
      status: "failed",
      blockers: [
        failureBlocker,
        ...draft.blockers.filter((blocker) => blocker.title !== failureBlocker.title),
      ],
    }), sellerAccountId);
    await replaceDraftBlockers(env, sellerAccountId, draftId, [
      failureBlocker,
      ...draft.blockers.filter((blocker) => blocker.title !== failureBlocker.title),
    ]);
  }
  await notifySellerDevices(env, sellerAccountId, {
    title: "Listing needs a quick fix",
    body: `${friendlyError.title}: ${friendlyError.message}`,
    data: {
      type: "failed",
      draftId,
      attemptId,
      error: friendlyError.title,
    },
  });
}

async function retryAfterDeterministicRepair(
  env: Bindings,
  seller: SellerAccountRecord,
  attemptId: string,
  draft: DraftPayload,
  request: PublishRequest,
  message: string,
) {
  if (request.autoRepairAttempted) return false;
  const repair = deterministicPublishRepair(message, draft);
  if (!repair) return false;
  const repairedDraft = DraftPayloadSchema.parse({
    ...repair.draft,
    status: "publishing",
    blockers: repair.draft.blockers.filter((blocker) => blocker.payload.source !== "ebay_publish_error"),
  });
  const repairedRequest = PublishRequestSchema.parse({
    ...request,
    autoRepairAttempted: true,
    autoRepairNote: repair.note,
  });
  const now = new Date().toISOString();
  await Promise.all([
    saveDraftPayload(env, repairedDraft, seller.id),
    env.DB.prepare(
      "UPDATE publish_attempts SET status = 'queued', payload_json = ?, response_json = ?, updated_at = ? WHERE id = ? AND seller_account_id = ? AND status = 'publishing'",
    ).bind(
      JSON.stringify(repairedRequest),
      JSON.stringify({
        autoRepair: true,
        note: repair.note,
        previousError: simplifyEbayError(message),
      }),
      now,
      attemptId,
      seller.id,
    ).run(),
  ]);
  await env.PUBLISH_LISTING_QUEUE.send({
    type: "publish_listing",
    draftId: draft.draftId,
    attemptId,
    strategy: repairedRequest.strategy,
  });
  return true;
}

async function prepareDraftForVerification(env: Bindings, seller: SellerAccountRecord, draft: DraftPayload) {
  const refreshedDraft = await refreshExistingGradedCardEvidence(env, draft).catch((error) => {
    logWorkerItem("warn", "card.evidence_refresh.failed", { draftId: draft.draftId, batchId: draft.batchId }, {
      error: error instanceof Error ? error.message : "Unknown card evidence refresh error.",
    });
    return draft;
  });
  const repair = deterministicPublishRepair("BrandMPN required aspect validation", refreshedDraft);
  if (!repair) {
    if (refreshedDraft !== draft) await saveDraftPayload(env, refreshedDraft, seller.id);
    return refreshedDraft;
  }
  const repairedDraft = DraftPayloadSchema.parse({
    ...repair.draft,
    blockers: repair.draft.blockers.filter((blocker) => blocker.payload.source !== "ebay_publish_error"),
  });
  await saveDraftPayload(env, repairedDraft, seller.id);
  return repairedDraft;
}

async function refreshExistingGradedCardEvidence(env: Bindings, draft: DraftPayload) {
  const identity = draft.identity;
  if (
    identity?.vertical !== "graded_card"
    || identity.fields.grader !== "PSA"
    || !identity.fields.certNumber
    || (identity.source === "psa_cert" && identity.status === "verified" && (draft.pricingEvidence?.exactMatchCount ?? 0) >= 2)
  ) {
    return draft;
  }
  const psa = await lookupPsaCert(env, identity.fields.certNumber);
  if (!psa?.fields) return draft;
  const fields = normalizeCardFields({ ...identity.fields, ...definedCardFields(psa.fields) });
  const canonicalTitle = buildCardCanonicalTitle(fields) ?? draft.selectedTitle;
  const verifiedIdentity = ProductIdentitySchema.parse({
    ...identity,
    source: "psa_cert",
    confidence: 0.98,
    status: "verified",
    canonicalTitle,
    searchQuery: buildCardSearchQuery(fields, canonicalTitle),
    fields,
    warnings: identityWarnings(fields),
  });
  const market = await searchMarketComparables(env, {
    identity: verifiedIdentity,
    image: null,
    marketplaceId: draft.marketplaceId,
    queries: [verifiedIdentity.searchQuery ?? canonicalTitle, canonicalTitle, draft.searchQuery],
  });
  const enoughEvidence = market.evidence.exactMatchCount >= 2;
  const pricing = enoughEvidence
    ? buildPricingSuggestions(market.accepted, null, draft.pricing.recommendedStrategy, draft.listingMode)
    : buildCardNeedsReviewPricing(draft.pricing.recommendedStrategy);
  const pricingEvidence = enoughEvidence
    ? market.evidence
    : PricingEvidenceSchema.parse({
      ...market.evidence,
      confidence: Math.min(market.evidence.confidence, 0.24),
      notes: [...market.evidence.notes, "Pricing remains locked until at least two exact graded-card matches are verified."],
    });
  logWorkerItem("info", "card.evidence_refreshed", { draftId: draft.draftId, batchId: draft.batchId }, {
    certNumber: fields.certNumber,
    exactMatchCount: market.evidence.exactMatchCount,
    pricingUnlocked: enoughEvidence,
  });
  return DraftPayloadSchema.parse({
    ...draft,
    status: enoughEvidence ? "ready" : "needs_input",
    selectedTitle: canonicalTitle,
    searchQuery: verifiedIdentity.searchQuery,
    titleOptions: [
      { title: canonicalTitle, rationale: "Verified against the PSA certification record." },
      ...draft.titleOptions.filter((option) => option.title !== canonicalTitle),
    ].slice(0, 3),
    identity: verifiedIdentity,
    itemSpecifics: mergeIdentitySpecifics(draft.itemSpecifics, verifiedIdentity),
    pricing,
    pricingEvidence,
    comparables: [...market.accepted, ...market.rejected.slice(0, 8)],
    missingInfo: draft.missingInfo.filter((item) => !/card identity|certification|grade|matching comps/i.test(item)),
    blockers: draft.blockers.filter((blocker) => blocker.title !== "Card identity or comps need confirmation" && blocker.title !== "A buyer-facing price is required"),
  });
}

function deterministicPublishRepair(message: string, draft: DraftPayload) {
  const lower = message.toLowerCase();
  const brandMpnRejected = lower.includes("brandmpn") || (lower.includes("brand") && lower.includes("mpn") && lower.includes("missing"));
  const isEbayUsMarketplace = draft.marketplaceId === "EBAY_US";
  const isCard = draft.identity?.vertical === "trading_card" || draft.identity?.vertical === "graded_card";
  const hasUnavailableIdentifierEvidence = [...draft.itemSpecifics.map((item) => `${item.name} ${item.value}`), ...draft.missingInfo]
    .some((value) => /\bunbranded\b|does not apply|no visible brand|no manufacturer part number|no mpn/i.test(value));
  if (brandMpnRejected && isEbayUsMarketplace && !isCard && hasUnavailableIdentifierEvidence) {
    let itemSpecifics = [...draft.itemSpecifics];
    itemSpecifics = upsertSpecific(itemSpecifics, "Brand", specificValue(draft, "Brand") || "Unbranded");
    itemSpecifics = upsertSpecific(itemSpecifics, "MPN", specificValue(draft, "MPN") || "Does not apply");
    return {
      note: "Auto-repaired eBay US's BrandMPN requirement with the marketplace-safe Unbranded and Does not apply values supported by the AI evidence.",
      draft: DraftPayloadSchema.parse({
        ...draft,
        itemSpecifics,
      }),
    };
  }
  const isTradingCardCategory = draft.categoryGuess.categoryId === "183454" || draft.identity?.vertical === "trading_card" || draft.identity?.vertical === "graded_card";
  const conditionRejected = lower.includes("condition") && (lower.includes("category 183454") || lower.includes("trading card") || lower.includes("card"));
  if (!isTradingCardCategory || !conditionRejected) return null;

  const graded = draft.identity?.vertical === "graded_card" || specificValue(draft, "Graded").toLowerCase() === "yes";
  let itemSpecifics = [...draft.itemSpecifics];
  itemSpecifics = upsertSpecific(itemSpecifics, "Graded", graded ? "Yes" : "No");
  if (graded) {
    // Only repair with grading facts we actually have. Fabricating a
    // grader or grade here would publish false claims about the card.
    const grader = draft.identity?.fields.grader || specificValue(draft, "Professional Grader");
    if (grader) itemSpecifics = upsertSpecific(itemSpecifics, "Professional Grader", grader);
    const grade = draft.identity?.fields.grade || specificValue(draft, "Grade");
    if (grade) itemSpecifics = upsertSpecific(itemSpecifics, "Grade", grade);
    const certNumber = draft.identity?.fields.certNumber || specificValue(draft, "Certification Number");
    if (certNumber) itemSpecifics = upsertSpecific(itemSpecifics, "Certification Number", certNumber);
  }

  return {
    note: graded
      ? "Auto-repaired eBay's graded-card condition rule with graded-card descriptors."
      : "Auto-repaired eBay's trading-card condition rule by switching to New.",
    draft: DraftPayloadSchema.parse({
      ...draft,
      condition: graded ? "LIKE_NEW" : "NEW",
      conditionNotes: graded
        ? "Professionally graded card. ListingOS set eBay's supported graded-card condition descriptors from the slab details."
        : "Trading card condition normalized to eBay's supported category condition.",
      itemSpecifics,
    }),
  };
}

function upsertSpecific(items: DraftPayload["itemSpecifics"], name: string, value: string) {
  const normalized = name.toLowerCase();
  const trimmed = value.trim();
  if (!trimmed) return items;
  const next = [...items];
  const index = next.findIndex((item) => item.name.toLowerCase() === normalized);
  if (index >= 0) {
    next[index] = { ...next[index], value: trimmed };
  } else {
    next.push({ name, value: trimmed });
  }
  return next;
}

async function notifySellerDevices(env: Bindings, sellerAccountId: string, notification: {
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  const rows = await env.DB.prepare(
    "SELECT token FROM device_push_tokens WHERE seller_account_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 20",
  ).bind(sellerAccountId).all<{ token: string }>();
  const tokens = Array.from(new Set((rows.results ?? []).map((row) => row.token).filter(Boolean)));
  if (tokens.length === 0) {
    return {
      tokenCount: 0,
      sentCount: 0,
      inactiveCount: 0,
      expoAccepted: false,
    };
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    channelId: "publishing",
    priority: "high",
    title: notification.title,
    body: notification.body.slice(0, 180),
    data: notification.data,
  }));
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;

  const response = await fetchWithTimeout("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  }, 8_000, "Expo push notification").catch(() => null);
  if (!response?.ok) {
    return {
      tokenCount: tokens.length,
      sentCount: 0,
      inactiveCount: 0,
      expoAccepted: false,
    };
  }

  const payload = asRecord(await response.json().catch(() => ({})));
  const results = Array.isArray(payload?.data) ? payload.data.map((item) => asRecord(item)) : [];
  const now = new Date().toISOString();
  let inactiveCount = 0;
  let sentCount = 0;
  await Promise.all(tokens.map(async (token, index) => {
    const result = results[index];
    const details = asRecord(result?.details);
    if (stringOr(result?.status, "") === "ok") sentCount += 1;
    const deviceUnregistered = stringOr(details?.error, "") === "DeviceNotRegistered";
    if (deviceUnregistered) inactiveCount += 1;
    await env.DB.prepare(
      "UPDATE device_push_tokens SET status = ?, last_notified_at = ?, updated_at = ? WHERE token = ?",
    ).bind(deviceUnregistered ? "inactive" : "active", now, now, token).run();
  }));
  return {
    tokenCount: tokens.length,
    sentCount,
    inactiveCount,
    expoAccepted: true,
  };
}

function friendlyPublishError(message: string, draft: DraftPayload | null) {
  const lower = message.toLowerCase();
  const validationFields = extractEbayValidationFields(message);
  if (validationFields.some((field) => field.toLowerCase() === "brandmpn")) {
    return {
      title: "eBay needs the item's brand and MPN",
      message: "BrandMPN is eBay's container for two separate values: Brand and MPN (manufacturer part number). It is not a price, SKU, or card grade; eBay uses the pair to match the item to the right catalog and search filters.",
      fixHint: "Enter Brand and MPN exactly as printed on the item or packaging. If the item genuinely has no brand or MPN, use the marketplace-supported unavailable values; for eBay US, those are Unbranded and Does not apply. ListingOS can apply that low-risk fallback automatically when the AI evidence says the item is unbranded.",
      blockerType: "missing_required_aspects" as BlockerType,
      suggestedCondition: null,
      ebayField: "BrandMPN",
      requiredFields: ["Brand", "MPN"],
      fieldLabels: {
        Brand: "Brand",
        MPN: "MPN (manufacturer part number)",
      },
      fieldHints: {
        Brand: "Use the printed brand. Use Unbranded only when no brand is present.",
        MPN: "Use the printed manufacturer part number. For eBay US, use Does not apply only when none exists.",
      },
    };
  }
  if (lower.includes("condition information") && lower.includes("category 183454")) {
    const graded = draft?.identity?.vertical === "graded_card" || draft?.itemSpecifics.some((item) =>
      item.name.toLowerCase() === "graded" && item.value.toLowerCase() === "yes"
    );
    return {
      title: "eBay needs the graded-card condition",
      message: graded
        ? "eBay requires graded cards in this category to use the graded-card condition descriptors, not a generic used condition."
        : "eBay rejected the condition for this trading-card category.",
      fixHint: graded
        ? "ListingOS will use Like New with the PSA grader, grade, and certification descriptors. Recheck requirements, then retry publish."
        : "Choose the eBay-supported card condition, recheck requirements, then retry publish.",
      blockerType: "missing_required_aspects" as BlockerType,
      suggestedCondition: graded ? "LIKE_NEW" : null,
      ebayField: null,
      requiredFields: [],
      fieldLabels: {},
      fieldHints: {},
    };
  }
  if (lower.includes("required") && lower.includes("aspect")) {
    return {
      title: "eBay needs a required item detail",
      message: "eBay requires one more item specific before this listing can go live.",
      fixHint: "Open the draft, fill the required detail shown by eBay, then retry publish.",
      blockerType: "missing_required_aspects" as BlockerType,
      suggestedCondition: null,
      ebayField: validationFields[0] ?? null,
      requiredFields: validationFields,
      fieldLabels: Object.fromEntries(validationFields.map((field) => [field, humanizeEbayAspect(field)])),
      fieldHints: Object.fromEntries(validationFields.map((field) => [field, "Use the value printed on the item or packaging. Do not guess." ])),
    };
  }
  if (lower.includes("policy")) {
    return {
      title: "eBay needs a seller policy",
      message: "eBay rejected the publish because a seller policy is missing or invalid.",
      fixHint: "Open the blocker, let ListingOS create or repair the seller policy, then retry publish.",
      blockerType: "missing_marketplace_setting" as BlockerType,
      suggestedCondition: null,
      ebayField: null,
      requiredFields: [],
      fieldLabels: {},
      fieldHints: {},
    };
  }
  return {
    title: "eBay rejected the listing",
    message: "eBay returned a publish rule that needs review before retrying.",
    fixHint: simplifyEbayError(message),
    blockerType: "missing_marketplace_setting" as BlockerType,
    suggestedCondition: null,
    ebayField: validationFields[0] ?? null,
    requiredFields: validationFields,
    fieldLabels: Object.fromEntries(validationFields.map((field) => [field, humanizeEbayAspect(field)])),
    fieldHints: Object.fromEntries(validationFields.map((field) => [field, "Use the value printed on the item or packaging. Do not guess." ])),
  };
}

function extractEbayValidationFields(message: string) {
  const fields = Array.from(message.matchAll(/<([^>]+)>/g), (match) => match[1]?.trim()).filter(
    (field): field is string => Boolean(field && /^[A-Za-z][A-Za-z0-9 _/-]{1,80}$/.test(field)),
  );
  return Array.from(new Set(fields));
}

function humanizeEbayAspect(field: string) {
  if (field.toLowerCase() === "brandmpn") return "Brand / MPN (manufacturer part number)";
  return field
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/[_-]+/g, " ")
    .replace(/\bmpn\b/i, "MPN")
    .replace(/\bsku\b/i, "SKU")
    .replace(/\bupc\b/i, "UPC");
}

function simplifyEbayError(message: string) {
  const parsed = message.match(/"message":"([^"]+)"/)?.[1]?.replaceAll("\\\"", "\"");
  return parsed || message.replace(/^eBay seller API failed for\s+/i, "").slice(0, 280);
}

async function maybeAutoPublishDraft(env: Bindings, jobId: string, sellerAccountId: string, draft: DraftPayload) {
  const autoPublishState = await env.SESSION_KV.get(`auto-publish:${jobId}`, "json") as { strategy?: PricingStrategy } | null;
  if (!autoPublishState) return;
  await env.SESSION_KV.delete(`auto-publish:${jobId}`);

  const eligibility = autoPublishEligibility(draft);
  if (!eligibility.eligible) return;

  const seller = await env.DB.prepare(
    "SELECT id, user_id, seller_username, ebay_user_id, access_token_cipher, refresh_token_cipher, access_token_expires_at FROM seller_accounts WHERE id = ?",
  ).bind(sellerAccountId).first<SellerAccountRecord>();
  if (!seller) return;

  const setupBlockers = await prepareSellerForPublish(env, seller, draft);
  const blockers = setupBlockers.length > 0 ? setupBlockers : await verifyDraft(env, seller, draft);
  if (blockers.length > 0) {
    await replaceDraftBlockers(env, seller.id, draft.draftId, blockers);
    const blockedDraft = DraftPayloadSchema.parse({
      ...draft,
      status: blockers.some((item) => item.type === "low_confidence_product_match") ? "needs_input" : "blocked",
      blockers,
    });
    await Promise.all([
      saveDraftPayload(env, blockedDraft, seller.id),
      env.DB.prepare("UPDATE draft_jobs SET status = ?, updated_at = ? WHERE draft_id = ? AND seller_account_id = ?")
        .bind(blockedDraft.status, new Date().toISOString(), draft.draftId, seller.id).run(),
    ]);
    await notifySellerDevices(env, seller.id, {
      title: "Listing ready for review",
      body: `${draft.selectedTitle} needs ${blockers.length} quick check${blockers.length === 1 ? "" : "s"} before posting.`,
      data: {
        type: "needs_review",
        draftId: draft.draftId,
      },
    });
    return;
  }

  await queuePublishAttempt(env, seller, draft, {
    strategy: autoPublishState.strategy ?? draft.pricing.recommendedStrategy,
    selectedTitle: draft.selectedTitle,
    listingMode: draft.listingMode,
  });
}

function autoPublishEligibility(draft: DraftPayload) {
  const evidence = draft.pricingEvidence;
  const exactMatches = evidence?.exactMatchCount ?? 0;
  const evidenceConfidence = evidence?.confidence ?? 0;
  const hasRealPrice = draft.pricing.rangeMedian > 0 && draft.pricing.options.every((option) => option.price > 0);
  const card = draft.identity?.vertical && draft.identity.vertical !== "general";
  const cardSafe = !card || (
    draft.identity?.status === "verified"
    && exactMatches >= 2
    && evidenceConfidence >= 0.62
  );
  const generalSafe = card || (
    draft.confidence >= 0.84
    && exactMatches >= 3
    && evidenceConfidence >= 0.55
  );
  const eligible = draft.status === "ready"
    && draft.blockers.length === 0
    && draft.listingMode === "fixed_price"
    && Boolean(draft.categoryGuess.categoryId)
    && draft.photos.length > 0
    && draft.selectedTitle.trim().length >= 12
    && hasRealPrice
    && evidence?.source !== "ai_fallback"
    && cardSafe
    && generalSafe;
  return { eligible };
}

async function queuePublishAttempt(
  env: Bindings,
  seller: SellerAccountRecord,
  draft: DraftPayload,
  request: { strategy: PricingStrategy; selectedTitle?: string; listingMode?: DraftPayload["listingMode"] },
) {
  const existingAttempt = await env.DB.prepare(
    "SELECT id, status, adapter, ebay_listing_id, ebay_offer_id, response_json, updated_at FROM publish_attempts WHERE draft_id = ? AND seller_account_id = ? AND status IN ('queued', 'publishing', 'published') ORDER BY created_at DESC LIMIT 1",
  ).bind(draft.draftId, seller.id).first<{
    id: string;
    status: "queued" | "publishing" | "published";
    adapter: string;
    ebay_listing_id: string | null;
    ebay_offer_id: string | null;
    response_json: string | null;
    updated_at: string;
  }>();
  const existingAttemptIsStale = existingAttempt?.status === "publishing"
    && Date.now() - Date.parse(existingAttempt.updated_at) > STALE_PUBLISH_ATTEMPT_MS;
  if (existingAttemptIsStale) {
    await failPublishAttempt(env, existingAttempt.id, draft.draftId, seller.id, "Publish attempt timed out before eBay returned a result.");
  } else if (existingAttempt) {
    if (existingAttempt.status === "queued") {
      await saveDraftPayload(env, DraftPayloadSchema.parse({
        ...draft,
        status: "publishing",
      }), seller.id);
      await env.PUBLISH_LISTING_QUEUE.send({
        type: "publish_listing",
        draftId: draft.draftId,
        attemptId: existingAttempt.id,
        strategy: request.strategy,
      });
    }
    const existingResponse = existingAttempt.response_json ? JSON.parse(existingAttempt.response_json) : {};
    return PublishResultSchema.parse({
      attemptId: existingAttempt.id,
      draftId: draft.draftId,
      status: existingAttempt.status,
      adapter: existingAttempt.adapter,
      ebayListingId: existingAttempt.ebay_listing_id,
      ebayOfferId: existingAttempt.ebay_offer_id,
      buyerFacingUrl: typeof existingResponse?.listing?.listingUrl === "string" ? existingResponse.listing.listingUrl : null,
      message: existingAttempt.status === "published"
        ? "Listing published successfully."
        : "An existing publish attempt is still in progress.",
    });
  }

  const attemptId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO publish_attempts (id, draft_id, seller_account_id, adapter, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)",
  ).bind(
    attemptId,
    draft.draftId,
    seller.id,
    "inventory_offer",
    JSON.stringify(PublishRequestSchema.parse(request)),
    now,
    now,
  ).run();
  await saveDraftPayload(env, DraftPayloadSchema.parse({
    ...draft,
    status: "publishing",
  }), seller.id);
  await env.PUBLISH_LISTING_QUEUE.send({
    type: "publish_listing",
    draftId: draft.draftId,
    attemptId,
    strategy: request.strategy,
  });
  return PublishResultSchema.parse({
    attemptId,
    draftId: draft.draftId,
    status: "queued",
    adapter: "inventory_offer",
    ebayListingId: null,
    ebayOfferId: null,
    buyerFacingUrl: null,
    message: "Publish queued. Poll the draft or listing details for the final result.",
  });
}

async function loadDraft(env: Bindings, draftId: string, sellerAccountId: string) {
  const row = await env.DB.prepare(
    "SELECT payload_json FROM drafts WHERE id = ? AND seller_account_id = ?",
  ).bind(draftId, sellerAccountId).first<{ payload_json: string }>();
  return row ? hydrateDraftPhotos(env, DraftPayloadSchema.parse(JSON.parse(row.payload_json))) : null;
}

async function saveDraftPayload(env: Bindings, draft: DraftPayload, sellerAccountId: string) {
  await env.DB.prepare(
    "UPDATE drafts SET status = ?, listing_mode = ?, title = ?, confidence = ?, payload_json = ?, updated_at = ? WHERE id = ? AND seller_account_id = ?",
  ).bind(
    draft.status,
    draft.listingMode,
    draft.selectedTitle,
    draft.confidence,
    JSON.stringify(draft),
    new Date().toISOString(),
    draft.draftId,
    sellerAccountId,
  ).run();
}

async function hydrateDraftPhotos(env: Bindings, draft: DraftPayload) {
  const photoRows = await env.DB.prepare(
    "SELECT id, file_name FROM batch_photos WHERE batch_id = ? ORDER BY created_at ASC LIMIT 24",
  ).bind(draft.batchId).all<{ id: string; file_name: string }>();
  const rows = [...(photoRows.results ?? [])];
  if (draft.photoOrderIds.length > 0) {
    const order = new Map(draft.photoOrderIds.map((id, index) => [id, index]));
    rows.sort((left, right) => {
      const leftIndex = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return 0;
    });
  } else if (draft.leadPhotoId) {
    rows.sort((left, right) => {
      if (left.id === draft.leadPhotoId) return -1;
      if (right.id === draft.leadPhotoId) return 1;
      return 0;
    });
  }

  return DraftPayloadSchema.parse({
    ...draft,
    photos: rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      url: `${getPublicApiBaseUrl(env)}/api/public/photos/${encodeURIComponent(row.id)}`,
    })),
  });
}

async function verifyDraft(env: Bindings, seller: SellerAccountRecord, draft: DraftPayload) {
  const accessToken = await getSellerAccessToken(env, seller);
  const policies = await getSellerPolicies(env, accessToken, draft.marketplaceId);
  const blockers = buildMarketplaceBlockers(seller.id, draft.marketplaceId, policies);
  const selectedPricing = draft.pricing.options.find((item) => item.strategy === draft.pricing.recommendedStrategy) ?? draft.pricing.options[0];
  const effectivePrice = draft.manualPriceOverride?.price ?? selectedPricing?.price ?? 0;
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
    blockers.push(createBlocker({
      draftId: draft.draftId,
      sellerAccountId: seller.id,
      type: "missing_required_aspects",
      title: "A buyer-facing price is required",
      description: "eBay cannot publish this draft until you enter a positive seller price or ListingOS finds trustworthy comparable evidence.",
      payload: {
        requiredFields: ["price"],
        pricingEvidence: draft.pricingEvidence,
      },
    }));
  }
  if (
    draft.identity?.vertical
    && draft.identity.vertical !== "general"
    && (
      draft.identity.status !== "verified"
      || ((draft.pricingEvidence?.exactMatchCount ?? 0) < 2 || draft.pricing.rangeMedian <= 0) && !draft.manualPriceOverride
    )
  ) {
    blockers.push(createBlocker({
      draftId: draft.draftId,
      sellerAccountId: seller.id,
      type: "missing_required_aspects",
      title: "Card identity or comps need confirmation",
      description: "Trading cards require verified identity and at least two exact comparable matches before publishing.",
      payload: {
        identity: draft.identity,
        pricingEvidence: draft.pricingEvidence,
      },
    }));
  }
  if (!draft.categoryGuess.categoryId) {
    blockers.push(createBlocker({
      draftId: draft.draftId,
      sellerAccountId: seller.id,
      type: "missing_required_aspects",
      title: "Category needs confirmation",
      description: "The AI draft does not have a publishable eBay category yet.",
      payload: {
        requiredFields: ["category"],
      },
    }));
    return blockers;
  }
  const requiredAspects = await getRequiredAspects(env, draft.marketplaceId, draft.categoryGuess.categoryId);
  const specificMap = new Map(draft.itemSpecifics.map((item) => [item.name.trim().toLowerCase(), item.value.trim()]));
  const missingRequired = requiredAspects.filter((aspect: string) => !specificMap.get(aspect.toLowerCase()));
  if (missingRequired.length > 0) {
    blockers.push(createBlocker({
      draftId: draft.draftId,
      sellerAccountId: seller.id,
      type: "missing_required_aspects",
      title: "Required item specifics are still missing",
      description: "eBay requires more item details before this listing can be published.",
      payload: {
        requiredFields: missingRequired,
        currentSpecifics: draft.itemSpecifics,
      },
    }));
  }
  return blockers;
}

async function replaceDraftBlockers(env: Bindings, sellerAccountId: string, draftId: string, blockers: ReturnType<typeof createBlocker>[]) {
  await env.DB.prepare("DELETE FROM blockers WHERE draft_id = ? AND seller_account_id = ?")
    .bind(draftId, sellerAccountId).run();
  const now = new Date().toISOString();
  for (const blocker of blockers) {
    await env.DB.prepare(
      "INSERT INTO blockers (id, draft_id, seller_account_id, type, status, title, description, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      blocker.id,
      draftId,
      sellerAccountId,
      blocker.type,
      blocker.status,
      blocker.title,
      blocker.description,
      JSON.stringify(blocker.payload),
      now,
      now,
    ).run();
  }
}

function buildMarketplaceBlockers(sellerAccountId: string, marketplaceId: string, policies: Awaited<ReturnType<typeof getSellerPolicies>>) {
  const blockers: ReturnType<typeof createBlocker>[] = [];
  if (policies.fulfillmentPolicies.length === 0) {
    blockers.push(createBlocker({
      draftId: "seller-readiness",
      sellerAccountId,
      type: "missing_fulfillment_policy",
      title: "Missing fulfillment policy",
      description: "The seller account needs a fulfillment policy for this marketplace.",
      payload: { marketplaceId, autoFix: true },
    }));
  }
  if (policies.paymentPolicies.length === 0) {
    blockers.push(createBlocker({
      draftId: "seller-readiness",
      sellerAccountId,
      type: "missing_payment_policy",
      title: "Missing payment policy",
      description: "The seller account needs a payment policy for this marketplace.",
      payload: { marketplaceId, autoFix: true },
    }));
  }
  if (policies.returnPolicies.length === 0) {
    blockers.push(createBlocker({
      draftId: "seller-readiness",
      sellerAccountId,
      type: "missing_return_policy",
      title: "Missing return policy",
      description: "The seller account needs a return policy for this marketplace.",
      payload: { marketplaceId, autoFix: true },
    }));
  }
  if (policies.inventoryLocations.length === 0) {
    blockers.push(createBlocker({
      draftId: "seller-readiness",
      sellerAccountId,
      type: "missing_inventory_location",
      title: "Missing inventory location",
      description: "Create one shipping location in-app so listings can publish.",
      payload: {
        marketplaceId,
        requiredFields: ["postalCode", "country"],
      },
    }));
  }
  return blockers;
}

async function ensureSellerDefaults(env: Bindings, seller: SellerAccountRecord, marketplaceId: string) {
  let record = await env.DB.prepare(
    "SELECT id, seller_account_id, marketplace_id, fulfillment_policy_id, payment_policy_id, return_policy_id, merchant_location_key FROM seller_marketplace_settings WHERE seller_account_id = ? AND marketplace_id = ?",
  ).bind(seller.id, marketplaceId).first<MarketplaceSettingsRecord>();
  const accessToken = await getSellerAccessToken(env, seller);
  await ensureSellingPolicyManagement(env, accessToken, marketplaceId);
  let policies = await getSellerPolicies(env, accessToken, marketplaceId);
  let paymentPolicyId = policies.paymentPolicies[0]?.paymentPolicyId ?? null;
  let returnPolicyId = policies.returnPolicies[0]?.returnPolicyId ?? null;
  let fulfillmentPolicyId = policies.fulfillmentPolicies[0]?.fulfillmentPolicyId ?? null;
  let merchantLocationKey = policies.inventoryLocations[0]?.merchantLocationKey ?? null;

  if (!paymentPolicyId || !returnPolicyId || !fulfillmentPolicyId) {
    const created = await createDefaultPolicies(env, accessToken, marketplaceId, {
      payment: !paymentPolicyId,
      returns: !returnPolicyId,
      fulfillment: !fulfillmentPolicyId,
    });
    paymentPolicyId = paymentPolicyId ?? created.paymentPolicyId;
    returnPolicyId = returnPolicyId ?? created.returnPolicyId;
    fulfillmentPolicyId = fulfillmentPolicyId ?? created.fulfillmentPolicyId;
    if (!paymentPolicyId || !returnPolicyId || !fulfillmentPolicyId) {
      policies = await getSellerPolicies(env, accessToken, marketplaceId);
      paymentPolicyId = paymentPolicyId ?? policies.paymentPolicies[0]?.paymentPolicyId ?? null;
      returnPolicyId = returnPolicyId ?? policies.returnPolicies[0]?.returnPolicyId ?? null;
      fulfillmentPolicyId = fulfillmentPolicyId ?? policies.fulfillmentPolicies[0]?.fulfillmentPolicyId ?? null;
    }
  }

  if (!merchantLocationKey) {
    const registrationLocation = await getSellerRegistrationLocation(env, accessToken).catch((error) => {
      logWorkerItem("warn", "seller.registration_location.unavailable", {}, {
        sellerAccountId: seller.id,
        marketplaceId,
        error: simplifyEbayError(error instanceof Error ? error.message : "Unknown registration location error."),
      });
      return null;
    });
    if (registrationLocation) {
      merchantLocationKey = await createWarehouseLocation(env, accessToken, marketplaceId, {
        name: "ListingOS Default Warehouse",
        postalCode: registrationLocation.postalCode,
        country: registrationLocation.country,
      });
    }
  }

  const now = new Date().toISOString();
  if (!record) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO seller_marketplace_settings
        (id, seller_account_id, marketplace_id, fulfillment_policy_id, payment_policy_id, return_policy_id, merchant_location_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(seller_account_id, marketplace_id) DO UPDATE SET
         fulfillment_policy_id = excluded.fulfillment_policy_id,
         payment_policy_id = excluded.payment_policy_id,
         return_policy_id = excluded.return_policy_id,
         merchant_location_key = COALESCE(seller_marketplace_settings.merchant_location_key, excluded.merchant_location_key),
         updated_at = excluded.updated_at`,
    ).bind(id, seller.id, marketplaceId, fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey, now, now).run();
    record = await env.DB.prepare(
      "SELECT id, seller_account_id, marketplace_id, fulfillment_policy_id, payment_policy_id, return_policy_id, merchant_location_key FROM seller_marketplace_settings WHERE seller_account_id = ? AND marketplace_id = ?",
    ).bind(seller.id, marketplaceId).first<MarketplaceSettingsRecord>();
    if (!record) throw new Error("ListingOS could not save the eBay marketplace defaults.");
  } else {
    await env.DB.prepare(
      "UPDATE seller_marketplace_settings SET fulfillment_policy_id = ?, payment_policy_id = ?, return_policy_id = ?, merchant_location_key = COALESCE(merchant_location_key, ?), updated_at = ? WHERE id = ?",
    ).bind(fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey, now, record.id).run();
    record = {
      ...record,
      fulfillment_policy_id: fulfillmentPolicyId,
      payment_policy_id: paymentPolicyId,
      return_policy_id: returnPolicyId,
      merchant_location_key: record.merchant_location_key ?? merchantLocationKey,
    };
  }
  return record;
}

async function prepareSellerForPublish(env: Bindings, seller: SellerAccountRecord, draft: DraftPayload) {
  try {
    await ensureSellerDefaults(env, seller, draft.marketplaceId);
    return [];
  } catch (error) {
    const message = simplifyEbayError(error instanceof Error ? error.message : "Unknown eBay seller setup error.");
    logWorkerItem("error", "seller.publish_setup.failed", { draftId: draft.draftId, batchId: draft.batchId }, {
      marketplaceId: draft.marketplaceId,
      sellerAccountId: seller.id,
      error: message,
    });
    return [createBlocker({
      draftId: draft.draftId,
      sellerAccountId: seller.id,
      type: "missing_marketplace_setting",
      title: "eBay seller setup needs attention",
      description: `ListingOS could not finish the one-time eBay seller setup: ${message}`,
      payload: {
        marketplaceId: draft.marketplaceId,
        source: "ebay_seller_setup",
        retryable: true,
      },
    })];
  }
}

async function ensureInventoryLocation(env: Bindings, seller: SellerAccountRecord, input: Record<string, unknown>) {
  const marketplaceId = stringOr(input.marketplaceId, env.EBAY_MARKETPLACE_ID ?? "EBAY_US");
  const accessToken = await getSellerAccessToken(env, seller);
  const postalCode = stringOr(input.postalCode, "").trim();
  const country = stringOr(input.country, "US").trim().toUpperCase();
  if (!postalCode || !country) {
    throw new Error("Inventory location requires postalCode and country.");
  }
  const merchantLocationKey = await createWarehouseLocation(env, accessToken, marketplaceId, {
    name: stringOr(input.name, "ListingOS Warehouse"),
    addressLine1: stringOr(input.addressLine1, null),
    city: stringOr(input.city, null),
    stateOrProvince: stringOr(input.stateOrProvince, null),
    postalCode,
    country,
  }, `seller-ai-${crypto.randomUUID().slice(0, 12)}`);
  const settings = await env.DB.prepare(
    "SELECT id FROM seller_marketplace_settings WHERE seller_account_id = ? AND marketplace_id = ?",
  ).bind(seller.id, marketplaceId).first<{ id: string }>();
  const now = new Date().toISOString();
  if (settings) {
    await env.DB.prepare(
      "UPDATE seller_marketplace_settings SET merchant_location_key = ?, updated_at = ? WHERE id = ?",
    ).bind(merchantLocationKey, now, settings.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO seller_marketplace_settings (id, seller_account_id, marketplace_id, merchant_location_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), seller.id, marketplaceId, merchantLocationKey, now, now).run();
  }
}

async function ensureSellingPolicyManagement(env: Bindings, accessToken: string, marketplaceId: string) {
  const response = await ebaySellerRequest(
    env,
    accessToken,
    "/sell/account/v1/program/get_opted_in_programs",
    { method: "GET" },
    marketplaceId,
  );
  const body = asRecord(await response.json().catch(() => ({})));
  const programs = Array.isArray(body?.programs) ? body.programs : [];
  const optedIn = programs.some((program) => stringOr(asRecord(program)?.programType, "") === "SELLING_POLICY_MANAGEMENT");
  if (optedIn) return;
  await ebaySellerRequest(
    env,
    accessToken,
    "/sell/account/v1/program/opt_in",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programType: "SELLING_POLICY_MANAGEMENT" }),
    },
    marketplaceId,
  );
}

async function getSellerRegistrationLocation(env: Bindings, accessToken: string) {
  const response = await fetchWithTimeout(`${getEbayApiBaseUrl(env)}/ws/api.dll`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetUser",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1227",
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-IAF-TOKEN": accessToken,
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
      <GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <Version>1227</Version>
        <DetailLevel>ReturnAll</DetailLevel>
      </GetUserRequest>`,
  }, EBAY_SELLER_REQUEST_TIMEOUT_MS, "eBay seller registration location");
  const xml = await response.text();
  if (!response.ok || !/<Ack>(?:Success|Warning)<\/Ack>/i.test(xml)) {
    throw new Error(`eBay seller registration lookup failed: ${response.status} ${xml.slice(0, 400)}`);
  }
  const registrationAddress = xml.match(/<RegistrationAddress>([\s\S]*?)<\/RegistrationAddress>/i)?.[1] ?? "";
  const postalCode = decodeXmlText(registrationAddress.match(/<PostalCode>([\s\S]*?)<\/PostalCode>/i)?.[1] ?? "").trim();
  const country = decodeXmlText(registrationAddress.match(/<Country>([\s\S]*?)<\/Country>/i)?.[1] ?? "").trim().toUpperCase();
  return postalCode && country ? { postalCode, country } : null;
}

async function createWarehouseLocation(
  env: Bindings,
  accessToken: string,
  marketplaceId: string,
  address: {
    name: string;
    postalCode: string;
    country: string;
    addressLine1?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
  },
  requestedKey?: string,
) {
  const merchantLocationKey = requestedKey
    ?? `listingos-${marketplaceId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-default`;
  const addressPayload = Object.fromEntries(Object.entries({
    addressLine1: address.addressLine1,
    city: address.city,
    stateOrProvince: address.stateOrProvince,
    postalCode: address.postalCode,
    country: address.country,
  }).filter(([, value]) => typeof value === "string" && value.trim().length > 0));
  try {
    await ebaySellerRequest(env, accessToken, `/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: address.name,
        locationTypes: ["WAREHOUSE"],
        merchantLocationStatus: "ENABLED",
        location: { address: addressPayload },
      }),
    }, marketplaceId);
    return merchantLocationKey;
  } catch (error) {
    const policies = await getSellerPolicies(env, accessToken, marketplaceId);
    const existingKey = policies.inventoryLocations.find((location) => (
      stringOr(asRecord(location)?.merchantLocationKey, "") === merchantLocationKey
    ))?.merchantLocationKey;
    if (existingKey) return existingKey;
    throw error;
  }
}

function decodeXmlText(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

async function applyDraftResolutionValues(env: Bindings, draftId: string, values: Record<string, unknown>) {
  const row = await env.DB.prepare("SELECT payload_json, seller_account_id FROM drafts WHERE id = ?")
    .bind(draftId).first<{ payload_json: string; seller_account_id: string }>();
  if (!row) return;
  const draft = DraftPayloadSchema.parse(JSON.parse(row.payload_json));
  const nextValues = { ...values };
  const rawCategory = stringOr(nextValues.category, null);
  delete nextValues.category;

  const specifics = new Map(draft.itemSpecifics.map((item) => [item.name.toLowerCase(), item]));
  for (const [name, rawValue] of Object.entries(nextValues)) {
    const value = stringOr(rawValue, "").trim();
    if (!value) continue;
    specifics.set(name.toLowerCase(), { name, value });
  }

  const updatedDraft = DraftPayloadSchema.parse({
    ...draft,
    itemSpecifics: Array.from(specifics.values()),
    categoryGuess: rawCategory ? await suggestCategory(env, rawCategory, draft.marketplaceId) : draft.categoryGuess,
  });
  await saveDraftPayload(env, updatedDraft, row.seller_account_id);
}

async function buildInventoryOfferPayload(
  env: Bindings,
  seller: SellerAccountRecord,
  draft: DraftPayload,
  strategy: PricingStrategy,
  settings: MarketplaceSettingsRecord,
  accessToken: string,
) {
  const selectedPricing = draft.pricing.options.find((item) => item.strategy === strategy) ?? draft.pricing.options[0];
  const effectivePrice = draft.manualPriceOverride?.price ?? selectedPricing.price;
  const sku = `seller-ai-${draft.draftId}`;
  const photoRows = draft.photos.length > 0
    ? draft.photos.slice(0, 12).map((photo) => ({ id: photo.id }))
    : (await env.DB.prepare(
      "SELECT id FROM batch_photos WHERE batch_id = ? ORDER BY created_at ASC LIMIT 12",
    ).bind(draft.batchId).all<{ id: string }>()).results ?? [];
  const imageUrls = await mapWithConcurrency(photoRows, 3, async (row) => {
    const cacheKey = `eps-photo:${row.id}`;
    const cached = await env.SESSION_KV.get(cacheKey);
    if (cached) return cached;
    const sourceUrl = `${getPublicApiBaseUrl(env)}/api/public/photos/${encodeURIComponent(row.id)}`;
    const epsUrl = await createEbayImageFromUrl(env, accessToken, sourceUrl);
    await env.SESSION_KV.put(cacheKey, epsUrl, { expirationTtl: 30 * 24 * 60 * 60 });
    return epsUrl;
  });
  if (imageUrls.length === 0) {
    throw new Error("A listing must have at least one eBay-hosted image before it can be published.");
  }
  const aspects = Object.fromEntries(draft.itemSpecifics.map((item) => {
    // eBay expects bare numeric grades ("9"), but AI extraction often
    // carries label text ("MINT 9"); unrecognized values are dropped by
    // eBay and then reported as missing required aspects.
    if (item.name === "Grade" || item.name === "Card Grade") return [item.name, [normalizeGrade(item.value)]];
    if (item.name === "Professional Grader" || item.name === "Grader") {
      return [item.name, [normalizeGrader(item.value) ?? item.value]];
    }
    return [item.name, [item.value]];
  }));
  const condition = tradingCardInventoryCondition(draft) ?? await inventoryConditionForCategory(
    env,
    accessToken,
    draft.marketplaceId,
    draft.categoryGuess.categoryId,
    draft.condition,
  );
  const conditionDescriptors = tradingCardConditionDescriptors(draft);
  const inventoryPayload = {
    availability: {
      shipToLocationAvailability: {
        quantity: draft.listingMode === "auction" ? 1 : 1,
      },
    },
    condition,
    conditionDescriptors: conditionDescriptors.length > 0 ? conditionDescriptors : undefined,
    conditionDescription: conditionDescriptors.length > 0 ? undefined : draft.conditionNotes || undefined,
    product: {
      title: draft.selectedTitle,
      description: draft.description,
      aspects,
      imageUrls: imageUrls.filter(Boolean),
      brand: draft.itemSpecifics.find((item) => item.name.toLowerCase() === "brand")?.value,
      mpn: draft.itemSpecifics.find((item) => item.name.toLowerCase() === "mpn")?.value,
    },
  };
  await ebaySellerRequest(
    env,
    accessToken,
    `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inventoryPayload),
    },
    draft.marketplaceId,
  );

  const offerPayload = {
    sku,
    marketplaceId: draft.marketplaceId,
    format: draft.listingMode === "auction" ? "AUCTION" : "FIXED_PRICE",
    availableQuantity: 1,
    categoryId: draft.categoryGuess.categoryId,
    merchantLocationKey: settings.merchant_location_key,
    listingDescription: draft.description,
    listingPolicies: {
      fulfillmentPolicyId: settings.fulfillment_policy_id,
      paymentPolicyId: settings.payment_policy_id,
      returnPolicyId: settings.return_policy_id,
    },
    listingDuration: draft.listingMode === "auction" ? "DAYS_7" : "GTC",
    pricingSummary: draft.listingMode === "auction"
      ? {
        auctionStartPrice: {
          value: String(effectivePrice),
          currency: currencyForMarketplace(draft.marketplaceId),
        },
      }
      : {
        price: {
          value: String(effectivePrice),
          currency: currencyForMarketplace(draft.marketplaceId),
        },
      },
  };
  return { sku, offerPayload };
}

async function createEbayImageFromUrl(env: Bindings, accessToken: string, imageUrl: string) {
  const mediaBaseUrl = env.EBAY_USE_SANDBOX === "true"
    ? "https://apim.sandbox.ebay.com"
    : "https://apim.ebay.com";
  const response = await fetchWithTimeout(`${mediaBaseUrl}/commerce/media/v1_beta/image/create_image_from_url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl }),
  }, EBAY_MEDIA_INGEST_TIMEOUT_MS, "eBay image ingestion");
  const body = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`eBay image ingestion failed: ${response.status} ${JSON.stringify(body)}`);
  }
  const epsUrl = stringOr(body?.maxDimensionImageUrl, "") || stringOr(body?.imageUrl, "");
  if (!epsUrl) {
    throw new Error("eBay image ingestion succeeded without returning an EPS image URL.");
  }
  const parsedUrl = new URL(epsUrl);
  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith("ebayimg.com")) {
    throw new Error("eBay image ingestion returned an invalid EPS image URL.");
  }
  return epsUrl;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function inventoryCondition(value: string) {
  const normalized = value.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_").replaceAll(/^_|_$/g, "");
  const supported = new Set([
    "NEW",
    "LIKE_NEW",
    "NEW_OTHER",
    "NEW_WITH_DEFECTS",
    "CERTIFIED_REFURBISHED",
    "EXCELLENT_REFURBISHED",
    "VERY_GOOD_REFURBISHED",
    "GOOD_REFURBISHED",
    "SELLER_REFURBISHED",
    "USED_EXCELLENT",
    "USED_VERY_GOOD",
    "USED_GOOD",
    "USED_ACCEPTABLE",
    "FOR_PARTS_OR_NOT_WORKING",
    "PRE_OWNED_EXCELLENT",
    "PRE_OWNED_FAIR",
  ]);
  if (supported.has(normalized)) return normalized;
  if (normalized === "USED" || normalized === "PRE_OWNED") return "USED_EXCELLENT";
  if (normalized.includes("PARTS") || normalized.includes("NOT_WORKING")) return "FOR_PARTS_OR_NOT_WORKING";
  if (normalized.includes("ACCEPTABLE") || normalized.includes("FAIR")) return "USED_ACCEPTABLE";
  if (normalized.includes("VERY_GOOD")) return "USED_VERY_GOOD";
  if (normalized.includes("EXCELLENT")) return "USED_EXCELLENT";
  if (normalized.includes("REFURBISHED")) return "SELLER_REFURBISHED";
  return normalized.includes("NEW") ? "NEW" : "USED_GOOD";
}

function tradingCardInventoryCondition(draft: DraftPayload) {
  if (draft.categoryGuess.categoryId !== "183454" && draft.identity?.vertical !== "graded_card") return null;
  const graded = specificValue(draft, "Graded").toLowerCase() === "yes" || draft.identity?.vertical === "graded_card";
  return graded ? "LIKE_NEW" : null;
}

// eBay condition descriptor value IDs for graded trading cards.
// 27501 = Professional Grader, 27502 = Grade, 27503 = Certification Number.
// https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html
const GRADER_DESCRIPTOR_VALUES: Record<string, string> = {
  PSA: "275010",
  BCCG: "275011",
  BVG: "275012",
  BGS: "275013",
  CSG: "275014",
  SGC: "275016",
  KSA: "275017",
  GMA: "275018",
  HGA: "275019",
  ISA: "2750110",
  GSG: "2750112",
  PGS: "2750113",
  MNT: "2750114",
  TAG: "2750115",
  RARE: "2750116",
  RCG: "2750117",
  CGA: "2750120",
  TCG: "2750121",
  OTHER: "2750123",
};

const GRADE_DESCRIPTOR_VALUES: Record<string, string> = {
  "10": "275020",
  "9.5": "275021",
  "9": "275022",
  "8.5": "275023",
  "8": "275024",
  "7.5": "275025",
  "7": "275026",
  "6.5": "275027",
  "6": "275028",
  "5.5": "275029",
  "5": "2750210",
  "4.5": "2750211",
  "4": "2750212",
  "3.5": "2750213",
  "3": "2750214",
  "2.5": "2750215",
  "2": "2750216",
  "1.5": "2750217",
  "1": "2750218",
  AUTHENTIC: "2750219",
};

function tradingCardConditionDescriptors(draft: DraftPayload) {
  if (tradingCardInventoryCondition(draft) !== "LIKE_NEW") return [];
  const graderRaw = draft.identity?.fields?.grader ?? specificValue(draft, "Professional Grader");
  const gradeRaw = draft.identity?.fields?.grade ?? specificValue(draft, "Grade");
  const certNumber = draft.identity?.fields?.certNumber ?? specificValue(draft, "Certification Number");
  const graderKey = (normalizeGrader(graderRaw) ?? "OTHER").toUpperCase();
  const graderId = GRADER_DESCRIPTOR_VALUES[graderKey] ?? GRADER_DESCRIPTOR_VALUES.OTHER;
  const gradeId = GRADE_DESCRIPTOR_VALUES[normalizeGrade(gradeRaw)];
  const descriptors: Record<string, unknown>[] = [{ name: "27501", values: [graderId] }];
  if (gradeId) descriptors.push({ name: "27502", values: [gradeId] });
  if (certNumber) {
    descriptors.push({ name: "27503", additionalInfo: certNumber });
  }
  return descriptors;
}

function specificValue(draft: DraftPayload, name: string) {
  return draft.itemSpecifics.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function inventoryConditionForCategory(
  env: Bindings,
  accessToken: string,
  marketplaceId: string,
  categoryId: string | null,
  value: string,
) {
  if (!categoryId) return inventoryCondition(value);
  try {
    const filter = encodeURIComponent(`categoryIds:{${categoryId}}`);
    const response = await ebaySellerRequest(
      env,
      accessToken,
      `/sell/metadata/v1/marketplace/${encodeURIComponent(marketplaceId)}/get_item_condition_policies?filter=${filter}`,
      { method: "GET" },
      marketplaceId,
    );
    const body = asRecord(await response.json());
    const policy = Array.isArray(body?.itemConditionPolicies) ? asRecord(body.itemConditionPolicies[0]) : null;
    const supportedIds = new Set(
      (Array.isArray(policy?.itemConditions) ? policy.itemConditions : [])
        .map((item) => stringOr(asRecord(item)?.conditionId, ""))
        .filter(Boolean),
    );
    const normalized = value.trim().toUpperCase();
    const preferredIds = normalized.includes("NEW")
      ? normalized.includes("DEFECT") ? ["1750", "1500", "1000"] : ["1000", "1500", "1750"]
      : normalized.includes("FAIR") || normalized.includes("ACCEPTABLE")
        ? ["3010", "6000", "5000", "3000"]
        : ["3000", "4000", "5000", "6000", "2990", "3010"];
    const selectedId = preferredIds.find((id) => supportedIds.has(id));
    const conditionById: Record<string, string> = {
      "1000": "NEW",
      "1500": "NEW_OTHER",
      "1750": "NEW_WITH_DEFECTS",
      "2000": "CERTIFIED_REFURBISHED",
      "2010": "EXCELLENT_REFURBISHED",
      "2020": "VERY_GOOD_REFURBISHED",
      "2030": "GOOD_REFURBISHED",
      "2500": "SELLER_REFURBISHED",
      "2750": "LIKE_NEW",
      "2990": "PRE_OWNED_EXCELLENT",
      "3000": "USED_EXCELLENT",
      "3010": "PRE_OWNED_FAIR",
      "4000": "USED_VERY_GOOD",
      "5000": "USED_GOOD",
      "6000": "USED_ACCEPTABLE",
      "7000": "FOR_PARTS_OR_NOT_WORKING",
    };
    return selectedId ? conditionById[selectedId] : inventoryCondition(value);
  } catch {
    return inventoryCondition(value);
  }
}

async function publishInventoryOffer(env: Bindings, accessToken: string, marketplaceId: string, payload: { sku: string; offerPayload: Record<string, unknown> }) {
  const query = new URLSearchParams({
    limit: "50",
    offset: "0",
    marketplace_id: marketplaceId,
    sku: payload.sku,
  });
  let offersBody: Record<string, unknown> = {};
  try {
    const offersResponse = await ebaySellerRequest(
      env,
      accessToken,
      `/sell/inventory/v1/offer?${query}`,
      { method: "GET" },
      marketplaceId,
    );
    offersBody = asRecord(await offersResponse.json()) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("404") && !message.includes("25713")) {
      throw error;
    }
  }
  const existingOffer = (Array.isArray(offersBody?.offers) ? offersBody.offers : [])
    .map((offer) => asRecord(offer))
    .find((offer) => stringOr(offer?.marketplaceId, "") === marketplaceId) ?? null;
  const existingListing = asRecord(existingOffer?.listing);
  const existingListingId = stringOr(existingListing?.listingId, "");
  if (existingListingId) {
    return {
      ok: true,
      offerId: stringOr(existingOffer?.offerId, ""),
      listingId: existingListingId,
      body: {
        listing: {
          listingId: existingListingId,
          listingUrl: `https://www.ebay.com/itm/${existingListingId}`,
        },
        ebayResponse: existingOffer,
      },
    };
  }

  let offerId = stringOr(existingOffer?.offerId, "");
  if (!offerId) {
    const createResponse = await ebaySellerRequest(
      env,
      accessToken,
      "/sell/inventory/v1/offer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload.offerPayload),
      },
      marketplaceId,
    );
    const created = asRecord(await createResponse.json());
    offerId = stringOr(created?.offerId, "");
  }
  const publishResponse = await ebaySellerRequest(
    env,
    accessToken,
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    { method: "POST" },
    marketplaceId,
  );
  const body = await responseJsonOrText(publishResponse);
  const listingId = stringOr((body as Record<string, unknown>)?.listingId, "");
  return {
    ok: publishResponse.ok,
    offerId,
    listingId: listingId || null,
    body: {
      listing: listingId ? {
        listingId,
        listingUrl: `https://www.ebay.com/itm/${listingId}`,
      } : null,
      ebayResponse: body,
    },
  };
}

async function createDefaultPolicies(
  env: Bindings,
  accessToken: string,
  marketplaceId: string,
  missing: { payment: boolean; returns: boolean; fulfillment: boolean },
) {
  const categoryTypes = [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }];
  const payment = missing.payment ? asRecord(await ebaySellerRequest(
    env,
    accessToken,
    "/sell/account/v1/payment_policy",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ListingOS Immediate Payment",
        description: "Auto-created payment policy for ListingOS.",
        marketplaceId,
        categoryTypes,
        immediatePay: true,
      }),
    },
    marketplaceId,
  ).then((response) => response.json())) : null;
  const returns = missing.returns ? asRecord(await ebaySellerRequest(
    env,
    accessToken,
    "/sell/account/v1/return_policy",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ListingOS 30 Day Returns",
        description: "Auto-created return policy for ListingOS.",
        marketplaceId,
        categoryTypes,
        returnsAccepted: true,
        refundMethod: "MONEY_BACK",
        returnPeriod: { value: 30, unit: "DAY" },
        returnShippingCostPayer: "BUYER",
      }),
    },
    marketplaceId,
  ).then((response) => response.json())) : null;
  const fulfillment = missing.fulfillment ? asRecord(await ebaySellerRequest(
    env,
    accessToken,
    "/sell/account/v1/fulfillment_policy",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ListingOS Free Domestic Shipping",
        description: "Auto-created fulfillment policy for ListingOS.",
        marketplaceId,
        categoryTypes,
        handlingTime: { value: 1, unit: "DAY" },
        shippingOptions: [
          {
            optionType: "DOMESTIC",
            costType: "FLAT_RATE",
            shippingServices: [
              {
                sortOrder: 1,
                shippingCarrierCode: "USPS",
                shippingServiceCode: "USPSPriority",
                shippingCost: {
                  value: "0",
                  currency: currencyForMarketplace(marketplaceId),
                },
                freeShipping: true,
                buyerResponsibleForShipping: false,
              },
            ],
          },
        ],
        localPickup: false,
      }),
    },
    marketplaceId,
  ).then((response) => response.json())) : null;

  return {
    paymentPolicyId: stringOr(payment?.paymentPolicyId, null),
    returnPolicyId: stringOr(returns?.returnPolicyId, null),
    fulfillmentPolicyId: stringOr(fulfillment?.fulfillmentPolicyId, null),
  };
}

async function getSellerPolicies(
  env: Bindings,
  accessToken: string,
  marketplaceId: string,
  options: { tolerateFailures?: boolean } = {},
) {
  const query = `?marketplace_id=${encodeURIComponent(marketplaceId)}`;
  const load = (request: Promise<unknown>) => options.tolerateFailures ? request.catch(() => ({})) : request;
  const [fulfillmentPoliciesRaw, paymentPoliciesRaw, returnPoliciesRaw, inventoryLocationsRaw] = await Promise.all([
    load(ebaySellerRequest(env, accessToken, `/sell/account/v1/fulfillment_policy${query}`, { method: "GET" }, marketplaceId).then((r) => r.json())),
    load(ebaySellerRequest(env, accessToken, `/sell/account/v1/payment_policy${query}`, { method: "GET" }, marketplaceId).then((r) => r.json())),
    load(ebaySellerRequest(env, accessToken, `/sell/account/v1/return_policy${query}`, { method: "GET" }, marketplaceId).then((r) => r.json())),
    load(ebaySellerRequest(env, accessToken, "/sell/inventory/v1/location", { method: "GET" }, marketplaceId).then((r) => r.json())),
  ]);
  const fulfillmentPolicies = asRecord(fulfillmentPoliciesRaw);
  const paymentPolicies = asRecord(paymentPoliciesRaw);
  const returnPolicies = asRecord(returnPoliciesRaw);
  const inventoryLocations = asRecord(inventoryLocationsRaw);
  return {
    fulfillmentPolicies: Array.isArray(fulfillmentPolicies?.fulfillmentPolicies) ? fulfillmentPolicies.fulfillmentPolicies : [],
    paymentPolicies: Array.isArray(paymentPolicies?.paymentPolicies) ? paymentPolicies.paymentPolicies : [],
    returnPolicies: Array.isArray(returnPolicies?.returnPolicies) ? returnPolicies.returnPolicies : [],
    inventoryLocations: Array.isArray(inventoryLocations?.locations) ? inventoryLocations.locations : [],
  };
}

async function getRequiredAspects(env: Bindings, marketplaceId: string, categoryId: string) {
  const token = await getEbayAppToken(env);
  const treeResponse = await fetch(
    `${getEbayApiBaseUrl(env)}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
    },
  );
  const tree = asRecord(await treeResponse.json().catch(() => ({})));
  const treeId = stringOr(tree?.categoryTreeId, "0");
  const response = await fetch(
    `${getEbayApiBaseUrl(env)}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
    },
  );
  const payload = asRecord(await response.json().catch(() => ({})));
  const aspects = Array.isArray(payload?.aspects) ? payload.aspects : [];
  return aspects
    .map((aspect: unknown) => asRecord(aspect))
    .filter((aspect: Record<string, unknown> | null): aspect is Record<string, unknown> => Boolean(aspect))
    .filter((aspect: Record<string, unknown>) => Boolean(asRecord(aspect.aspectConstraint)?.aspectRequired))
    .map((aspect: Record<string, unknown>) => stringOr(aspect.localizedAspectName, ""))
    .filter(Boolean);
}

async function suggestCategory(env: Bindings, query: string, marketplaceId: string) {
  const token = await getEbayAppToken(env);
  const treeResponse = await fetchWithTimeout(
    `${getEbayApiBaseUrl(env)}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
    },
    EBAY_FAST_LOOKUP_TIMEOUT_MS,
    "eBay category tree lookup",
  );
  const tree = asRecord(await treeResponse.json().catch(() => ({})));
  const treeId = stringOr(tree?.categoryTreeId, "0");
  const response = await fetchWithTimeout(
    `${getEbayApiBaseUrl(env)}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
    },
    EBAY_FAST_LOOKUP_TIMEOUT_MS,
    "eBay category suggestion lookup",
  );
  const payload = asRecord(await response.json().catch(() => ({})));
  const first = Array.isArray(payload?.categorySuggestions) ? asRecord(payload.categorySuggestions[0]) : null;
  const category = asRecord(first?.category);
  const ancestors = Array.isArray(first?.categoryTreeNodeAncestors) ? first.categoryTreeNodeAncestors : [];
  return {
    categoryId: stringOr(category?.categoryId, null),
    categoryName: stringOr(category?.categoryName, "Unknown category"),
    categoryPath: ancestors.length > 0
      ? ancestors
        .map((item) => stringOr(asRecord(asRecord(item)?.category)?.categoryName, ""))
        .filter(Boolean)
        .concat(stringOr(category?.categoryName, ""))
        .join(" > ")
      : stringOr(category?.categoryName, null),
    confidence: first ? 0.78 : 0.2,
  };
}

async function suggestBestCategory(
  env: Bindings,
  input: { categoryText: string; searchQuery: string; title: string; marketplaceId: string },
) {
  const queries = Array.from(new Set([input.categoryText, input.searchQuery, input.title]
    .map((value) => value.trim())
    .filter(Boolean)));
  const results = await Promise.allSettled(queries.slice(0, 3).map((query) => suggestCategory(env, query, input.marketplaceId)));
  const candidates = results
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof suggestCategory>>> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((candidate) => Boolean(candidate.categoryId));
  if (candidates.length === 0) return fallbackCategoryGuess(input.categoryText);

  const signalTokens = tokenizeCategorySignals([input.categoryText, input.searchQuery, input.title].join(" "));
  return candidates.sort((left, right) => scoreCategoryCandidate(right, signalTokens) - scoreCategoryCandidate(left, signalTokens))[0];
}

function tokenizeCategorySignals(value: string) {
  const ignored = new Set(["the", "and", "with", "for", "used", "new", "unbranded", "unknown", "white", "black", "red"]);
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length >= 4 && !ignored.has(token)));
}

function scoreCategoryCandidate(candidate: Awaited<ReturnType<typeof suggestCategory>>, signalTokens: Set<string>) {
  const categoryTokens = tokenizeCategorySignals(`${candidate.categoryName} ${candidate.categoryPath ?? ""}`);
  let score = candidate.confidence;
  for (const token of signalTokens) {
    if (categoryTokens.has(token)) score += 2;
  }
  return score;
}

function fallbackCategoryGuess(categoryGuessText: string) {
  return {
    categoryId: null,
    categoryName: categoryGuessText || "Category needs confirmation",
    categoryPath: categoryGuessText || null,
    confidence: 0.2,
  };
}

async function createListingDraft(
  env: Bindings,
  images: { id: string; objectKey: string; dataUrl: string; visionContext?: unknown }[],
  marketplaceId: string,
  pricingStrategy: PricingStrategy,
  operationContext: AiOperationContext,
) {
  const startedAt = Date.now();
  const model = env.OPENAI_DRAFT_MODEL ?? env.OPENAI_MODEL ?? DEFAULT_FAST_DRAFT_MODEL;
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 2200,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "You generate AI-first eBay listing drafts from product photos.",
                "Optimize for selling successfully with the least seller input possible.",
                "Return marketplace-honest recommendations only.",
                "Write clean, high-converting eBay copy that sounds like a careful expert seller, not a hype ad.",
                "The description must be buyer-ready: 1 short opening sentence, 3 to 6 concise bullet-style lines, and a final condition/shipping note when visible facts support it.",
                "Do not invent accessories, measurements, authenticity claims, warranties, flaws, bundles, provenance, or condition details that are not visible or supported by marketplace context.",
                "If a detail is uncertain, put it in missingInfo instead of writing it as fact.",
                "For a generic eBay US product with no visible brand mark or manufacturer part number, add separate item specifics Brand=Unbranded and MPN=Does not apply only when the photos support that conclusion. Never use those fallback values for a recognizable branded item, a trading card, or a product with a visible identifier; other marketplaces may require different unavailable values.",
                "Titles should be search-rich, natural, under eBay's title limit, and free of spammy symbols, all-caps hype, or unverifiable claims.",
                "Condition notes should be specific, transparent, and grounded in the photos.",
                "If the item is a trading card or graded slab, extract exact card identifiers and never guess set/year/card number when unreadable.",
                `Marketplace: ${marketplaceId}`,
                `Default pricing strategy: ${pricingStrategy}`,
                "On-device visual observations are probabilistic hints only. Do not treat them as authoritative identity, condition, authenticity, price, or card/set/year evidence. Cross-check them against the images and marketplace/catalog evidence, and use missingInfo when the evidence conflicts or is insufficient.",
                `On-device visual observations: ${JSON.stringify(images.flatMap((image) => image.visionContext ? [{ photoId: image.id, context: image.visionContext }] : []))}`,
              ].join("\n"),
            },
            ...images.map((image) => ({
              type: "input_image",
              image_url: image.dataUrl,
              detail: "low",
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "seller_ai_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "titleOptions",
              "searchQuery",
              "condition",
              "conditionNotes",
              "description",
              "itemSpecifics",
              "photoChecklist",
              "missingInfo",
              "confidence",
              "suggestedPriceFloor",
              "listingModeRecommendation",
              "allowAuction",
              "enhancementPlan",
              "categoryGuessText",
              "productVertical",
              "cardIdentifiers",
            ],
            properties: {
              titleOptions: {
                type: "array",
                minItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "rationale"],
                  properties: {
                    title: { type: "string" },
                    rationale: { type: "string" },
                  },
                },
              },
              searchQuery: { type: "string" },
              categoryGuessText: { type: "string" },
              productVertical: { type: "string", enum: ["general", "trading_card", "graded_card"] },
              cardIdentifiers: {
                type: "object",
                additionalProperties: false,
                required: ["grader", "certNumber", "grade", "game", "cardName", "setName", "cardNumber", "year", "parallel", "language"],
                properties: {
                  grader: { type: ["string", "null"] },
                  certNumber: { type: ["string", "null"] },
                  grade: { type: ["string", "null"] },
                  game: { type: ["string", "null"] },
                  cardName: { type: ["string", "null"] },
                  setName: { type: ["string", "null"] },
                  cardNumber: { type: ["string", "null"] },
                  year: { type: ["string", "null"] },
                  parallel: { type: ["string", "null"] },
                  language: { type: ["string", "null"] },
                },
              },
              condition: { type: "string" },
              conditionNotes: { type: "string" },
              description: { type: "string" },
              confidence: { type: "number" },
              suggestedPriceFloor: { type: ["number", "null"] },
              listingModeRecommendation: { type: "string", enum: ["fixed_price", "auction"] },
              allowAuction: { type: "boolean" },
              itemSpecifics: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "value"],
                  properties: {
                    name: { type: "string" },
                    value: { type: "string" },
                  },
                },
              },
              photoChecklist: {
                type: "array",
                items: { type: "string" },
              },
              missingInfo: {
                type: "array",
                items: { type: "string" },
              },
              enhancementPlan: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "rationale", "sourcePhotoIds"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["cropped", "thumbnail", "background_cleaned", "enhanced", "lead_photo"],
                    },
                    rationale: { type: "string" },
                    sourcePhotoIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  }, OPENAI_DRAFT_TIMEOUT_MS, "OpenAI listing draft");
  if (!response.ok) {
    const errorBody = await response.text();
    await recordAiOperation(env, operationContext, {
      operation: "listing_draft",
      model,
      providerRequestId: response.headers.get("x-request-id"),
      latencyMs: Date.now() - startedAt,
      imageCount: images.length,
      imageDetail: "low",
      success: false,
      errorCode: `http_${response.status}`,
      metadata: { status: response.status },
    }).catch((error) => console.warn("Could not record failed OpenAI draft operation", error));
    throw new Error(`OpenAI listing draft failed: ${response.status} ${errorBody}`);
  }
  const payload = asRecord(await response.json().catch(() => ({}))) ?? {};
  const output = extractResponseText(payload);
  const parsed = parseStructuredJson<SellerAiDraftOutput>(payload, output)
    ?? createFallbackListingDraft(images, pricingStrategy, output ? "OpenAI returned malformed listing JSON." : "OpenAI returned no listing draft payload.");
  await recordAiOperation(env, operationContext, {
    operation: "listing_draft",
    model,
    providerRequestId: response.headers.get("x-request-id"),
    responsePayload: payload,
    latencyMs: Date.now() - startedAt,
    imageCount: images.length,
    imageDetail: "low",
    success: true,
    metadata: { structuredOutput: Boolean(parseStructuredJson<SellerAiDraftOutput>(payload, output)) },
  }).catch((error) => console.warn("Could not record OpenAI draft operation", error));
  return {
    ...parsed,
    enhancementPlan: parsed.enhancementPlan.map((item) => ImageEnhancementSchema.parse(item)),
  };
}

async function resolveProductIdentity(
  env: Bindings,
  aiDraft: AiListingDraft,
  images: { id: string; objectKey: string; dataUrl: string }[],
  marketplaceId: string,
  operationContext: AiOperationContext,
) {
  const aiFields = normalizeCardFields({
    ...Object.fromEntries(aiDraft.itemSpecifics.map((item) => [item.name, item.value])),
    ...aiDraft.cardIdentifiers,
  });
  const isCard = aiDraft.productVertical !== "general" || isCardLikeText([
    aiDraft.searchQuery,
    aiDraft.categoryGuessText,
    aiDraft.condition,
    ...aiDraft.itemSpecifics.flatMap((item) => [item.name, item.value]),
  ].join(" "));

  if (!isCard) {
    return ProductIdentitySchema.parse({
      vertical: "general",
      source: "ai_vision",
      confidence: aiDraft.confidence,
      status: aiDraft.confidence >= 0.65 ? "verified" : "needs_confirmation",
      canonicalTitle: aiDraft.titleOptions[0]?.title ?? null,
      searchQuery: aiDraft.searchQuery,
      fields: {},
      warnings: [],
    });
  }

  const ocrFields = shouldRunCardOcr(aiFields)
    ? await extractCardIdentityFromImages(env, images.slice(0, CARD_OCR_IMAGE_LIMIT), operationContext).catch(() => null)
    : null;
  let fields = normalizeCardFields({
    ...aiFields,
    ...(ocrFields?.fields ?? {}),
  });
  let source: ProductIdentity["source"] = ocrFields ? "ocr" : "ai_vision";
  let warnings = [
    ...identityWarnings(fields),
    ...(ocrFields?.warnings ?? []),
  ];
  let confidence = ocrFields ? Math.max(0.62, aiDraft.confidence) : Math.min(aiDraft.confidence, 0.7);

  const psa = fields.certNumber ? await lookupPsaCert(env, fields.certNumber).catch(() => null) : null;
  if (psa?.fields) {
    const psaFields = definedCardFields(psa.fields);
    if (isGenericCardGame(psaFields.game) && fields.game) {
      delete psaFields.game;
    }
    fields = normalizeCardFields({ ...fields, ...psaFields });
    source = "psa_cert";
    confidence = 0.98;
    warnings = warnings.filter((warning) => !warning.toLowerCase().includes("cert"));
  }

  const hasCatalogAnchor = Boolean(
    source === "ocr" && (fields.cardNumber || fields.year || fields.setName)
    || source === "psa_cert"
    || (fields.cardNumber && fields.year && aiDraft.confidence >= 0.82),
  );
  const pokemon = hasCatalogAnchor && (fields.game?.toLowerCase().includes("pokemon") || fields.cardName)
    ? await lookupPokemonCard(env, fields).catch(() => null)
    : null;
  if (!psa?.fields && pokemon?.fields) {
    fields = normalizeCardFields({ ...fields, ...definedCardFields(pokemon.fields) });
    source = source === "ocr" ? "ocr" : "pokemon_tcg_api";
    confidence = Math.max(confidence, pokemon.confidence);
  }

  const canonicalTitle = buildCardCanonicalTitle(fields);
  const searchQuery = buildCardSearchQuery(fields, canonicalTitle ?? aiDraft.searchQuery);
  const status = source === "psa_cert"
    ? "verified"
    : confidence >= 0.82 && fields.cardName && fields.cardNumber
      ? "verified"
      : "needs_confirmation";

  return ProductIdentitySchema.parse({
    vertical: fields.grader || fields.grade ? "graded_card" : "trading_card",
    source,
    confidence,
    status,
    canonicalTitle,
    searchQuery,
    fields,
    warnings: Array.from(new Set(identityWarnings(fields).concat(warnings))),
  });
}

function shouldRunCardOcr(fields: ProductIdentity["fields"]) {
  return !fields.certNumber || !fields.cardNumber || !fields.setName || !fields.year;
}

async function extractCardIdentityFromImages(env: Bindings, images: { id: string; dataUrl: string }[], operationContext: AiOperationContext) {
  if (images.length === 0) return null;
  const startedAt = Date.now();
  const model = env.OPENAI_DRAFT_MODEL ?? env.OPENAI_MODEL ?? DEFAULT_FAST_DRAFT_MODEL;
  const cacheKey = `card-ocr-v3:${images.map((image) => image.id).join(":")}`;
  const cached = await env.SESSION_KV.get(cacheKey, "json") as { fields?: Record<string, string | null>; warnings?: string[] } | null;
  if (cached) {
    await recordAiOperation(env, operationContext, {
      operation: "card_identity_ocr",
      model,
      latencyMs: Date.now() - startedAt,
      imageCount: images.length,
      imageDetail: "high",
      success: true,
      cacheHit: true,
      metadata: { cacheKey },
    }).catch((error) => console.warn("Could not record cached card OCR operation", error));
    return cached;
  }
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 900,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Extract exact trading-card slab/card label text from all supplied product photos.",
                "Prefer the clearest PSA/BGS/CGC/SGC label photo over card-art guesses.",
                "Return null for unreadable fields. Do not infer set, year, grade, cert number, or card number when not visible.",
                "For PSA labels, certNumber is usually the numeric value near the barcode and grade.",
                "Count every cert digit exactly, compare the number across all label photos, and never duplicate a trailing digit.",
              ].join(" "),
            },
            ...images.map((image) => ({
              type: "input_image",
              image_url: image.dataUrl,
              detail: "high",
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "card_identity_ocr",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["fields", "warnings"],
            properties: {
              fields: {
                type: "object",
                additionalProperties: false,
                required: ["grader", "certNumber", "grade", "game", "cardName", "setName", "cardNumber", "year", "parallel", "language"],
                properties: {
                  grader: { type: ["string", "null"] },
                  certNumber: { type: ["string", "null"] },
                  grade: { type: ["string", "null"] },
                  game: { type: ["string", "null"] },
                  cardName: { type: ["string", "null"] },
                  setName: { type: ["string", "null"] },
                  cardNumber: { type: ["string", "null"] },
                  year: { type: ["string", "null"] },
                  parallel: { type: ["string", "null"] },
                  language: { type: ["string", "null"] },
                },
              },
              warnings: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  }, 22_000, "OpenAI card OCR");
  if (!response.ok) {
    await recordAiOperation(env, operationContext, {
      operation: "card_identity_ocr",
      model,
      providerRequestId: response.headers.get("x-request-id"),
      latencyMs: Date.now() - startedAt,
      imageCount: images.length,
      imageDetail: "high",
      success: false,
      errorCode: `http_${response.status}`,
      metadata: { status: response.status },
    }).catch((error) => console.warn("Could not record failed card OCR operation", error));
    return null;
  }
  const payload = asRecord(await response.json().catch(() => ({}))) ?? {};
  const output = extractResponseText(payload);
  if (!output) {
    await recordAiOperation(env, operationContext, {
      operation: "card_identity_ocr",
      model,
      providerRequestId: response.headers.get("x-request-id"),
      responsePayload: payload,
      latencyMs: Date.now() - startedAt,
      imageCount: images.length,
      imageDetail: "high",
      success: false,
      errorCode: "empty_output",
    }).catch((error) => console.warn("Could not record empty card OCR operation", error));
    return null;
  }
  const parsed = parseStructuredJson<{ fields?: Record<string, string | null>; warnings?: string[] }>(payload, output);
  if (!parsed) {
    await recordAiOperation(env, operationContext, {
      operation: "card_identity_ocr",
      model,
      providerRequestId: response.headers.get("x-request-id"),
      responsePayload: payload,
      latencyMs: Date.now() - startedAt,
      imageCount: images.length,
      imageDetail: "high",
      success: false,
      errorCode: "malformed_output",
    }).catch((error) => console.warn("Could not record malformed card OCR operation", error));
    return null;
  }
  await recordAiOperation(env, operationContext, {
    operation: "card_identity_ocr",
    model,
    providerRequestId: response.headers.get("x-request-id"),
    responsePayload: payload,
    latencyMs: Date.now() - startedAt,
    imageCount: images.length,
    imageDetail: "high",
    success: true,
    metadata: { cacheKey },
  }).catch((error) => console.warn("Could not record card OCR operation", error));
  await env.SESSION_KV.put(cacheKey, JSON.stringify(parsed), { expirationTtl: 30 * 24 * 60 * 60 });
  return parsed;
}

async function lookupPsaCert(env: Bindings, certNumber: string) {
  if (!env.PSA_ACCESS_TOKEN) return null;
  const normalized = certNumber.replace(/\D/g, "");
  if (normalized.length < 6) return null;
  const cacheKey = `psa-cert:${normalized}`;
  const cached = await env.SESSION_KV.get(cacheKey, "json") as { fields?: Record<string, string | null> } | null;
  if (cached?.fields && (cached.fields.grade || cached.fields.cardName || cached.fields.cardNumber)) return cached;
  for (const candidate of psaCertCandidates(normalized)) {
    const response = await fetchWithTimeout(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(candidate)}`, {
      headers: {
        Authorization: `bearer ${env.PSA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }, 6_000, "PSA cert lookup");
    if (!response.ok) continue;
    const body = await response.json().catch(() => null);
    const flattened = flattenRecord(body);
    const description = firstStringByKey(flattened, ["ItemDescription", "Description"]);
    const grade = firstStringByKey(flattened, ["CardGrade", "GradeDescription", "Grade"]);
    const cardName = firstStringByKey(flattened, ["subject", "cardname", "name"]);
    if (!description && !grade && !cardName) continue;
    const parsedDescription = parsePsaItemDescription(description);
    const result = {
      fields: {
        grader: "PSA",
        certNumber: candidate,
        grade,
        game: parsedDescription.game ?? firstStringByKey(flattened, ["category", "brand", "sport"]),
        cardName: parsedDescription.cardName ?? cardName,
        setName: parsedDescription.setName ?? firstStringByKey(flattened, ["setname", "variety", "issue"]),
        cardNumber: parsedDescription.cardNumber ?? firstStringByKey(flattened, ["cardnumber", "cardno", "number"]),
        year: parsedDescription.year ?? firstStringByKey(flattened, ["year"]),
        parallel: parsedDescription.parallel ?? firstStringByKey(flattened, ["variety", "parallel"]),
        language: firstStringByKey(flattened, ["language"]),
      },
    };
    if (candidate !== normalized) {
      logWorkerItem("info", "card.psa_cert.corrected", {}, { suppliedCert: normalized, verifiedCert: candidate });
    }
    await Promise.all([
      env.SESSION_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 90 * 24 * 60 * 60 }),
      candidate === normalized
        ? Promise.resolve()
        : env.SESSION_KV.put(`psa-cert:${candidate}`, JSON.stringify(result), { expirationTtl: 90 * 24 * 60 * 60 }),
    ]);
    return result;
  }
  return null;
}

function psaCertCandidates(certNumber: string) {
  const candidates = [certNumber];
  if (
    certNumber.length >= 7
    && certNumber.at(-1) === certNumber.at(-2)
  ) {
    candidates.push(certNumber.slice(0, -1));
  }
  return candidates;
}

async function lookupPokemonCard(env: Bindings, fields: ProductIdentity["fields"]) {
  if (!fields.cardName) return null;
  const cardNumber = cleanCardNumber(fields.cardNumber);
  const exactParts = [`name:${escapePokemonQuery(fields.cardName)}`];
  if (cardNumber) exactParts.push(`number:${escapePokemonQuery(cardNumber)}`);
  if (fields.setName && !looksLikeGradingSetCode(fields.setName)) exactParts.push(`set.name:${escapePokemonQuery(fields.setName)}`);
  const query = exactParts.join(" ");
  const cacheKey = `pokemon-tcg:${query.toLowerCase()}`;
  const cached = await env.SESSION_KV.get(cacheKey, "json") as { fields?: Record<string, string | null>; confidence: number } | null;
  if (cached) return cached;
  const queries = Array.from(new Set([
    query,
    cardNumber ? `name:${escapePokemonQuery(fields.cardName)} number:${escapePokemonQuery(cardNumber)}` : "",
    fields.year ? `name:${escapePokemonQuery(fields.cardName)} set.releaseDate:[${fields.year}-01-01 TO ${fields.year}-12-31]` : "",
    `name:${escapePokemonQuery(fields.cardName)}`,
  ].filter(Boolean)));
  const cards = await searchPokemonCatalog(env, queries);
  const first = selectBestPokemonCard(cards, fields);
  const set = asRecord(first?.set);
  if (!first) return null;
  const result = {
    confidence: scorePokemonCard(first, fields),
    fields: {
      game: "Pokémon TCG",
      cardName: stringOr(first.name, null) ?? fields.cardName,
      setName: stringOr(set?.name, null) ?? fields.setName,
      cardNumber: stringOr(first.number, null) ?? fields.cardNumber,
      year: stringOr(set?.releaseDate, "").slice(0, 4) || fields.year,
    },
  };
  await env.SESSION_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 30 * 24 * 60 * 60 });
  return result;
}

async function searchPokemonCatalog(env: Bindings, queries: string[]) {
  const headers = new Headers();
  if (env.POKEMON_TCG_API_KEY) headers.set("X-Api-Key", env.POKEMON_TCG_API_KEY);
  for (const query of queries) {
    const url = new URL("https://api.pokemontcg.io/v2/cards");
    url.searchParams.set("q", query);
    url.searchParams.set("pageSize", "10");
    const response = await fetchWithTimeout(url, { headers }, 5_000, "Pokemon TCG catalog lookup");
    if (!response.ok) continue;
    const payload = asRecord(await response.json().catch(() => ({})));
    const cards = Array.isArray(payload?.data)
      ? payload.data.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item))
      : [];
    if (cards.length > 0) return cards;
  }
  return [];
}

function selectBestPokemonCard(cards: Record<string, unknown>[], fields: ProductIdentity["fields"]) {
  return cards
    .map((card) => ({ card, score: scorePokemonCard(card, fields) }))
    .sort((left, right) => right.score - left.score)[0]?.card ?? null;
}

function scorePokemonCard(card: Record<string, unknown>, fields: ProductIdentity["fields"]) {
  const set = asRecord(card.set);
  let score = 0.55;
  if (fields.cardName && normalizeSearchText(stringOr(card.name, "")).includes(normalizeSearchText(fields.cardName))) score += 0.12;
  if (fields.cardNumber && cleanCardNumber(fields.cardNumber) === cleanCardNumber(stringOr(card.number, ""))) score += 0.18;
  if (fields.setName && stringOr(set?.name, null) && normalizeSearchText(stringOr(set?.name, "")).includes(normalizeSearchText(fields.setName))) score += 0.1;
  if (fields.year && stringOr(set?.releaseDate, "").startsWith(fields.year)) score += 0.08;
  return roundMoney(Math.min(score, 0.92));
}

async function searchMarketComparables(
  env: Bindings,
  input: {
    identity: ProductIdentity;
    image: { id: string; dataUrl: string } | null;
    marketplaceId: string;
    queries: string[];
  },
): Promise<ComparableSearchResult> {
  const token = await getEbayAppToken(env);
  const candidates = dedupeQueries(input.queries).slice(0, 3);
  const localSignalQuery = candidates[0] ?? input.queries.find((query) => query.trim()) ?? "";
  const [textResults, imageResults, localSignals] = await Promise.all([
    Promise.allSettled(candidates.map((query) => searchComparableQuery(env, token, query, input.marketplaceId))),
    input.image ? searchEbayByImage(env, token, input.image, input.marketplaceId).catch(() => []) : Promise.resolve([]),
    input.identity.vertical === "general" && localSignalQuery
      ? searchOfferUpSignals(env, localSignalQuery).catch(() => [])
      : Promise.resolve([]),
  ]);
  const combined = dedupeComparables([
    ...imageResults,
    ...textResults.flatMap((result) => result.status === "fulfilled" ? result.value : []),
  ]);

  if (input.identity.vertical === "general") {
    const accepted = combined.slice(0, 8).map((item) => ({ ...item, matchScore: item.matchScore ?? 0.5, source: item.source ?? "ebay_active" as const }));
    const localMarketSignals = dedupeComparables(localSignals)
      .slice(0, LOCAL_MARKET_SIGNAL_LIMIT)
      .map((item) => ({
        ...item,
        source: "offerup_active" as const,
        rejectionReason: item.rejectionReason ?? "Local asking-price signal only; not used for auto-publish pricing.",
      }));
    return {
      accepted,
      rejected: localMarketSignals,
      evidence: PricingEvidenceSchema.parse({
        source: "filtered_ebay_active",
        confidence: accepted.length >= 3 ? 0.62 : 0.35,
        exactMatchCount: accepted.length,
        rejectedCount: localMarketSignals.length,
        notes: [
          input.image ? "Used eBay image search plus keyword search." : "Used eBay keyword search.",
          ...(localMarketSignals.length
            ? [`Added ${localMarketSignals.length} OfferUp asking-price signal${localMarketSignals.length === 1 ? "" : "s"} for seller context only.`]
            : []),
        ],
      }),
    };
  }

  const scored = combined.map((item) => scoreCardComparable(item, input.identity));
  const hasVerifiedIdentity = input.identity.status === "verified";
  const accepted = scored
    .filter((item) => !item.rejectionReason && (item.matchScore ?? 0) >= (hasVerifiedIdentity ? 0.78 : 0.9))
    .slice(0, 8);
  const rejected = scored
    .filter((item) => item.rejectionReason || (item.matchScore ?? 0) < 0.78)
    .slice(0, 12);
  return {
    accepted,
    rejected,
    evidence: PricingEvidenceSchema.parse({
      source: accepted.length > 0 ? "exact_ebay_active" : "ai_fallback",
      confidence: hasVerifiedIdentity && accepted.length >= 3 ? 0.78 : hasVerifiedIdentity && accepted.length >= 2 ? 0.62 : 0.22,
      exactMatchCount: accepted.length,
      rejectedCount: rejected.length,
      notes: [
        "Used eBay image search as a primary signal and intersected it with AI/card identity fields.",
        ...(accepted.length < 2 ? ["Not enough exact card matches; seller should confirm price before publishing."] : []),
      ],
    }),
  };
}

async function searchEbayByImage(
  env: Bindings,
  token: string,
  image: { id: string; dataUrl: string },
  marketplaceId: string,
) {
  const cacheKey = `ebay-image-search:${image.id}`;
  const cached = await env.SESSION_KV.get(cacheKey, "json") as MarketComparable[] | null;
  if (cached) return cached;
  const url = new URL("/buy/browse/v1/item_summary/search_by_image", getEbayApiBaseUrl(env));
  url.searchParams.set("limit", String(CARD_IMAGE_SEARCH_LIMIT));
  url.searchParams.set("fieldgroups", "MATCHING_ITEMS");
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
    },
    body: JSON.stringify({ image: image.dataUrl.replace(/^data:[^;]+;base64,/, "") }),
  }, EBAY_FAST_LOOKUP_TIMEOUT_MS, "eBay image search");
  if (!response.ok) return [];
  const payload = asRecord(await response.json().catch(() => ({})));
  const items = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
  const comparables = items.map((item: unknown) => comparableFromEbayItem(item, "ebay_active" as const)).filter(Boolean) as MarketComparable[];
  await env.SESSION_KV.put(cacheKey, JSON.stringify(comparables), { expirationTtl: 6 * 60 * 60 });
  return comparables;
}

async function searchOfferUpSignals(env: Bindings, query: string): Promise<MarketComparable[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const cacheKey = `offerup-signal:${normalizedQuery}`;
  const cached = await env.SESSION_KV.get(cacheKey, "json") as MarketComparable[] | null;
  if (cached) return cached;

  const location = offerUpLocation(env);
  const url = new URL("https://offerup.com/search");
  url.searchParams.set("q", query);
  const headers: Record<string, string> = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  };
  if (location) {
    url.searchParams.set("radius", String(location.radiusMiles));
    headers.Cookie = `ou.location=${encodeURIComponent(JSON.stringify(location.cookie))}`;
  }
  const response = await fetchWithTimeout(url, {
    headers,
  }, EXTERNAL_MARKET_LOOKUP_TIMEOUT_MS, "OfferUp local market search");
  if (!response.ok) return [];
  const html = await response.text();
  const payload = extractNextDataPayload(html);
  const listings = collectOfferUpListings(payload);
  const comparables = dedupeComparables(listings
    .map((listing) => comparableFromOfferUpListing(listing, normalizedQuery))
    .filter((item): item is MarketComparable => Boolean(item))
    .filter((item) => (item.matchScore ?? 0) >= 0.24))
    .slice(0, LOCAL_MARKET_SIGNAL_LIMIT);
  await env.SESSION_KV.put(cacheKey, JSON.stringify(comparables), { expirationTtl: 6 * 60 * 60 });
  return comparables;
}

function offerUpLocation(env: Bindings) {
  // Location must be explicitly configured; a fabricated default city
  // would silently skew local asking-price signals for every seller.
  const latitude = Number.parseFloat(env.OFFERUP_DEFAULT_LATITUDE ?? "");
  const longitude = Number.parseFloat(env.OFFERUP_DEFAULT_LONGITUDE ?? "");
  const city = env.OFFERUP_DEFAULT_CITY;
  const state = env.OFFERUP_DEFAULT_STATE;
  const postalCode = env.OFFERUP_DEFAULT_ZIP;
  if (!city || !state || !postalCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const radiusMiles = Number.parseInt(env.OFFERUP_RADIUS_MILES ?? "30", 10);
  return {
    radiusMiles: Number.isFinite(radiusMiles) ? radiusMiles : 30,
    cookie: { city, state, postalCode, latitude, longitude },
  };
}

function extractNextDataPayload(html: string) {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  return safeJsonParse(match[1].trim());
}

function collectOfferUpListings(value: unknown, output: Record<string, unknown>[] = []) {
  const record = asRecord(value);
  if (record?.__typename === "ModularFeedListing" && stringOr(record.title, "")) {
    output.push(record);
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOfferUpListings(item, output);
  } else if (record) {
    for (const item of Object.values(record)) collectOfferUpListings(item, output);
  }
  return output;
}

function comparableFromOfferUpListing(listing: Record<string, unknown>, normalizedQuery: string): MarketComparable | null {
  const listingId = stringOr(listing.listingId, null) ?? stringOr(listing.id, null);
  const title = stringOr(listing.title, "");
  if (!title) return null;
  const price = parseOfferUpPrice(listing.price);
  const image = asRecord(listing.image);
  const imageUrl = stringOr(image?.url, null) ?? stringOr(image?.imageUrl, null);
  const locationName = stringOr(listing.locationName, null) ?? stringOr(asRecord(listing.location)?.name, null);
  const urlPath = stringOr(listing.url, null) ?? stringOr(listing.itemWebUrl, null);
  const itemWebUrl = urlPath?.startsWith("http")
    ? urlPath
    : listingId
      ? `https://offerup.com/item/detail/${listingId}`
      : "";
  return {
    itemId: listingId ? `offerup:${listingId}` : undefined,
    title,
    itemWebUrl,
    imageUrl,
    condition: locationName ? `Local listing near ${locationName}` : "Local marketplace listing",
    totalPrice: price,
    matchScore: titleSimilarity(normalizedQuery, normalizeSearchText(title)),
    rejectionReason: "Local asking-price signal only; not used for auto-publish pricing.",
    source: "offerup_active",
  };
}

function parseOfferUpPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return roundMoney(value);
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
    return match?.[1] ? roundMoney(Number.parseFloat(match[1])) : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  return numberOrNull(record.amount)
    ?? numberOrNull(record.value)
    ?? numberOrNull(record.price)
    ?? parseOfferUpPrice(record.display)
    ?? parseOfferUpPrice(record.formattedAmount);
}

function titleSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return roundMoney(overlap / Math.max(leftTokens.size, rightTokens.size));
}

function dedupeComparables(items: MarketComparable[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = comparableDedupeKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function comparableDedupeKey(item: MarketComparable) {
  if (item.itemId) return `id:${item.itemId.toLowerCase()}`;
  const itemUrlId = item.itemWebUrl.match(/\/itm\/(?:[^/?#]+\/)?(\d+)/i)?.[1];
  if (itemUrlId) return `url-id:${itemUrlId}`;
  try {
    const url = new URL(item.itemWebUrl);
    return `url:${url.origin}${url.pathname}`.toLowerCase();
  } catch {
    return `title:${normalizeSearchText(item.title)}:${item.totalPrice ?? "unknown"}`;
  }
}

async function searchComparableQuery(env: Bindings, token: string, query: string, marketplaceId: string) {
  const url = new URL("/buy/browse/v1/item_summary/search", getEbayApiBaseUrl(env));
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "25");
  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
    },
  }, EBAY_FAST_LOOKUP_TIMEOUT_MS, "eBay comparable search");
  if (!response.ok) return [];
  const payload = asRecord(await response.json().catch(() => ({})));
  const items = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
  if (items.length === 0) return [];
  return items.map((item: unknown) => comparableFromEbayItem(item, "ebay_active" as const)).filter(Boolean) as MarketComparable[];
}

function comparableFromEbayItem(item: unknown, source: "ebay_active" | "ebay_sold") {
  const record = asRecord(item) ?? {};
  const price = asRecord(record.price);
  const image = asRecord(record.image);
  const thumbnailImages = Array.isArray(record.thumbnailImages) ? record.thumbnailImages : [];
  const firstThumbnail = asRecord(thumbnailImages[0]);
  const shippingOptions = Array.isArray(record.shippingOptions) ? record.shippingOptions : [];
  const firstShipping = asRecord(shippingOptions[0]);
  const shippingCost = asRecord(firstShipping?.shippingCost);
  const itemPrice = numberOrNull(price?.value);
  const shipPrice = numberOrNull(shippingCost?.value) ?? 0;
  const totalPrice = itemPrice === null ? null : roundMoney(itemPrice + shipPrice);
  return {
    itemId: stringOr(record.itemId, null) ?? stringOr(record.legacyItemId, null) ?? undefined,
    title: stringOr(record.title, "Comparable"),
    itemWebUrl: stringOr(record.itemWebUrl, ""),
    imageUrl: stringOr(image?.imageUrl, null) ?? stringOr(firstThumbnail?.imageUrl, null),
    condition: stringOr(record.condition, null),
    totalPrice,
    source,
  };
}

function scoreCardComparable(item: MarketComparable, identity: ProductIdentity): MarketComparable {
  const title = normalizeSearchText(item.title);
  const fields = identity.fields;
  let score = 0;
  const rejectionReasons: string[] = [];

  if (fields.cardName && title.includes(normalizeSearchText(fields.cardName))) score += 0.24;
  else if (fields.cardName) rejectionReasons.push(`card name mismatch: expected ${fields.cardName}`);

  const cardNumber = cleanCardNumber(fields.cardNumber);
  if (cardNumber && title.includes(normalizeSearchText(cardNumber))) score += 0.22;
  else if (cardNumber) rejectionReasons.push(`card number mismatch: expected ${cardNumber}`);

  if (fields.setName) {
    if (title.includes(normalizeSearchText(fields.setName))) score += 0.16;
    else if (looksLikeNamedSet(fields.setName) || looksLikeGradingSetCode(fields.setName)) rejectionReasons.push(`set/code mismatch: expected ${fields.setName}`);
  }
  if (fields.year && title.includes(fields.year)) score += 0.08;
  if (fields.grader && title.includes(fields.grader.toLowerCase())) score += 0.12;
  else if (fields.grader) rejectionReasons.push(`grader mismatch: expected ${fields.grader}`);

  if (fields.grade) {
    const expectedGrade = normalizeGrade(fields.grade);
    const titleGrade = extractTitleGrade(title);
    if (titleGrade && titleGrade !== expectedGrade) rejectionReasons.push(`grade mismatch: expected ${expectedGrade}, saw ${titleGrade}`);
    if (titleGrade === expectedGrade) score += 0.18;
  }

  if (fields.parallel && title.includes(normalizeSearchText(fields.parallel))) score += 0.06;
  if (fields.language?.toLowerCase() === "english" && /\bjapanese\b|\bjp\b|\bjpn\b/.test(title)) {
    rejectionReasons.push("language mismatch: expected English");
  }
  if (fields.language?.toLowerCase() === "japanese" && /\benglish\b|\ben\b/.test(title)) {
    rejectionReasons.push("language mismatch: expected Japanese");
  }
  if (item.source === "ebay_active") score += 0.04;

  if (identity.vertical !== "general" && identity.status !== "verified") {
    rejectionReasons.push("identity is not verified enough for pricing");
  }

  return {
    ...item,
    matchScore: roundMoney(Math.min(score, 1)),
    rejectionReason: rejectionReasons.length > 0 ? rejectionReasons.join("; ") : null,
  };
}

function mergeIdentitySpecifics(itemSpecifics: { name: string; value: string }[], identity: ProductIdentity) {
  if (identity.vertical === "general") return itemSpecifics;
  const map = new Map(itemSpecifics.map((item) => [item.name.toLowerCase(), item]));
  // Canonical aspect name -> identity value, plus AI-authored aliases that
  // must not survive alongside (or instead of) the canonical aspect.
  const entries: [string, string | null | undefined, string[]][] = [
    ["Professional Grader", identity.fields.grader, ["grader"]],
    ["Certification Number", identity.fields.certNumber, ["cert number", "cert #"]],
    ["Grade", identity.fields.grade, ["card grade"]],
    ["Game", identity.fields.game, []],
    ["Card Name", identity.fields.cardName, ["character"]],
    ["Set", identity.fields.setName, ["set name"]],
    ["Card Number", identity.fields.cardNumber, ["card #"]],
    ["Year Manufactured", identity.fields.year, ["year"]],
    ["Parallel/Variety", identity.fields.parallel, ["parallel", "variety", "finish"]],
    ["Language", identity.fields.language, []],
  ];
  const verified = identity.status === "verified";
  for (const [name, value, aliases] of entries) {
    for (const alias of aliases) map.delete(alias);
    if (value) {
      map.set(name.toLowerCase(), { name, value });
    } else if (verified) {
      // The identity source examined this card and could not confirm the
      // field. An unconfirmed AI guess must not ship as fact — drop it and
      // let the required-aspect blocker flow ask the seller instead.
      map.delete(name.toLowerCase());
    }
  }
  return Array.from(map.values());
}

function normalizeCardFields(raw: Record<string, unknown>): ProductIdentity["fields"] {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const direct = cleanExtractedField(stringOr(raw[key], null));
      if (direct) return direct;
      const found = Object.entries(raw).find(([name]) => normalizeSearchText(name) === normalizeSearchText(key));
      const value = found ? cleanExtractedField(stringOr(found[1], null)) : null;
      if (value) return value;
    }
    return null;
  };
  let game = get("game", "sport", "category");
  let setName = get("setName", "Set", "set", "issue");
  let language = get("language");
  let year = get("year", "Year Manufactured", "release year");
  const gameLabelMatch = game?.match(/\b((?:19|20)\d{2})\s+pok[eé]mon\s+(.+)$/i);
  if (gameLabelMatch) {
    year = year ?? gameLabelMatch[1];
    setName = setName ?? gameLabelMatch[2]?.trim() ?? null;
    game = "Pokémon TCG";
  }
  if (setName && /^pok[eé]mon\s+/i.test(setName)) {
    game = game && !isGenericCardGame(game) ? game : "Pokémon TCG";
    setName = setName.replace(/^pok[eé]mon\s+/i, "").trim();
  }
  if (setName && /\bEN\b/i.test(setName)) language = normalizeLanguage(language) ?? "English";
  else if (setName && /\bJP\b|\bJPN\b/i.test(setName)) language = normalizeLanguage(language) ?? "Japanese";
  else language = normalizeLanguage(language);
  return ProductIdentitySchema.shape.fields.parse({
    grader: normalizeGrader(get("grader", "professional grader")),
    certNumber: get("certNumber", "Certification Number", "cert", "certification"),
    grade: get("grade", "card grade"),
    game,
    cardName: get("cardName", "Card Name", "character", "subject", "name"),
    setName,
    cardNumber: get("cardNumber", "Card Number", "card no", "number"),
    year,
    parallel: get("parallel", "Parallel/Variety", "variety", "rarity"),
    language,
  });
}

function normalizeLanguage(value: string | null) {
  const normalized = normalizeSearchText(value ?? "");
  if (!normalized) return null;
  if (normalized === "en" || normalized === "eng" || normalized === "english") return "English";
  if (normalized === "jp" || normalized === "jpn" || normalized === "japanese") return "Japanese";
  return value;
}

function definedCardFields(fields: Partial<ProductIdentity["fields"]>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  ) as Record<string, string>;
}

function cleanExtractedField(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = normalizeSearchText(trimmed);
  if (
    normalized === "null"
    || normalized === "unknown"
    || normalized === "not readable"
    || normalized === "not visible"
    || normalized === "unreadable"
    || normalized.includes("not readable from")
    || normalized.includes("cannot determine")
    || normalized.includes("not confirmed")
  ) {
    return null;
  }
  return trimmed;
}

function isGenericCardGame(value: string | null | undefined) {
  const normalized = normalizeSearchText(value ?? "");
  return normalized === "tcg cards" || normalized === "trading cards" || normalized === "cards";
}

function identityWarnings(fields: ProductIdentity["fields"]) {
  const warnings: string[] = [];
  if (fields.grader && !fields.certNumber) warnings.push("Readable certification number is missing.");
  if (!fields.cardNumber) warnings.push("Exact card number is missing.");
  if (!fields.setName) warnings.push("Exact set name is missing.");
  if (!fields.cardName) warnings.push("Exact card name is missing.");
  return warnings;
}

function buildCardCanonicalTitle(fields: ProductIdentity["fields"]) {
  if (!fields.cardName) return null;
  const game = fields.game?.toLowerCase().includes("pokemon") ? "Pokemon" : fields.game;
  const cardName = titleCaseCardText(fields.cardName);
  const parallel = fields.parallel && !normalizeSearchText(cardName).includes(normalizeSearchText(fields.parallel))
    ? fields.parallel
    : null;
  return [
    fields.grader,
    fields.grade ? normalizeGrade(fields.grade) : null,
    fields.year,
    game,
    fields.setName,
    cardName,
    fields.cardNumber ? `#${cleanCardNumber(fields.cardNumber)}` : null,
    parallel,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function titleCaseCardText(value: string) {
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function buildCardSearchQuery(fields: ProductIdentity["fields"], fallback: string) {
  const canonical = buildCardCanonicalTitle(fields);
  return canonical || fallback;
}

function isCardLikeText(text: string) {
  const normalized = normalizeSearchText(text);
  return /\b(pokemon|pokémon|tcg|psa|bgs|cgc|sgc|gem mt|graded|card number|wartortle|baseball card|sports card)\b/.test(normalized);
}

function looksLikeGradingSetCode(value: string) {
  return /^[A-Z0-9]{2,6}(?:\s+[A-Z]{2})?$/i.test(value.trim());
}

function looksLikeNamedSet(value: string) {
  const normalized = normalizeSearchText(value);
  return normalized.split(/\s+/).length > 1 && !looksLikeGradingSetCode(value);
}

function normalizeGrader(value: string | null) {
  const normalized = normalizeSearchText(value ?? "");
  if (!normalized) return null;
  if (normalized.includes("psa")) return "PSA";
  if (normalized.includes("bgs") || normalized.includes("beckett")) return "BGS";
  if (normalized.includes("cgc")) return "CGC";
  if (normalized.includes("sgc")) return "SGC";
  return value;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9./]+/g, " ").trim();
}

function cleanCardNumber(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/^#/, "").split(/\s+/)[0]?.trim() || null;
}

function normalizeGrade(value: string) {
  const normalized = value.toUpperCase().replace("GEM MT", "").replace("MINT", "").trim();
  const number = normalized.match(/\d+(?:\.\d+)?/)?.[0];
  return number ?? normalized;
}

function extractTitleGrade(title: string) {
  const match = title.match(/\b(?:psa|bgs|cgc|sgc)\s*(?:gem\s*mt\s*)?(\d+(?:\.\d+)?)\b/i);
  return match?.[1] ?? null;
}

function escapePokemonQuery(value: string) {
  return value.replace(/["\\]/g, " ").trim();
}

function flattenRecord(value: unknown, prefix = "", out: Record<string, string> = {}) {
  if (!value || typeof value !== "object") return out;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = `${prefix}${key}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (typeof item === "string" || typeof item === "number") {
      out[nextKey] = String(item);
    } else if (item && typeof item === "object") {
      flattenRecord(item, nextKey, out);
    }
  }
  return out;
}

function firstStringByKey(record: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = Object.entries(record).find(([candidate]) => candidate.endsWith(normalized) || candidate.includes(normalized));
    if (match?.[1]) return match[1];
  }
  return null;
}

function parsePsaItemDescription(description: string | null) {
  if (!description) {
    return {
      year: null,
      game: null,
      setName: null,
      cardName: null,
      cardNumber: null,
      parallel: null,
    };
  }
  const year = description.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
  const cardNumber = description.match(/#\s*([A-Z0-9.-]+(?:\/[A-Z0-9.-]+)?)/i)?.[1] ?? null;
  const withoutGradeWords = description
    .replace(/\bGEM\s*MT\b/gi, " ")
    .replace(/\bMINT\b/gi, " ")
    .replace(/\bPSA\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\b\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = withoutGradeWords.split(/\s+/);
  const pokemonIndex = tokens.findIndex((token) => /^pokemon$/i.test(token) || /^pokémon$/i.test(token));
  const game = pokemonIndex >= 0 ? "Pokémon TCG" : null;
  const afterGame = pokemonIndex >= 0 ? tokens.slice(pokemonIndex + 1) : tokens;
  const cleaned = afterGame.join(" ").replace(/#\s*[A-Z0-9.-]+(?:\/[A-Z0-9.-]+)?/gi, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const cardName = words.length ? words[words.length - 1] : null;
  const setName = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  return {
    year,
    game,
    setName,
    cardName,
    cardNumber,
    parallel: /\b(reverse|holo|foil|refractor|prizm|silver|alt art|illustration rare|special illustration)\b/i.exec(description)?.[0] ?? null,
  };
}

function buildCardNeedsReviewPricing(preferredStrategy: PricingStrategy) {
  const options = [
    {
      strategy: "fast_sale" as const,
      label: "Fast sale",
      price: 0,
      speedBand: "Locked until exact card identity and comps are verified",
      rationale: "The app found this is a trading card, but will not price it until exact card identity and comps are confirmed.",
    },
    {
      strategy: "balanced" as const,
      label: "Balanced",
      price: 0,
      speedBand: "Locked until exact card identity and comps are verified",
      rationale: "Avoids publishing with a hallucinated set, card number, grade, or comparable price.",
    },
    {
      strategy: "max_profit" as const,
      label: "Max profit",
      price: 0,
      speedBand: "Locked until exact card identity and comps are verified",
      rationale: "Max-profit pricing needs trustworthy exact-match evidence first.",
    },
  ];
  return {
    sampleSize: 0,
    rangeLow: 0,
    rangeMedian: 0,
    rangeHigh: 0,
    recommendedStrategy: preferredStrategy,
    options,
  };
}

function buildPricingSuggestions(
  comparables: { title: string; itemWebUrl: string; condition: string | null; totalPrice: number | null }[],
  fallbackFloor: number | null,
  preferredStrategy: PricingStrategy,
  recommendedMode: "fixed_price" | "auction",
) {
  const totals = comparables
    .map((item) => item.totalPrice)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (totals.length === 0 && fallbackFloor === null) {
    // No comps and no AI estimate: never invent a price. Surface locked
    // options so the seller sets the price deliberately.
    const lockedRationale = "No comparable listings or AI price estimate were found. Set your price before publishing.";
    return {
      sampleSize: 0,
      rangeLow: 0,
      rangeMedian: 0,
      rangeHigh: 0,
      recommendedStrategy: preferredStrategy,
      options: (["fast_sale", "balanced", "max_profit"] as const).map((strategy) => ({
        strategy,
        label: strategy === "fast_sale" ? "Fast sale" : strategy === "balanced" ? "Balanced" : "Max profit",
        price: 0,
        speedBand: "Locked until you set a price",
        rationale: lockedRationale,
      })),
    };
  }
  const floor = fallbackFloor ?? 0;
  const low = totals.length ? quantile(totals, 0.25) : roundMoney(floor * 0.92);
  const median = totals.length ? quantile(totals, 0.5) : floor;
  const high = totals.length ? quantile(totals, 0.75) : roundMoney(floor * 1.08);
  const options = [
    {
      strategy: "fast_sale" as const,
      label: "Fast sale",
      price: roundMoney(low),
      speedBand: recommendedMode === "auction" ? "Likely quickest with early bidder traction" : "Likely quickest sell-through",
      rationale: "Priced near the low end of current comps to prioritize speed.",
    },
    {
      strategy: "balanced" as const,
      label: "Balanced",
      price: roundMoney(median),
      speedBand: "Balanced speed and profit",
      rationale: "Priced near the median comparable listing range.",
    },
    {
      strategy: "max_profit" as const,
      label: "Max profit",
      price: roundMoney(high),
      speedBand: "Highest upside, slower sell-through",
      rationale: "Priced near the top of current comparables for higher margin.",
    },
  ];
  return {
    sampleSize: totals.length,
    rangeLow: roundMoney(low),
    rangeMedian: roundMoney(median),
    rangeHigh: roundMoney(high),
    recommendedStrategy: preferredStrategy,
    options,
  };
}

async function exchangeSellerAuthorizationCode(env: Bindings, code: string) {
  const response = await fetchWithTimeout(`${getEbayApiBaseUrl(env)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64Encode(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.EBAY_RUNAME,
    }),
  }, EBAY_SELLER_REQUEST_TIMEOUT_MS, "eBay token exchange");
  if (!response.ok) {
    throw new Error(`eBay token exchange failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

async function fetchSellerIdentity(env: Bindings, accessToken: string) {
  const response = await fetch(`${getEbayApiBaseUrl(env)}/commerce/identity/v1/user/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.ok) {
    return response.json() as Promise<{ username?: string; userId?: string }>;
  }

  const tradingResponse = await fetch(`${getEbayApiBaseUrl(env)}/ws/api.dll`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetUser",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1227",
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-IAF-TOKEN": accessToken,
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
      <GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
        <Version>1227</Version>
        <DetailLevel>ReturnAll</DetailLevel>
      </GetUserRequest>`,
  });
  const tradingXml = await tradingResponse.text();
  const username = tradingXml.match(/<UserID>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/UserID>/s)?.[1]?.trim();
  if (!tradingResponse.ok || !username) {
    throw new Error(`eBay identity lookup failed: Identity HTTP ${response.status}; Trading HTTP ${tradingResponse.status}`);
  }
  return { username, userId: username };
}

async function upsertUser(env: Bindings, sellerUsername: string, ebayUserId: string | null, now: string) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE seller_username = ?")
    .bind(sellerUsername).first<{ id: string }>();
  if (existing?.id) {
    await env.DB.prepare("UPDATE users SET ebay_user_id = ?, updated_at = ? WHERE id = ?")
      .bind(ebayUserId, now, existing.id).run();
    return existing.id;
  }
  const userId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id, seller_username, ebay_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(userId, sellerUsername, ebayUserId, now, now).run();
  return userId;
}

async function upsertSellerAccount(
  env: Bindings,
  input: {
    userId: string;
    sellerUsername: string;
    ebayUserId: string | null;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
  },
) {
  const now = new Date().toISOString();
  const accessTokenCipher = await encryptSecret(getAppEncryptionSecret(env), input.accessToken);
  const refreshTokenCipher = await encryptSecret(getAppEncryptionSecret(env), input.refreshToken);
  const existing = await env.DB.prepare("SELECT id FROM seller_accounts WHERE seller_username = ?")
    .bind(input.sellerUsername).first<{ id: string }>();
  if (existing?.id) {
    await env.DB.prepare(
      "UPDATE seller_accounts SET user_id = ?, ebay_user_id = ?, access_token_cipher = ?, refresh_token_cipher = ?, access_token_expires_at = ?, updated_at = ? WHERE id = ?",
    ).bind(
      input.userId,
      input.ebayUserId,
      accessTokenCipher,
      refreshTokenCipher,
      input.accessTokenExpiresAt,
      now,
      existing.id,
    ).run();
    return existing.id;
  }
  const sellerAccountId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO seller_accounts (id, user_id, seller_username, ebay_user_id, access_token_cipher, refresh_token_cipher, access_token_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    sellerAccountId,
    input.userId,
    input.sellerUsername,
    input.ebayUserId,
    accessTokenCipher,
    refreshTokenCipher,
    input.accessTokenExpiresAt,
    now,
    now,
  ).run();
  return sellerAccountId;
}

async function getSellerAccessToken(env: Bindings, seller: SellerAccountRecord) {
  const now = Date.now();
  if (seller.access_token_cipher && seller.access_token_expires_at && Date.parse(seller.access_token_expires_at) > now + 60_000) {
    return decryptSecret(getAppEncryptionSecret(env), seller.access_token_cipher);
  }
  const refreshToken = seller.refresh_token_cipher
    ? await decryptSecret(getAppEncryptionSecret(env), seller.refresh_token_cipher)
    : "";
  if (!refreshToken) {
    throw new Error("Seller OAuth refresh token is unavailable.");
  }
  const response = await fetchWithTimeout(`${getEbayApiBaseUrl(env)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64Encode(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.account",
        "https://api.ebay.com/oauth/api_scope/sell.inventory",
      ].join(" "),
    }),
  }, EBAY_SELLER_REQUEST_TIMEOUT_MS, "eBay access token refresh");
  if (!response.ok) {
    throw new Error(`eBay access token refresh failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json() as { access_token: string; expires_in?: number };
  const accessTokenCipher = await encryptSecret(getAppEncryptionSecret(env), payload.access_token);
  await env.DB.prepare(
    "UPDATE seller_accounts SET access_token_cipher = ?, access_token_expires_at = ?, updated_at = ? WHERE id = ?",
  ).bind(
    accessTokenCipher,
    new Date(Date.now() + Math.max((payload.expires_in ?? 7200) - 60, 60) * 1000).toISOString(),
    new Date().toISOString(),
    seller.id,
  ).run();
  return payload.access_token;
}

async function ebaySellerRequest(env: Bindings, accessToken: string, path: string, init: RequestInit, marketplaceId: string) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-EBAY-C-MARKETPLACE-ID", marketplaceId);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (path.startsWith("/sell/inventory/") && init.body !== undefined && !headers.has("Content-Language")) {
    headers.set("Content-Language", "en-US");
  }
  const response = await fetchWithTimeout(`${getEbayApiBaseUrl(env)}${path}`, {
    ...init,
    headers,
  }, EBAY_SELLER_REQUEST_TIMEOUT_MS, `eBay seller API ${path}`);
  if (!response.ok) {
    throw new Error(`eBay seller API failed for ${path}: ${response.status} ${await response.text()}`);
  }
  return response;
}

let ebayAppTokenCache: { token: string | null; expiresAt: number } = { token: null, expiresAt: 0 };

async function getEbayAppToken(env: Bindings) {
  if (ebayAppTokenCache.token && Date.now() < ebayAppTokenCache.expiresAt) {
    return ebayAppTokenCache.token;
  }
  const response = await fetchWithTimeout(`${getEbayApiBaseUrl(env)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64Encode(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  }, EBAY_FAST_LOOKUP_TIMEOUT_MS, "eBay app token request");
  if (!response.ok) {
    throw new Error(`eBay app token request failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json() as { access_token: string; expires_in?: number };
  ebayAppTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max((payload.expires_in ?? 7200) - 300, 60) * 1000,
  };
  return payload.access_token;
}

function getEbayApiBaseUrl(env: Bindings) {
  return env.EBAY_USE_SANDBOX === "true" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function getEbayAuthBaseUrl(env: Bindings) {
  return env.EBAY_USE_SANDBOX === "true" ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
}

function dedupeQueries(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .flatMap((value) => [value, value.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim(), value.split(/\s+/).slice(0, 6).join(" ")])
    .filter(Boolean)
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output
    .flatMap((item: Record<string, unknown>) => Array.isArray(item.content) ? item.content : [])
    .map((content: Record<string, unknown>) => typeof content.text === "string" ? content.text : "")
    .join("")
    .trim();
}

function parseStructuredJson<T>(payload: Record<string, unknown>, outputText?: string | null): T | null {
  const parsed = findParsedResponseObject(payload);
  if (parsed) return parsed as T;
  if (!outputText?.trim()) return null;
  const direct = parseJsonValue(outputText);
  if (direct) return direct as T;
  const fenced = outputText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const fromFence = parseJsonValue(fenced);
  if (fromFence) return fromFence as T;
  const objectText = extractFirstJsonObject(outputText);
  const fromObject = objectText ? parseJsonValue(objectText) : null;
  return fromObject ? fromObject as T : null;
}

function findParsedResponseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.parsed && typeof record.parsed === "object" && !Array.isArray(record.parsed)) {
    return record.parsed as Record<string, unknown>;
  }
  if (record.json && typeof record.json === "object" && !Array.isArray(record.json)) {
    return record.json as Record<string, unknown>;
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findParsedResponseObject(item);
        if (found) return found;
      }
    } else if (child && typeof child === "object") {
      const found = findParsedResponseObject(child);
      if (found) return found;
    }
  }
  return null;
}

function parseJsonValue(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractFirstJsonObject(value: string) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return value.slice(start, index + 1);
      }
    }
  }
  return null;
}

function createFallbackListingDraft(
  images: { id: string }[],
  pricingStrategy: PricingStrategy,
  reason: string,
): SellerAiDraftOutput {
  const leadPhotoId = images[0]?.id;
  return {
    titleOptions: [
      { title: "Product Listing - Review Needed", rationale: reason },
      { title: "Seller-Reviewed Product Listing", rationale: "Use this only after confirming item identity." },
      { title: "Photo-Based Product Listing", rationale: "Fallback draft created so the queue remains editable." },
    ],
    searchQuery: "product listing",
    categoryGuessText: "Collectibles",
    condition: "Used",
    conditionNotes: "Review the photos and confirm exact condition before publishing.",
    description: [
      "Photo-based listing draft created for seller review.",
      "- Confirm exact product identity before publishing.",
      "- Confirm condition, included items, and price.",
      "- Photos should remain buyer-honest and show the actual item.",
    ].join("\n"),
    confidence: 0.18,
    suggestedPriceFloor: null,
    listingModeRecommendation: "fixed_price",
    allowAuction: false,
    itemSpecifics: [
      { name: "Type", value: "Review needed" },
      { name: "Pricing goal", value: pricingStrategy.replaceAll("_", " ") },
    ],
    photoChecklist: [
      "Confirm the lead photo clearly shows the item.",
      "Confirm all important angles are included.",
    ],
    missingInfo: [reason, "Confirm item identity and price before publishing."],
    enhancementPlan: leadPhotoId ? [{
      type: "lead_photo",
      rationale: "Use the first uploaded photo as the provisional lead image.",
      sourcePhotoIds: [leadPhotoId],
    }] : [],
    productVertical: "graded_card",
    cardIdentifiers: {
      grader: null,
      certNumber: null,
      grade: null,
      game: null,
      cardName: null,
      setName: null,
      cardNumber: null,
      year: null,
      parallel: null,
      language: null,
    },
  };
}

function quantile(values: number[], ratio: number) {
  if (values.length === 1) return values[0];
  const position = (values.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  const weight = position - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function numberOrNull(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function numericEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function stringOr(value: unknown, fallback: string): string;
function stringOr(value: unknown, fallback: null): string | null;
function stringOr(value: unknown, fallback: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function isProbablyMobileCallback(userAgent: string | undefined) {
  const normalized = userAgent?.toLowerCase() ?? "";
  return normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("android") || normalized.includes("mobile");
}

function renderCallbackHtml(
  title: string,
  body: string,
  deepLink?: { authSessionId: string; status: "complete" | "failed" },
  isMobile = false,
) {
  const appUrl = deepLink
    ? `listingos://?authSessionId=${encodeURIComponent(deepLink.authSessionId)}&authStatus=${encodeURIComponent(deepLink.status)}`
    : null;
  const webUrl = "https://listingos.expo.app/";
  const resolvedUrl = isMobile ? appUrl : webUrl;
  const safeAppUrl = appUrl ? escapeHtml(appUrl) : "";
  const safeFallbackUrl = resolvedUrl ? escapeHtml(resolvedUrl) : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${resolvedUrl ? `<meta http-equiv="refresh" content="1;url=${safeFallbackUrl}" />` : ""}
    <style>
      body { background: #08111f; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 24px; }
      .card { max-width: 560px; margin: 56px auto; padding: 24px; border-radius: 24px; border: 1px solid #22304a; background: linear-gradient(145deg, #101b2d, #0b1424); box-shadow: 0 24px 80px rgba(0,0,0,0.28); }
      .eyebrow { margin: 0 0 10px; color: #8ed0ff; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
      h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.05; }
      p { margin: 0; color: #cbd5e1; line-height: 1.6; }
      a { align-items: center; background: linear-gradient(135deg, #dff2ff, #66e1d1); border-radius: 999px; color: #04111d; display: inline-flex; font-weight: 800; justify-content: center; margin-top: 20px; min-height: 48px; padding: 0 20px; text-decoration: none; }
      .hint { color: #94a3b8; font-size: 13px; margin-top: 14px; }
    </style>
    ${resolvedUrl ? `<script>
      window.addEventListener("load", () => {
        const redirectUrl = ${JSON.stringify(resolvedUrl)};
        setTimeout(() => {
          window.location.replace(redirectUrl);
        }, 250);
      });
    </script>` : ""}
  </head>
  <body>
    <div class="card">
      <p class="eyebrow">ListingOS</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      ${isMobile && appUrl ? `<a href="${safeAppUrl}">Open ListingOS</a><p class="hint">If the app does not open automatically, tap the button.</p>` : ""}
      ${!isMobile ? `<a href="https://listingos.expo.app/">Open ListingOS</a><p class="hint">You are being redirected to the ListingOS web app.</p>` : ""}
    </div>
  </body>
</html>`;
}

function renderMarketingHtml(title: string, paragraphs: string[]) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { background: #08111f; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 24px; }
      .card { max-width: 720px; margin: 56px auto; padding: 28px; border-radius: 24px; border: 1px solid #22304a; background: linear-gradient(145deg, #101b2d, #0b1424); box-shadow: 0 24px 80px rgba(0,0,0,0.28); }
      .eyebrow { margin: 0 0 10px; color: #47b8ff; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
      h1 { margin: 0 0 18px; font-size: clamp(32px, 7vw, 56px); line-height: 0.95; letter-spacing: -0.04em; }
      p { margin: 0 0 16px; color: #cbd5e1; font-size: 16px; line-height: 1.65; }
      p:last-child { margin-bottom: 0; }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">ListingOS</p>
      <h1>${escapeHtml(title)}</h1>
      ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function base64Encode(value: string) {
  return btoa(value);
}

function base64FromArrayBuffer(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function encryptSecret(secret: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(secret);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${base64FromArrayBuffer(iv.buffer)}.${base64FromArrayBuffer(cipher)}`;
}

async function decryptSecret(secret: string, cipherText: string) {
  const [ivBase64, payloadBase64] = cipherText.split(".");
  const iv = Uint8Array.from(atob(ivBase64), (char) => char.charCodeAt(0));
  const payload = Uint8Array.from(atob(payloadBase64), (char) => char.charCodeAt(0));
  const key = await importAesKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    payload,
  );
  return new TextDecoder().decode(plain);
}

async function importAesKey(secret: string) {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function responseJsonOrText(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function createBlocker(input: {
  draftId: string;
  sellerAccountId: string;
  type: BlockerType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}) {
  return BlockerSchema.parse({
    id: crypto.randomUUID(),
    type: input.type,
    status: "open",
    title: input.title,
    description: input.description,
    payload: input.payload,
  });
}

async function enrichPublishErrorBlockers(env: Bindings, sellerAccountId: string, draft: DraftPayload) {
  const publishErrorBlockers = draft.blockers.filter((blocker) => blocker.payload.source === "ebay_publish_error");
  if (publishErrorBlockers.length === 0) return draft;

  const latestAttempt = await env.DB.prepare(
    "SELECT response_json FROM publish_attempts WHERE draft_id = ? AND seller_account_id = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(draft.draftId, sellerAccountId).first<{ response_json: string | null }>();
  const response = latestAttempt?.response_json ? asRecord(JSON.parse(latestAttempt.response_json)) : null;
  const blockers = draft.blockers.map((blocker) => {
    if (blocker.payload.source !== "ebay_publish_error") return blocker;
    const rawError = stringOr(blocker.payload.rawError, stringOr(response?.error, blocker.description));
    const friendly = friendlyPublishError(rawError, draft);
    return BlockerSchema.parse({
      ...blocker,
      title: friendly.title,
      description: `${friendly.message} ${friendly.fixHint}`,
      payload: {
        ...blocker.payload,
        rawError,
        ebayField: friendly.ebayField,
        fieldLabels: friendly.fieldLabels,
        fieldHints: friendly.fieldHints,
        explanation: friendly.message,
        requiredFields: friendly.requiredFields,
        suggestedCondition: friendly.suggestedCondition,
      },
    });
  });
  return DraftPayloadSchema.parse({ ...draft, blockers });
}

function blockerPayload(blocker: { payload_json: string }) {
  return JSON.parse(blocker.payload_json) as Record<string, unknown>;
}

function currencyForMarketplace(marketplaceId: string) {
  return marketplaceId === "EBAY_GB" ? "GBP" : marketplaceId === "EBAY_DE" || marketplaceId === "EBAY_FR" || marketplaceId === "EBAY_IT" || marketplaceId === "EBAY_ES" ? "EUR" : "USD";
}

function getAppEncryptionSecret(env: Bindings) {
  return env.APP_ENCRYPTION_SECRET || env.EBAY_CLIENT_SECRET;
}

function getPublicApiBaseUrl(env: Bindings) {
  return (env.PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
}
