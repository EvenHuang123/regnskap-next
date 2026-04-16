-- ── Migration 001: Journal entries + NS 4102 accounts ────────────────────────
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ── 1. Accounts (kontoplan NS 4102) ──────────────────────────────────────────

create table if not exists accounts (
  id               uuid primary key default gen_random_uuid(),
  account_code     text not null unique,
  account_name     text not null,
  account_class    int  not null,   -- 1–8
  account_type     text not null,   -- 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  normal_balance   text not null,   -- 'debit' | 'credit'
  is_active        boolean not null default true,
  parent_code      text references accounts(account_code),
  created_at       timestamptz default now()
);

-- No RLS needed — accounts are global / read-only for all authenticated users
alter table accounts enable row level security;

create policy "Authenticated users can read accounts"
  on accounts for select
  using (auth.role() = 'authenticated');

-- ── 2. Journal entries ────────────────────────────────────────────────────────

create table if not exists journal_entries (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid references fakturaer(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  entry_date      date not null,
  description     text,
  created_at      timestamptz default now()
);

alter table journal_entries enable row level security;

create policy "Users can read own journal entries"
  on journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own journal entries"
  on journal_entries for insert
  with check (auth.uid() = user_id);

create policy "Service role bypass journal_entries"
  on journal_entries for all
  using (auth.role() = 'service_role');

-- ── 3. Journal entry lines ────────────────────────────────────────────────────

create table if not exists journal_entry_lines (
  id                  uuid primary key default gen_random_uuid(),
  journal_entry_id    uuid not null references journal_entries(id) on delete cascade,
  account_code        text not null,
  debit_amount        numeric(12,2) not null default 0,
  credit_amount       numeric(12,2) not null default 0,
  description         text,
  created_at          timestamptz default now(),
  constraint chk_one_side check (
    (debit_amount > 0 and credit_amount = 0) or
    (credit_amount > 0 and debit_amount = 0)
  )
);

alter table journal_entry_lines enable row level security;

-- Lines inherit access from parent journal_entry via user_id
create policy "Users can read own journal entry lines"
  on journal_entry_lines for select
  using (
    exists (
      select 1 from journal_entries je
      where je.id = journal_entry_id
      and je.user_id = auth.uid()
    )
  );

create policy "Users can insert own journal entry lines"
  on journal_entry_lines for insert
  with check (
    exists (
      select 1 from journal_entries je
      where je.id = journal_entry_id
      and je.user_id = auth.uid()
    )
  );

create policy "Service role bypass journal_entry_lines"
  on journal_entry_lines for all
  using (auth.role() = 'service_role');

-- ── 4. Index for fast lookup ──────────────────────────────────────────────────

create index if not exists idx_journal_entries_invoice_id
  on journal_entries(invoice_id);

create index if not exists idx_journal_entries_user_id
  on journal_entries(user_id);

create index if not exists idx_journal_entry_lines_entry_id
  on journal_entry_lines(journal_entry_id);
