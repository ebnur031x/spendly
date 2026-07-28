/* ══════════════════════════════════════════════════════════════════
   One-time database setup for the Spendly redesign.

   The app can't run DDL with the anon key, so — matching the pattern the
   rest of the app already uses — when a query hits a missing table/column
   we surface this SQL for the user to paste into the Supabase SQL editor
   (Dashboard → SQL → New query → Run). Safe to run multiple times.

   Keeps the existing `expenses` table and its data untouched.
   ══════════════════════════════════════════════════════════════════ */
export const SETUP_SQL = `-- Spendly redesign schema — safe to run more than once.
-- Keeps the existing "expenses" table and its data as-is.

-- 1. budgets ───────────────────────────────────────────────
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table budgets add column if not exists main_monthly_budget numeric;
alter table budgets add column if not exists budget_mode text default 'shared';
alter table budgets add column if not exists month text;
alter table budgets add column if not exists category_budgets jsonb not null default '{}'::jsonb;
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

-- ══════════════════════════════════════════════════════════
-- FOUR BUCKETS restructure. Adds a bucket axis to expenses, turns
-- fixed_costs into the Commitments store (templates + monthly instances),
-- and adds per-bucket settings. Everything below is additive + idempotent.
-- ══════════════════════════════════════════════════════════

-- 5. expenses.bucket — daily | groceries | bills ───────────
--    (Commitments are NOT expenses; they live in fixed_costs.)
alter table expenses add column if not exists bucket text not null default 'daily';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_bucket_check') then
    alter table expenses add constraint expenses_bucket_check
      check (bucket in ('daily','groceries','bills'));
  end if;
end $$;
create index if not exists expenses_user_bucket_idx on expenses (user_id, bucket);

-- 6. fixed_costs → Commitments store ───────────────────────
--    month = null  → a standing template ("Rent ৳8000, monthly")
--    month = 'YYYY-MM' → a materialized, fully-editable entry for that month
alter table fixed_costs add column if not exists month text;
alter table fixed_costs add column if not exists template_id uuid references fixed_costs(id) on delete cascade;
alter table fixed_costs add column if not exists due_date date;
alter table fixed_costs add column if not exists recurrence text not null default 'monthly';
alter table fixed_costs add column if not exists active boolean not null default true;
alter table fixed_costs add column if not exists last_generated_month text;
create index if not exists fixed_costs_user_month_idx on fixed_costs (user_id, month);

-- 7. bucket_settings — per-user config for each of the 4 buckets ─
create table if not exists bucket_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('daily','groceries','bills','commitments')),
  mini_budget numeric,
  cap_period text not null default 'monthly' check (cap_period in ('monthly','daily')),
  icon text,
  color text,
  created_at timestamptz default now(),
  unique (user_id, bucket)
);
alter table bucket_settings enable row level security;
drop policy if exists "own bucket_settings" on bucket_settings;
create policy "own bucket_settings" on bucket_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Daily Spend deep-dive — a standalone calculator reached from Budget
-- Settings. Prefixed "deepdive_" because "day_types" is already taken by
-- the unrelated Log Today feature above. Purely additive: does not read
-- from or write to budgets/expenses/bucket_settings.
-- ══════════════════════════════════════════════════════════

-- 8. deepdive_items — reusable named amounts ("Uni bus" ৳140) ─
create table if not exists deepdive_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  created_at timestamptz default now()
);
alter table deepdive_items enable row level security;
drop policy if exists "own deepdive_items" on deepdive_items;
create policy "own deepdive_items" on deepdive_items for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 9. deepdive_day_types — reusable named day profiles ("Uni Day") ─
create table if not exists deepdive_day_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
-- A day type is just a name + what a day of it costs. (Earlier versions
-- summed this from deepdive_items via deepdive_day_type_items; that pool
-- was removed, so the figure is typed in directly.)
alter table deepdive_day_types add column if not exists cost_per_day numeric not null default 0;
alter table deepdive_day_types enable row level security;
drop policy if exists "own deepdive_day_types" on deepdive_day_types;
create policy "own deepdive_day_types" on deepdive_day_types for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10. deepdive_day_type_items — items x quantity inside a day type ─
create table if not exists deepdive_day_type_items (
  id uuid primary key default gen_random_uuid(),
  day_type_id uuid not null references deepdive_day_types(id) on delete cascade,
  daily_item_id uuid not null references deepdive_items(id) on delete cascade,
  quantity numeric not null default 1,
  created_at timestamptz default now()
);
create index if not exists deepdive_dti_day_type_idx on deepdive_day_type_items (day_type_id);
alter table deepdive_day_type_items enable row level security;
drop policy if exists "own deepdive_day_type_items" on deepdive_day_type_items;
create policy "own deepdive_day_type_items" on deepdive_day_type_items for all to authenticated
  using (exists (select 1 from deepdive_day_types dt where dt.id = day_type_id and dt.user_id = auth.uid()))
  with check (exists (select 1 from deepdive_day_types dt where dt.id = day_type_id and dt.user_id = auth.uid()));

-- 11. deepdive_daily_log — one row per calendar date actually logged ─
--     day_type_id is only the template the day started from: it may be null
--     ("just these items"), and deleting that day type leaves the logged
--     day itself intact.
create table if not exists deepdive_daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  day_type_id uuid references deepdive_day_types(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_id, date)
);
create index if not exists deepdive_daily_log_user_date_idx on deepdive_daily_log (user_id, date);
alter table deepdive_daily_log enable row level security;
drop policy if exists "own deepdive_daily_log" on deepdive_daily_log;
create policy "own deepdive_daily_log" on deepdive_daily_log for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 12. deepdive_daily_log_items — what was actually spent on that date ─
--     Independent COPIES of a day type's items, never live references, so
--     editing a deepdive_items row later never rewrites logged history.
create table if not exists deepdive_daily_log_items (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references deepdive_daily_log(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists deepdive_dli_log_idx on deepdive_daily_log_items (daily_log_id);
alter table deepdive_daily_log_items enable row level security;
drop policy if exists "own deepdive_daily_log_items" on deepdive_daily_log_items;
create policy "own deepdive_daily_log_items" on deepdive_daily_log_items for all to authenticated
  using (exists (select 1 from deepdive_daily_log dl where dl.id = daily_log_id and dl.user_id = auth.uid()))
  with check (exists (select 1 from deepdive_daily_log dl where dl.id = daily_log_id and dl.user_id = auth.uid()));

-- 13. deepdive_allocations — day_count per day type, per month ─
--     Drives section 3: how many days of each type this month, with the
--     sum bounded by the month's real length. One row per (user, month,
--     day type); the unique constraint is what the upsert keys on.
create table if not exists deepdive_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  day_type_id uuid not null references deepdive_day_types(id) on delete cascade,
  day_count integer not null default 0,
  created_at timestamptz default now(),
  unique (user_id, month, day_type_id)
);
create index if not exists deepdive_allocations_user_month_idx on deepdive_allocations (user_id, month);
alter table deepdive_allocations enable row level security;
drop policy if exists "own deepdive_allocations" on deepdive_allocations;
create policy "own deepdive_allocations" on deepdive_allocations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);`

// Postgres error codes we treat as "the redesign schema isn't set up yet":
//   42P01 → undefined_table (a new table doesn't exist)
//   42703 → undefined_column (budgets is missing main_monthly_budget etc.)
const MISSING_CODES = new Set(['42P01', '42703'])
const MISSING_RE = /fixed_costs|day_types|daily_logs|bucket_settings|deepdive_|main_monthly_budget|budget_mode|expenses\.bucket|column .*bucket|does not exist|schema cache/i

export function isMissingSchema(error) {
  if (!error) return false
  if (MISSING_CODES.has(error.code)) return true
  return MISSING_RE.test(error.message || '')
}
