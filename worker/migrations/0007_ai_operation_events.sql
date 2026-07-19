CREATE TABLE IF NOT EXISTS ai_operation_events (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  batch_id TEXT,
  job_id TEXT,
  draft_id TEXT,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  provider_request_id TEXT,
  input_tokens INTEGER,
  cached_input_tokens INTEGER,
  output_tokens INTEGER,
  reasoning_tokens INTEGER,
  image_count INTEGER,
  image_detail TEXT,
  latency_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  pricing_version TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_operation_events_seller_time
  ON ai_operation_events(seller_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_operation_events_draft_time
  ON ai_operation_events(draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_operation_events_operation_time
  ON ai_operation_events(operation, created_at DESC);
