-- Aggregated publish outcome memory: which repairs succeed for which eBay
-- error signatures. Seller-agnostic by design (no seller or listing ids) so
-- the pipeline can learn across all publish traffic.
CREATE TABLE IF NOT EXISTS publish_outcome_patterns (
  id TEXT PRIMARY KEY,
  error_signature TEXT NOT NULL,
  category_id TEXT NOT NULL DEFAULT '',
  vertical TEXT,
  repair_kind TEXT NOT NULL DEFAULT 'none',
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  sample_message TEXT,
  last_outcome_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_outcome_pattern
  ON publish_outcome_patterns (error_signature, category_id, repair_kind);
