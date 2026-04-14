-- ──────────────────────────────────────────────────────────────────────
-- CSV bank statement upload schema
-- Run this in the Supabase SQL editor
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  amount             NUMERIC NOT NULL,      -- negative = debit / payment
  description        TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'csv',  -- 'csv' | 'tink'
  matched_faktura_id UUID REFERENCES fakturaer(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank transactions"
  ON bank_transactions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bank_tx_user_date ON bank_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS bank_tx_matched   ON bank_transactions(matched_faktura_id) WHERE matched_faktura_id IS NOT NULL;

-- Also ensure betalt_dato exists on fakturaer (safe to run again)
ALTER TABLE fakturaer ADD COLUMN IF NOT EXISTS betalt_dato DATE;
