ALTER TABLE draft_jobs ADD COLUMN input_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_draft_jobs_seller_fingerprint
  ON draft_jobs(seller_account_id, input_fingerprint, created_at DESC);
