-- Idempotent baseline also upgrades databases created by Phosphor 0.1.

CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, data JSONB NOT NULL, hidden BOOLEAN NOT NULL DEFAULT FALSE,
      impact_override TEXT, status_override TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE events ADD COLUMN IF NOT EXISTS location_override TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS lat_override DOUBLE PRECISION;

ALTER TABLE events ADD COLUMN IF NOT EXISTS lng_override DOUBLE PRECISION;

ALTER TABLE events ADD COLUMN IF NOT EXISTS verified_level_override INTEGER;

CREATE TABLE IF NOT EXISTS event_updates (
      id BIGSERIAL PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(), note TEXT NOT NULL
    );

CREATE INDEX IF NOT EXISTS events_updated_idx ON events(updated_at DESC);

CREATE INDEX IF NOT EXISTS event_updates_event_idx ON event_updates(event_id, at DESC);

CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);

CREATE TABLE IF NOT EXISTS news_candidates (id TEXT PRIMARY KEY, data JSONB NOT NULL, published_at TIMESTAMPTZ NOT NULL);

CREATE INDEX IF NOT EXISTS news_candidates_date_idx ON news_candidates(published_at DESC);

CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      salt TEXT NOT NULL, hash TEXT NOT NULL, email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      reset_hash TEXT, reset_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS app_users_email_idx ON app_users(email);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verify_hash TEXT;

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verify_expires_at TIMESTAMPTZ;

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS alert_prefs JSONB;

CREATE TABLE IF NOT EXISTS alert_deliveries (key TEXT PRIMARY KEY, sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
