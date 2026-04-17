-- ── Migration 006: Extend fakturaer with accounting fields ───────────────────
-- Safe: uses ADD COLUMN IF NOT EXISTS. Existing data is preserved.
-- Tables accounts / journal_entries / journal_entry_lines already exist (001).

-- ── 1. Safety check ───────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Existing fakturaer count: %', (SELECT COUNT(*) FROM fakturaer);
END $$;

-- ── 2. Extend fakturaer ───────────────────────────────────────────────────────

ALTER TABLE fakturaer
  ADD COLUMN IF NOT EXISTS net_amount            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vat_amount            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vat_rate              INTEGER CHECK (vat_rate IN (0, 15, 25)),
  ADD COLUMN IF NOT EXISTS suggested_account_code TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_account_code TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence          NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS user_verified          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_number         TEXT,
  ADD COLUMN IF NOT EXISTS due_date               DATE;

-- ── 3. Migrate existing rows ──────────────────────────────────────────────────
-- Use kategori to set suggested_account_code (same mapping as NORWEGIAN_ACCOUNTS in lib/accounting.ts)

UPDATE fakturaer SET
  net_amount  = ROUND(belop / 1.25, 2),
  vat_amount  = ROUND(belop - belop / 1.25, 2),
  vat_rate    = 25
WHERE net_amount IS NULL AND belop IS NOT NULL AND belop > 0;

-- Map existing category → NS 4102 account code
UPDATE fakturaer SET suggested_account_code = '6300' WHERE kategori = 'Husleie'       AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '6340' WHERE kategori = 'Strøm'         AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '6900' WHERE kategori = 'Internett'     AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '6900' WHERE kategori = 'Telefon'       AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '5000' WHERE kategori = 'Lønn'          AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '4000' WHERE kategori = 'Varekjøp'      AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '6800' WHERE kategori = 'Transport'     AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '7500' WHERE kategori = 'Markedsføring' AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '6860' WHERE kategori = 'Forsikring'    AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '6500' WHERE kategori = 'Utstyr'        AND suggested_account_code IS NULL;
UPDATE fakturaer SET suggested_account_code = '7900' WHERE kategori = 'Annet'         AND suggested_account_code IS NULL;

UPDATE fakturaer
  SET ai_confidence = 0.80
WHERE suggested_account_code IS NOT NULL AND ai_confidence IS NULL;

-- ── 4. Verification ───────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 006 complete';
  RAISE NOTICE 'Fakturaer total:           %', (SELECT COUNT(*) FROM fakturaer);
  RAISE NOTICE 'Fakturaer with net_amount: %', (SELECT COUNT(*) FROM fakturaer WHERE net_amount IS NOT NULL);
  RAISE NOTICE 'Fakturaer with account:    %', (SELECT COUNT(*) FROM fakturaer WHERE suggested_account_code IS NOT NULL);
END $$;
