-- ============================================================
-- Regnskap — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────
-- 1. profiler  (one row per user)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiler (
  id               uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  bedriftsnavn     text,
  eier_navn        text,
  bedriftstype     text,
  selskapsform     text,
  antall_ansatte   text,
  opprettet        timestamptz DEFAULT now()
);

ALTER TABLE profiler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profil"
  ON profiler FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────
-- 2. maaneder  (monthly accounting entries)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maaneder (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  month            text NOT NULL,          -- YYYY-MM
  inntekter        numeric DEFAULT 0,
  varekostnader    numeric DEFAULT 0,
  lonnskostnader   numeric DEFAULT 0,
  andre_kostnader  numeric DEFAULT 0,
  mva_innbetalt    numeric DEFAULT 0,
  lagret_at        timestamptz DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE maaneder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own maaneder"
  ON maaneder FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. faste_kostnader  (fixed monthly costs)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faste_kostnader (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid UNIQUE NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  husleie            numeric DEFAULT 0,
  strom              numeric DEFAULT 0,
  internett          numeric DEFAULT 0,
  betalingsterminal  numeric DEFAULT 0,
  forsikring         numeric DEFAULT 0,
  andre_faste_navn   text DEFAULT '',
  andre_faste_belop  numeric DEFAULT 0,
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE faste_kostnader ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own faste_kostnader"
  ON faste_kostnader FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 4. ansatte  (employees)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ansatte (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  navn              text DEFAULT '',
  lonnstype         text DEFAULT 'måned',   -- 'måned' | 'time'
  manedslonn        numeric DEFAULT 0,
  timelonn          numeric DEFAULT 0,
  estimerte_timer   numeric DEFAULT 160,
  stillingsprosent  numeric DEFAULT 100,
  ansatttype        text DEFAULT 'Fast',    -- 'Fast' | 'Deltid' | 'Tilkalling'
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE ansatte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ansatte"
  ON ansatte FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
