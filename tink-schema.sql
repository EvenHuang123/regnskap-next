-- ──────────────────────────────────────────────────────────────────────
-- Tink bank integration schema
-- Run this in the Supabase SQL editor
-- ──────────────────────────────────────────────────────────────────────

-- 1. Bank connections table
CREATE TABLE IF NOT EXISTS user_bank_connections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tink_user_id     TEXT NOT NULL,
  tink_access_token TEXT NOT NULL,
  bank_name        TEXT,
  account_id       TEXT,
  connected_at     TIMESTAMPTZ DEFAULT NOW(),
  last_synced      TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id)
);

ALTER TABLE user_bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank connections"
  ON user_bank_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bank_connections_user_id ON user_bank_connections(user_id);

-- 2. Add betalt_dato to fakturaer (safe — no-op if column already exists)
ALTER TABLE fakturaer ADD COLUMN IF NOT EXISTS betalt_dato DATE;
