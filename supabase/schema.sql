-- Glitter Dolphiggy Biggy Bank: run once in the Supabase SQL editor.
-- One row per user holding the whole budget as JSON. "version" lets the app
-- notice when another device saved in between.

create table if not exists public.gdbb_budgets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.gdbb_budgets enable row level security;

drop policy if exists "gdbb own row: select" on public.gdbb_budgets;
drop policy if exists "gdbb own row: insert" on public.gdbb_budgets;
drop policy if exists "gdbb own row: update" on public.gdbb_budgets;
drop policy if exists "gdbb own row: delete" on public.gdbb_budgets;

create policy "gdbb own row: select" on public.gdbb_budgets
  for select using (auth.uid() = user_id);
create policy "gdbb own row: insert" on public.gdbb_budgets
  for insert with check (auth.uid() = user_id);
create policy "gdbb own row: update" on public.gdbb_budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gdbb own row: delete" on public.gdbb_budgets
  for delete using (auth.uid() = user_id);
