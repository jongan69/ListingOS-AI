import type { ImagePickerAsset } from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { appConfig } from "@/config/app";
import {
  CameraSessionCreateInputSchema,
  CameraSessionSchema,
  DraftJobSchema,
  DraftPayloadSchema,
  BillingEventSchema,
  BillingSummarySchema,
  BillingSyncRequestSchema,
  MarketFeedPageSchema,
  MarketInquiryStartSchema,
  MarketMessageSchema,
  MarketPublishRequestSchema,
  MarketReportRequestSchema,
  MarketThreadSchema,
  PublicMarketListingSchema,
  PricingStrategySchema,
  PublishRequestSchema,
  PublishResultSchema,
  PushTokenRegistrationSchema,
  SessionEmailStartSchema,
  SessionEmailVerifySchema,
  QueueItemSchema,
  SellerReadinessSchema,
  SessionStateSchema,
  SessionUserSchema,
  UploadBatchSchema,
  UploadInitResponseSchema,
  type DraftJob,
  type DraftPayload,
  type BillingEventInput,
  type BillingSummary,
  type BillingSyncRequestInput,
  type ListingMode,
  type MarketFeedPage,
  type MarketMessage,
  type MarketPublishRequest,
  type MarketReportRequest,
  type MarketThread,
  type PricingStrategy,
  type PublishResult,
  type PushTokenRegistration,
  type QueueItem,
  type CameraSession,
  type SellerReadiness,
  type SessionState,
  type SessionUser,
  type UploadBatch,
  type VisionFrameContext,
} from "@/shared/contracts";

type ApiContext = {
  apiBaseUrl: string;
  sessionToken?: string | null;
};

type PreparedUploadAsset = {
  blob: Blob;
  contentType: string;
  fileName: string;
  sizeBytes: number;
};

type DraftPatchPayload = Partial<DraftPayload> & {
  category?: string;
  leadPhotoId?: string | null;
  photoOrderIds?: string[];
  manualPrice?: number;
  manualPriceStrategy?: PricingStrategy;
  clearManualPrice?: boolean;
  confirmManualReview?: boolean;
  listingMode?: ListingMode;
};

const LISTING_IMAGE_MAX_EDGE = 2200;
const LISTING_IMAGE_QUALITY = 0.82;
const LISTING_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const LISTING_IMAGE_TARGET_BYTES = 10 * 1024 * 1024;
const LISTING_IMAGE_UPLOAD_TIMEOUT_MS = 90_000;
const LISTING_IMAGE_ATTEMPTS = [
  { maxEdge: LISTING_IMAGE_MAX_EDGE, quality: LISTING_IMAGE_QUALITY },
  { maxEdge: 1800, quality: 0.72 },
  { maxEdge: 1400, quality: 0.62 },
  { maxEdge: 1200, quality: 0.5 },
] as const;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function assertLiveApiAvailable() {
  if (!appConfig.proofModeEnabled) return;
  throw new ApiError(
    "This proof build is fixture-only and cannot contact live ListingOS seller services.",
    403,
    false,
  );
}

