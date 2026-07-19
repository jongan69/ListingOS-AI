CREATE TABLE IF NOT EXISTS billing_profiles (
  seller_account_id TEXT PRIMARY KEY,
  revenuecat_app_user_id TEXT NOT NULL UNIQUE,
  active_entitlement TEXT NOT NULL DEFAULT 'free',
  active_entitlements_json TEXT NOT NULL DEFAULT '[]',
  subscription_status TEXT NOT NULL DEFAULT 'free',
  source TEXT NOT NULL DEFAULT 'fallback',
  customer_info_json TEXT NOT NULL DEFAULT '{}',
  management_url TEXT,
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS usage_periods (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  entitlement TEXT NOT NULL,
  included_credits INTEGER NOT NULL,
  extra_credits INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (seller_account_id, period_start),
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  period_id TEXT,
  draft_id TEXT,
  batch_id TEXT,
  event_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_estimate_usd REAL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id),
  FOREIGN KEY (period_id) REFERENCES usage_periods(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_periods_seller ON usage_periods(seller_account_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_seller ON usage_events(seller_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_app_user ON billing_profiles(revenuecat_app_user_id);
