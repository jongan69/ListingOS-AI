CREATE TABLE IF NOT EXISTS market_buyer_identities (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_buyer_sessions (
  id TEXT PRIMARY KEY,
  buyer_identity_id TEXT NOT NULL,
  email TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (buyer_identity_id) REFERENCES market_buyer_identities(id)
);

CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  draft_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  location_label TEXT,
  latitude REAL,
  longitude REAL,
  category TEXT,
  photo_urls_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (seller_account_id) REFERENCES seller_accounts(id)
);

CREATE TABLE IF NOT EXISTS market_threads (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_identity_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES market_listings(id),
  FOREIGN KEY (buyer_identity_id) REFERENCES market_buyer_identities(id)
);

CREATE TABLE IF NOT EXISTS market_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES market_threads(id)
);

CREATE TABLE IF NOT EXISTS market_blocks (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_identity_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES market_listings(id)
);

CREATE TABLE IF NOT EXISTS market_reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  reporter TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES market_listings(id)
);

CREATE TABLE IF NOT EXISTS market_rate_events (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_threads_listing ON market_threads(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_messages_thread ON market_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_market_rate_events_bucket ON market_rate_events(bucket, created_at DESC);