async function requestJson<T>(
  context: ApiContext,
  path: string,
  init?: RequestInit,
  schema?: { parse: (value: unknown) => T },
  timeoutMs: number = appConfig.apiTimeoutMs,
): Promise<T> {
  assertLiveApiAvailable();
  const headers = new Headers(init?.headers);
  if (context.sessionToken) {
    headers.set("Authorization", `Bearer ${context.sessionToken}`);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${context.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      timedOut ? "This is taking too long. Check your connection and try again." : "You appear to be offline. Check your connection and try again.",
      0,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.message === "string"
        ? payload.message
        : response.status === 401
          ? "Your eBay session expired. Sign in again to continue."
          : "Something went wrong. Try again.";
    throw new ApiError(message, response.status, response.status === 408 || response.status === 429 || response.status >= 500);
  }
  if (!schema) return payload as T;
  try {
    return schema.parse(payload);
  } catch {
    throw new ApiError("ListingOS received an unexpected server response. Refresh the app and try again.", response.status, false);
  }
}

export const api = {
  connectSeller(context: ApiContext) {
    return requestJson<{ authSessionId: string; authUrl: string; expiresAt: string }>(
      context,
      "/api/session/ebay/connect",
      { method: "POST" },
    );
  },
  getPendingSession(context: ApiContext, authSessionId: string) {
    return requestJson<SessionState>(context, `/api/session/pending/${authSessionId}`, undefined, SessionStateSchema);
  },
  listQueue(context: ApiContext) {
    return requestJson<QueueItem[]>(context, "/api/queue", undefined, {
      parse: (value) => Array.isArray(value) ? value.map((item) => QueueItemSchema.parse(item)) : [],
    });
  },
  cancelQueueItem(context: ApiContext, itemId: string) {
    return requestJson<QueueItem>(context, `/api/queue/${encodeURIComponent(itemId)}/cancel`, { method: "POST" }, QueueItemSchema);
  },
  retryQueueItem(context: ApiContext, itemId: string) {
    return requestJson<QueueItem>(context, `/api/queue/${encodeURIComponent(itemId)}/retry`, { method: "POST" }, QueueItemSchema);
  },
  getSessionMe(context: ApiContext) {
    return requestJson<SessionUser>(context, "/api/session/me", undefined, SessionUserSchema);
  },
  startEmailSession(context: ApiContext, email: string) {
    return requestJson<{ ok: true; sessionToken: string; email: string }>(
      context,
      "/api/session/email/start",
      { method: "POST", body: JSON.stringify(SessionEmailStartSchema.parse({ email })) },
    );
  },
  verifyEmailSession(context: ApiContext, input: { email: string; sessionToken: string; verificationCode: string }) {
    return requestJson<{ ok: true; user: SessionUser }>(
      context,
      "/api/session/email/verify",
      { method: "POST", body: JSON.stringify(SessionEmailVerifySchema.parse(input)) },
      { parse: (value) => value as { ok: true; user: SessionUser } },
    );
  },
  logoutSession(context: ApiContext) {
    return requestJson<{ ok: true }>(context, "/api/session/logout", { method: "POST" });
  },
  registerPushToken(context: ApiContext, input: PushTokenRegistration) {
    return requestJson<{ ok: true }>(
      context,
      "/api/devices/push-token",
      { method: "POST", body: JSON.stringify(PushTokenRegistrationSchema.parse(input)) },
    );
  },
  getBillingSummary(context: ApiContext) {
    return requestJson<BillingSummary>(context, "/api/billing/summary", undefined, BillingSummarySchema);
  },
  syncBilling(context: ApiContext, input: BillingSyncRequestInput) {
    return requestJson<BillingSummary>(
      context,
      "/api/billing/sync",
      { method: "POST", body: JSON.stringify(BillingSyncRequestSchema.parse(input)) },
      BillingSummarySchema,
    );
  },
  recordBillingEvent(context: ApiContext, input: BillingEventInput) {
    return requestJson<{ ok: true }>(
      context,
      "/api/billing/events",
      { method: "POST", body: JSON.stringify(BillingEventSchema.parse(input)) },
    );
  },
  sendTestPushNotification(context: ApiContext) {
    return requestJson<{
      ok: boolean;
      tokenCount: number;
      sentCount: number;
      inactiveCount: number;
      expoAccepted: boolean;
    }>(
      context,
      "/api/devices/test-notification",
      { method: "POST" },
    );
  },
  createUploadBatch(context: ApiContext, input: {
    marketplaceId: string;
    pricingStrategy: PricingStrategy;
    captureSource?: "manual" | "sony_monitor" | "sony_remote";
    captureSessionId?: string | null;
    captureDeviceModel?: string | null;
    captureProfile?: string | null;
  }) {
    return requestJson<UploadBatch>(
      context,
      "/api/uploads/batches",
      { method: "POST", body: JSON.stringify(input) },
      UploadBatchSchema,
    );
  },
  startCameraSession(context: ApiContext, input: { source: "manual" | "sony_monitor" | "sony_remote"; batchId?: string; deviceModel?: string | null; profile?: string | null; metadata?: Record<string, unknown> }) {
    return requestJson<CameraSession>(
      context,
      "/api/camera/sessions",
      {
        method: "POST",
        body: JSON.stringify(CameraSessionCreateInputSchema.parse({
          source: input.source,
          batchId: input.batchId ?? null,
          deviceModel: input.deviceModel ?? null,
          profile: input.profile ?? null,
          metadata: input.metadata ?? {},
        })),
      },
      CameraSessionSchema,
    );
  },
  initUpload(context: ApiContext, input: { batchId: string; fileName: string; contentType: string; sizeBytes?: number | null; visionContext?: VisionFrameContext | null }) {
    return requestJson(context, "/api/uploads/init", {
      method: "POST",
      body: JSON.stringify(input),
    }, UploadInitResponseSchema);
  },
  async uploadPreparedAsset(uploadUrl: string, asset: PreparedUploadAsset) {
    assertLiveApiAvailable();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LISTING_IMAGE_UPLOAD_TIMEOUT_MS);
    try {
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": asset.contentType,
        },
        body: asset.blob,
        signal: controller.signal,
      });
      if (!upload.ok) {
        throw new ApiError(
          upload.status === 413
            ? "One photo is too large to upload. Choose a smaller copy and try again."
            : "A photo could not be uploaded. Check your connection and try again.",
          upload.status,
          upload.status === 408 || upload.status === 429 || upload.status >= 500,
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new ApiError(
        timedOut
          ? "A photo upload timed out. Check your connection and try again."
          : "A photo could not be uploaded. Check your connection and try again.",
        0,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  },
  queueDraftGeneration(context: ApiContext, input: { batchId: string; pricingStrategy: PricingStrategy; autoPublish?: boolean }) {
    return requestJson<{ ok: true; batchId: string; status: string; autoPublish: boolean }>(
      context,
      "/api/drafts/jobs",
      {
        method: "POST",
        body: JSON.stringify({
          ...input,
          // Live marketplace mutations must be explicit. Photo intake and
          // retry paths always stop at review unless a future seller-facing
          // control deliberately opts in.
          autoPublish: input.autoPublish === true,
        }),
      },
    );
  },
  async uploadAssetsToBatchAndQueue(
    context: ApiContext,
    input: {
      batchId: string;
      pricingStrategy: PricingStrategy;
      autoPublish?: boolean;
      assets: ImagePickerAsset[];
      visionContext?: VisionFrameContext | null;
      onProgress?: (completed: number, total: number) => void;
    },
  ) {
    let completed = 0;
    input.onProgress?.(completed, input.assets.length);
    await runWithConcurrency(input.assets, appConfig.uploadConcurrency, async (asset) => {
      const prepared = await prepareUploadAsset(asset);
      const upload = await this.initUpload(context, {
        batchId: input.batchId,
        fileName: prepared.fileName,
        contentType: prepared.contentType,
        sizeBytes: prepared.sizeBytes,
        visionContext: input.visionContext ?? null,
      });
      await this.uploadPreparedAsset(upload.uploadUrl, prepared);
      completed += 1;
      input.onProgress?.(completed, input.assets.length);
    });
    await this.queueDraftGeneration(context, {
      batchId: input.batchId,
      pricingStrategy: input.pricingStrategy,
      autoPublish: input.autoPublish === true,
    });
  },
  listBatchJobs(context: ApiContext, batchId: string) {
    return requestJson<DraftJob[]>(context, `/api/drafts/jobs?batchId=${encodeURIComponent(batchId)}`, undefined, {
      parse: (value) => Array.isArray(value) ? value.map((item) => DraftJobSchema.parse(item)) : [],
    });
  },
  getDraft(context: ApiContext, draftId: string) {
    return requestJson<DraftPayload>(context, `/api/drafts/${draftId}`, undefined, DraftPayloadSchema);
  },
  patchDraft(context: ApiContext, draftId: string, patch: DraftPatchPayload) {
    return requestJson<DraftPayload>(
      context,
      `/api/drafts/${draftId}`,
      { method: "PATCH", body: JSON.stringify(patch) },
      DraftPayloadSchema,
    );
  },
  getSellerReadiness(context: ApiContext, marketplaceId: string) {
    return requestJson<SellerReadiness>(
      context,
      `/api/seller/readiness?marketplaceId=${encodeURIComponent(marketplaceId)}`,
      undefined,
      SellerReadinessSchema,
    );
  },
  resolveBlocker(context: ApiContext, blockerId: string, payload: Record<string, unknown>) {
    return requestJson<{ ok: true }>(
      context,
      `/api/seller/blockers/${blockerId}/resolve`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  verifyDraft(context: ApiContext, draftId: string) {
    return requestJson<DraftPayload>(
      context,
      `/api/listings/${draftId}/verify`,
      { method: "POST" },
      DraftPayloadSchema,
    );
  },
  publishDraft(context: ApiContext, draftId: string, payload: { strategy: PricingStrategy; selectedTitle?: string; listingMode?: DraftPayload["listingMode"] }) {
    return requestJson<PublishResult>(
      context,
      `/api/listings/${draftId}/publish`,
      {
        method: "POST",
        body: JSON.stringify(PublishRequestSchema.parse(payload)),
      },
      PublishResultSchema,
      90_000,
    );
  },
  getListingResult(context: ApiContext, draftId: string) {
    return requestJson<PublishResult>(context, `/api/listings/${draftId}`, undefined, PublishResultSchema);
  },
  publishMarketDraft(context: ApiContext, draftId: string, payload: MarketPublishRequest) {
    return requestJson<{ ok: true; listingId: string; listingSlug: string; publicUrl: string; status: string }>(
      context,
      `/api/market/listings/${draftId}/publish`,
      { method: "POST", body: JSON.stringify(MarketPublishRequestSchema.parse(payload)) },
    );
  },
  unpublishMarketListing(context: ApiContext, listingId: string) {
    return requestJson<{ ok: true }>(context, `/api/market/listings/${encodeURIComponent(listingId)}/unpublish`, { method: "POST" });
  },
  markMarketListingSold(context: ApiContext, listingId: string) {
    return requestJson<{ ok: true }>(context, `/api/market/listings/${encodeURIComponent(listingId)}/mark-sold`, { method: "POST" });
  },
  listMyMarketListings(context: ApiContext) {
    return requestJson<{ items: unknown[] }>(context, "/api/market/listings/mine", undefined);
  },
  getPublicMarketFeed(context: ApiContext, query: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === "number" || typeof value === "string") {
        params.set(key, String(value));
      }
    });
    return requestJson<MarketFeedPage>(
      context,
      `/api/public/market/listings${params.toString() ? `?${params.toString()}` : ""}`,
      undefined,
      MarketFeedPageSchema,
    );
  },
  getPublicMarketListing(context: ApiContext, slug: string) {
    return requestJson<MarketFeedPage["items"][number]>(context, `/api/public/market/listings/${encodeURIComponent(slug)}`, undefined, { parse: (value) => PublicMarketListingSchema.parse(value) });
  },
  startMarketInquiry(context: ApiContext, slug: string, input: { email: string; message: string }) {
    return requestJson<{ ok: true; threadId: string; verified: boolean }>(
      context,
      `/api/public/market/listings/${encodeURIComponent(slug)}/inquiries`,
      { method: "POST", body: JSON.stringify(MarketInquiryStartSchema.parse(input)) },
    );
  },
  verifyMarketInquiry(context: ApiContext, inquiryId: string) {
    return requestJson<{ ok: true; threadId: string }>(context, `/api/public/market/inquiries/verify?inquiryId=${encodeURIComponent(inquiryId)}`);
  },
  getMarketThread(context: ApiContext, threadId: string) {
    return requestJson<MarketThread>(context, `/api/public/market/threads/${encodeURIComponent(threadId)}`, undefined, MarketThreadSchema);
  },
  sendMarketThreadMessage(context: ApiContext, threadId: string, input: { body: string }) {
    return requestJson<MarketMessage>(context, `/api/public/market/threads/${encodeURIComponent(threadId)}/messages`, { method: "POST", body: JSON.stringify(MarketMessageSchema.parse(input)) }, MarketMessageSchema);
  },
  reportMarketListing(context: ApiContext, input: MarketReportRequest) {
    return requestJson<{ ok: true; reportId: string }>(context, "/api/public/market/reports", { method: "POST", body: JSON.stringify(MarketReportRequestSchema.parse(input)) });
  },
};

