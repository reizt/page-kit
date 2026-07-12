CREATE TABLE IF NOT EXISTS fetch_cache (
  url TEXT PRIMARY KEY NOT NULL,
  final_url TEXT NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  rendered INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fetch_cache_expires_at_idx ON fetch_cache (expires_at);
