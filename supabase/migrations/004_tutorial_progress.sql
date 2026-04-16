-- ── Migration 004: Tutorial progress ─────────────────────────────────────────
-- Run in Supabase SQL Editor after migrations 001-003.

create table if not exists user_tutorial_progress (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  completed     boolean not null default false,
  skipped       boolean not null default false,
  current_step  integer not null default 0,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now()
);

-- RLS
alter table user_tutorial_progress enable row level security;

create policy "Users can manage own tutorial progress"
  on user_tutorial_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
