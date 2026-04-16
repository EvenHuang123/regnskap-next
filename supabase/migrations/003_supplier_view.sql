-- ── Migration 003: Supplier analytics view ───────────────────────────────────
-- Run in Supabase SQL Editor after 001 and 002.

-- View: aggregated supplier stats per user
create or replace view supplier_stats as
select
  user_id,
  leverandor                                                   as supplier,
  count(*)                                                     as invoice_count,
  sum(belop)                                                   as total_amount,
  round(avg(belop)::numeric, 2)                               as avg_amount,
  min(dato)                                                    as first_invoice_date,
  max(dato)                                                    as last_invoice_date,
  -- Siste 3 måneder
  sum(case when dato >= current_date - interval '3 months' then belop else 0 end)  as amount_last_3m,
  count(case when dato >= current_date - interval '3 months' then 1 end)           as count_last_3m,
  -- Forrige 3 måneder (for sammenligning)
  sum(case when dato >= current_date - interval '6 months'
            and dato <  current_date - interval '3 months'
           then belop else 0 end)                              as amount_prev_3m
from fakturaer
group by user_id, leverandor;

-- Ytelsesindekser
create index if not exists idx_fakturaer_leverandor_dato
  on fakturaer(user_id, leverandor, dato desc);

-- RLS: brukere ser bare egne rader (view arver fra fakturaer)
-- Ingen ekstra policy nødvendig siden view bruker fakturaer som kilde
