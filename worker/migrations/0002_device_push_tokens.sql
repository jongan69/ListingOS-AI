CREATE TABLE IF NOT EXISTS device_push_tokens (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  device_name TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_notified_at TEXT,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_seller ON device_push_tokens(seller_account_id, status, updated_at DESC);
