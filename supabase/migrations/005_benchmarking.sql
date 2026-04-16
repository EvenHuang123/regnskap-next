-- ── Migration 005: Industry Benchmarking ─────────────────────────────────────
-- Run in Supabase SQL Editor after migrations 001-004.
-- Tables used: fakturaer, maaneder (existing). New: user_benchmark_profile.

-- ── 1. User benchmark profile ─────────────────────────────────────────────────
create table if not exists user_benchmark_profile (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  industry             varchar(30) not null,   -- 'retail','restaurant','consulting', etc.
  company_size         varchar(10) not null,   -- 'solo','micro','small','medium'
  share_anonymous_data boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table user_benchmark_profile enable row level security;

create policy "Users manage own benchmark profile"
  on user_benchmark_profile for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 2. Materialized view – aggregated benchmarks ──────────────────────────────
-- Built from maaneder (revenue/payroll/cogs/opex) + fakturaer (specific categories).
-- Only includes groups with >= 5 opt-in users (anonymity guarantee).

create materialized view if not exists benchmark_aggregates as
with user_revenue as (
  select
    user_id,
    sum(inntekter)       as total_revenue,
    sum(varekostnader)   as cogs,
    sum(lonnskostnader)  as payroll,
    sum(andre_kostnader) as opex
  from maaneder
  where month >= to_char(current_date - interval '12 months', 'YYYY-MM')
  group by user_id
),
user_fakturaer as (
  select
    user_id,
    sum(case when kategori = 'Husleie'                         then belop else 0 end) as husleie,
    sum(case when kategori in ('Internett','Telefon','Utstyr') then belop else 0 end) as it_kostnader,
    sum(case when kategori = 'Markedsføring'                   then belop else 0 end) as markedsforing,
    sum(case when kategori = 'Transport'                       then belop else 0 end) as transport,
    sum(case when kategori = 'Forsikring'                      then belop else 0 end) as forsikring
  from fakturaer
  where dato >= current_date - interval '12 months'
  group by user_id
),
user_metrics as (
  select
    r.user_id,
    bp.industry,
    bp.company_size,
    r.total_revenue,
    r.cogs,
    r.payroll,
    r.opex                                as operating_expenses,
    r.cogs + r.payroll + r.opex           as total_expenses,
    coalesce(f.husleie,       0)          as husleie,
    coalesce(f.it_kostnader,  0)          as it_kostnader,
    coalesce(f.markedsforing, 0)          as markedsforing,
    coalesce(f.transport,     0)          as transport,
    coalesce(f.forsikring,    0)          as forsikring
  from user_revenue r
  inner join user_benchmark_profile bp on r.user_id = bp.user_id
  left  join user_fakturaer         f  on r.user_id = f.user_id
  where bp.share_anonymous_data = true
    and r.total_revenue > 0
)
select
  industry,
  company_size,
  count(*)                                                                               as peer_count,
  -- Revenue
  avg(total_revenue)                                                                     as avg_revenue,
  percentile_cont(0.25) within group (order by total_revenue)                           as p25_revenue,
  percentile_cont(0.50) within group (order by total_revenue)                           as median_revenue,
  percentile_cont(0.75) within group (order by total_revenue)                           as p75_revenue,
  percentile_cont(0.90) within group (order by total_revenue)                           as p90_revenue,
  -- Expenses
  avg(total_expenses)                                                                    as avg_expenses,
  percentile_cont(0.50) within group (order by total_expenses)                          as median_expenses,
  -- Payroll
  avg(payroll)                                                                           as avg_payroll,
  percentile_cont(0.50) within group (order by payroll)                                 as median_payroll,
  -- COGS
  avg(cogs)                                                                              as avg_cogs,
  percentile_cont(0.50) within group (order by cogs)                                    as median_cogs,
  -- Opex
  avg(operating_expenses)                                                                as avg_opex,
  percentile_cont(0.50) within group (order by operating_expenses)                      as median_opex,
  -- Ratios
  avg(case when total_revenue > 0 then (total_revenue - total_expenses)/total_revenue else 0 end) as avg_profit_margin,
  avg(case when total_revenue > 0 then cogs / total_revenue else 0 end)                as avg_cogs_ratio,
  avg(case when total_revenue > 0 then payroll / total_revenue else 0 end)             as avg_payroll_ratio,
  avg(case when total_revenue > 0 then operating_expenses / total_revenue else 0 end)  as avg_opex_ratio,
  -- Per category
  avg(husleie)                                                                           as avg_husleie,
  avg(it_kostnader)                                                                      as avg_it,
  avg(markedsforing)                                                                     as avg_marketing,
  avg(transport)                                                                         as avg_transport,
  avg(forsikring)                                                                        as avg_forsikring,
  now()                                                                                  as last_updated
from user_metrics
group by industry, company_size
having count(*) >= 5;

create unique index if not exists idx_benchmark_agg on benchmark_aggregates(industry, company_size);

-- ── 3. Refresh function (call daily via Supabase cron / pg_cron) ──────────────
create or replace function refresh_benchmarks()
returns void as $$
begin
  refresh materialized view concurrently benchmark_aggregates;
end;
$$ language plpgsql;

-- ── 4. Index on fakturaer.dato (speed up benchmark queries) ───────────────────
create index if not exists idx_fakturaer_dato on fakturaer(user_id, dato desc);