async function prepareUploadAsset(asset: ImagePickerAsset): Promise<PreparedUploadAsset> {
  const maxEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  const originalFileName = asset.fileName ?? `${asset.assetId ?? "photo"}.jpg`;
  const originalContentType = asset.mimeType ?? "image/jpeg";
  const originalBlob = await blobFromUri(asset.uri);
  const resolvedOriginalContentType = supportedUploadImageMime(originalBlob.type || originalContentType);
  const shouldNormalize = originalBlob.size > 1_500_000
    || maxEdge > LISTING_IMAGE_MAX_EDGE
    || resolvedOriginalContentType !== "image/jpeg";

  if (!shouldNormalize && originalBlob.size <= LISTING_IMAGE_TARGET_BYTES) {
    return {
      blob: originalBlob,
      contentType: resolvedOriginalContentType,
      fileName: originalFileName,
      sizeBytes: originalBlob.size,
    };
  }

  let lastError: unknown = null;
  let smallestNormalized: PreparedUploadAsset | null = null;
  for (const attempt of LISTING_IMAGE_ATTEMPTS) {
    try {
      const shouldResize = maxEdge > attempt.maxEdge;
      const actions = shouldResize ? [{
        resize: asset.width && asset.height && asset.width >= asset.height
          ? { width: attempt.maxEdge }
          : { height: attempt.maxEdge },
      }] : [];
      const result = await manipulateAsync(asset.uri, actions, {
        compress: attempt.quality,
        format: SaveFormat.JPEG,
      });
      const blob = await blobFromUri(result.uri);
      const prepared = {
        blob,
        // SaveFormat.JPEG is authoritative even when a platform Blob reports
        // a legacy alias such as image/jpg or image/pjpeg.
        contentType: "image/jpeg",
        fileName: normalizedJpegName(originalFileName),
        sizeBytes: blob.size,
      };
      if (blob.size <= LISTING_IMAGE_MAX_BYTES && (!smallestNormalized || blob.size < smallestNormalized.sizeBytes)) {
        smallestNormalized = prepared;
      }
      if (blob.size <= LISTING_IMAGE_TARGET_BYTES) {
        return prepared;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (smallestNormalized) return smallestNormalized;

  if (originalBlob.size <= LISTING_IMAGE_MAX_BYTES && resolvedOriginalContentType) {
    return {
      blob: originalBlob,
      contentType: resolvedOriginalContentType,
      fileName: originalFileName,
      sizeBytes: originalBlob.size,
    };
  }

  console.warn("Photo normalization failed", lastError);
  throw new Error("One photo could not be prepared for upload. Open it in Photos, duplicate or export it as a JPEG, then select it again.");
}

async function blobFromUri(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The selected photo is not available on this device.");
  return response.blob();
}

function normalizedJpegName(fileName: string) {
  return fileName.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}

function supportedUploadImageMime(value: string): PreparedUploadAsset["contentType"] | null {
  const normalized = value.trim().toLowerCase().split(";", 1)[0];
  if (normalized === "image/jpg" || normalized === "image/pjpeg") return "image/jpeg";
  if (["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(normalized)) {
    return normalized;
  }
  return null;
}

export function pricingStrategyLabel(strategy: PricingStrategy) {
  return PricingStrategySchema.parse(strategy) === "fast_sale"
    ? "Sell Faster"
    : strategy === "max_profit"
      ? "Max Profit"
      : "Balanced";
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let currentIndex = 0;

  async function runNext() {
    while (currentIndex < items.length) {
      const itemIndex = currentIndex;
      currentIndex += 1;
      await worker(items[itemIndex], itemIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => runNext()),
  );
}
