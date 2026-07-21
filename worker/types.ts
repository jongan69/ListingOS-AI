import type { PricingStrategy } from "../src/shared/contracts";

export type QueueMessage =
  | { type: "process_upload_batch"; batchId: string }
  | { type: "generate_draft"; jobId: string }
  | { type: "publish_listing"; draftId: string; attemptId: string; strategy: PricingStrategy };

export type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  UPLOADS_BUCKET: R2Bucket;
  PROCESS_UPLOAD_BATCH_QUEUE: Queue<QueueMessage>;
  GENERATE_DRAFT_QUEUE: Queue<QueueMessage>;
  PUBLISH_LISTING_QUEUE: Queue<QueueMessage>;
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  OPENAI_DRAFT_MODEL?: string;
  OPENAI_CLUSTER_MODEL?: string;
  PSA_ACCESS_TOKEN?: string;
  POKEMON_TCG_API_KEY?: string;
  EBAY_CLIENT_ID: string;
  EBAY_CLIENT_SECRET: string;
  EBAY_DEV_ID?: string;
  EBAY_RUNAME: string;
  EBAY_MARKETPLACE_ID?: string;
  EBAY_USE_SANDBOX?: string;
  PUBLIC_API_BASE_URL?: string;
  PUBLIC_WEB_APP_URL?: string;
  APP_ENCRYPTION_SECRET?: string;
  EXPO_ACCESS_TOKEN?: string;
  REVENUECAT_SECRET_API_KEY?: string;
  REVENUECAT_WEBHOOK_AUTH_TOKEN?: string;
  /** Which REST generation the secret key belongs to. Defaults to auto-detect. */
  REVENUECAT_API_VERSION?: "v1" | "v2" | "auto";
  /** Required for the v2 API, which scopes customers under a project. */
  REVENUECAT_PROJECT_ID?: string;
  INTERNAL_ANALYTICS_TOKEN?: string;
  AI_UNKNOWN_MODEL_INPUT_USD_PER_MILLION?: string;
  AI_UNKNOWN_MODEL_CACHED_INPUT_USD_PER_MILLION?: string;
  AI_UNKNOWN_MODEL_OUTPUT_USD_PER_MILLION?: string;
  BILLING_ENFORCEMENT_MODE?: "observe" | "enforce";
  OFFERUP_DEFAULT_CITY?: string;
  OFFERUP_DEFAULT_STATE?: string;
  OFFERUP_DEFAULT_ZIP?: string;
  OFFERUP_DEFAULT_LATITUDE?: string;
  OFFERUP_DEFAULT_LONGITUDE?: string;
  OFFERUP_RADIUS_MILES?: string;
};

export type Variables = {
  session: SessionRecord | null;
  seller: SellerAccountRecord | null;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  seller_account_id: string;
  expires_at: string;
};

export type SellerAccountRecord = {
  id: string;
  user_id: string;
  seller_username: string;
  ebay_user_id: string | null;
  access_token_cipher: string | null;
  refresh_token_cipher: string | null;
  access_token_expires_at: string | null;
};

export type BatchPhotoRecord = {
  id: string;
  batch_id: string;
  object_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number | null;
  vision_context_json: string | null;
};

export type DraftJobRecord = {
  id: string;
  batch_id: string;
  seller_account_id: string;
  draft_id: string | null;
  marketplace_id: string;
  cluster_label: string | null;
  pricing_strategy: PricingStrategy;
  listing_mode: string | null;
  status: string;
  error_message: string | null;
  input_fingerprint?: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftRecord = {
  id: string;
  seller_account_id: string;
  batch_id: string;
  marketplace_id: string;
  status: string;
  listing_mode: string;
  title: string | null;
  confidence: number | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export type MarketplaceSettingsRecord = {
  id: string;
  seller_account_id: string;
  marketplace_id: string;
  fulfillment_policy_id: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  merchant_location_key: string | null;
};
