-- ════════════════════════════════════════════════════════════════
-- Spendly redesign — one-time database setup
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to run more than once. Keeps the existing "expenses" table + data.
-- (This mirrors SETUP_SQL in src/lib/schema.js, which the app also shows
--  in-app with a copy button if it detects the schema is missing.)
-- ════════════════════════════════════════════════════════════════

-- 1. budgets ───────────────────────────────────────────────
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table budgets add column if not exists main_monthly_budget numeric;
alter table budgets add column if not exists budget_mode text default 'shared';
alter table budgets add column if not exists month text;
-- If this table pre-existed with a NOT NULL "monthly_budget" column, relax it
-- so the redesign can insert rows without that legacy field.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'budgets' and column_name = 'monthly_budget') then
    alter table budgets alter column monthly_budget drop not null;
  end if;
end $$;
create index if not exists budgets_user_month_idx on budgets (user_id, month);
alter table budgets enable row level security;
drop policy if exists "own budgets" on budgets;
create policy "own budgets" on budgets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. fixed_costs ───────────────────────────────────────────
create table if not exists fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);
alter table fixed_costs enable row level security;
drop policy if exists "own fixed_costs" on fixed_costs;
create policy "own fixed_costs" on fixed_costs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. day_types ─────────────────────────────────────────────
create table if not exists day_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#6366f1',
  sub_budget numeric,
  expense_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table day_types enable row level security;
drop policy if exists "own day_types" on day_types;
create policy "own day_types" on day_types for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. daily_logs ────────────────────────────────────────────
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  day_type_id uuid references day_types(id) on delete set null,
  expenses jsonb not null default '[]'::jsonb,
  total_spent numeric not null default 0,
  notes text,
  created_at timestamptz default now()
);
create index if not exists daily_logs_user_date_idx on daily_logs (user_id, date);
alter table daily_logs enable row level security;
drop policy if exists "own daily_logs" on daily_logs;
create policy "own daily_logs" on daily_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
