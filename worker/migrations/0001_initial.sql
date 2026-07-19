CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  seller_username TEXT NOT NULL UNIQUE,
  ebay_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seller_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  seller_username TEXT NOT NULL,
  ebay_user_id TEXT,
  access_token_cipher TEXT,
  refresh_token_cipher TEXT,
  access_token_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  oauth_state TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  error_message TEXT,
  user_id TEXT,
  seller_account_id TEXT,
  session_token TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  seller_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS seller_marketplace_settings (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  marketplace_id TEXT NOT NULL,
  fulfillment_policy_id TEXT,
  payment_policy_id TEXT,
  return_policy_id TEXT,
  merchant_location_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (seller_account_id, marketplace_id),
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS upload_batches (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  marketplace_id TEXT NOT NULL,
  pricing_strategy TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS batch_photos (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES upload_batches(id)
);

CREATE TABLE IF NOT EXISTS draft_jobs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  seller_account_id TEXT NOT NULL,
  draft_id TEXT,
  marketplace_id TEXT NOT NULL,
  cluster_label TEXT,
  pricing_strategy TEXT NOT NULL,
  listing_mode TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES upload_batches(id),
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS draft_job_photos (
  job_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, photo_id),
  FOREIGN KEY (job_id) REFERENCES draft_jobs(id),
  FOREIGN KEY (photo_id) REFERENCES batch_photos(id)
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  marketplace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  listing_mode TEXT NOT NULL,
  title TEXT,
  confidence REAL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id),
  FOREIGN KEY (batch_id) REFERENCES upload_batches(id)
);

CREATE TABLE IF NOT EXISTS blockers (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  seller_account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts(id),
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS publish_attempts (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  seller_account_id TEXT NOT NULL,
  adapter TEXT NOT NULL,
  status TEXT NOT NULL,
  ebay_listing_id TEXT,
  ebay_offer_id TEXT,
  payload_json TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts(id),
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS app_events (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_upload_batches_seller ON upload_batches(seller_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_photos_batch ON batch_photos(batch_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_draft_jobs_batch ON draft_jobs(batch_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_drafts_seller ON drafts(seller_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blockers_draft ON blockers(draft_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_publish_attempts_draft ON publish_attempts(draft_id, created_at DESC);
