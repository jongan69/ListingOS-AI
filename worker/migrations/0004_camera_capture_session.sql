ALTER TABLE upload_batches
  ADD COLUMN capture_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE upload_batches
  ADD COLUMN capture_session_id TEXT;

ALTER TABLE upload_batches
  ADD COLUMN capture_device_model TEXT;

ALTER TABLE upload_batches
  ADD COLUMN capture_profile TEXT;

CREATE TABLE IF NOT EXISTS camera_capture_sessions (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  batch_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  camera_model TEXT,
  device_profile TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id),
  FOREIGN KEY (batch_id) REFERENCES upload_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_camera_capture_sessions_seller
  ON camera_capture_sessions(seller_account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_capture_sessions_batch
  ON camera_capture_sessions(batch_id, status, started_at DESC);
