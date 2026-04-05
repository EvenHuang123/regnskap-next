-- ============================================================
-- Regnskap — Invoice schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. fakturaer  (invoices / bills)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fakturaer (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  leverandor   text NOT NULL,                        -- supplier name
  belop        numeric NOT NULL DEFAULT 0,            -- amount ex. VAT
  dato         date NOT NULL,                         -- invoice date
  mva          numeric DEFAULT 0,                     -- VAT amount
  kategori     text DEFAULT '',                       -- e.g. 'Husleie', 'Lønn'
  pdf_url      text DEFAULT '',                       -- path inside storage bucket
  status       text DEFAULT 'ubetalt'                 -- 'ubetalt' | 'betalt' | 'forfalt'
                 CHECK (status IN ('ubetalt', 'betalt', 'forfalt')),
  opprettet_at timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE fakturaer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fakturaer"
  ON fakturaer FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS fakturaer_user_dato ON fakturaer (user_id, dato DESC);
CREATE INDEX IF NOT EXISTS fakturaer_status    ON fakturaer (user_id, status);

-- ──────────────────────────────────────────────
-- 2. user_emails  (email → user mapping for forwarding)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_emails (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email          text NOT NULL UNIQUE,   -- the forwarding address
  label          text DEFAULT '',        -- optional friendly label
  aktiv          boolean DEFAULT true,
  opprettet_at   timestamptz DEFAULT now()
);

ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email mappings"
  ON user_emails FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. Storage bucket for invoice PDFs
-- ──────────────────────────────────────────────
-- Run these via the Supabase Dashboard → Storage → New bucket,
-- OR via the SQL editor using the storage schema:

INSERT INTO storage.buckets (id, name, public)
VALUES ('fakturaer-pdfs', 'fakturaer-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage: users can only read/write their own folder (user_id/*)
CREATE POLICY "Users upload own PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fakturaer-pdfs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fakturaer-pdfs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fakturaer-pdfs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
