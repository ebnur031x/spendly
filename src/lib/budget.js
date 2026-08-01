import { supabase } from './supabase'
import { monthKey, monthRange } from './dates'
import { isMissingSchema } from './schema'
import { indexSettings } from './buckets'
import { splitByBucket } from './bucketMath'

/* ══════════════════════════════════════════════════════════════════
   THE budget calculation — the single source of truth.

   Every screen derives its numbers from this one snapshot so the four
   buckets always net exactly against the one main monthly budget:

     remaining = main_monthly_budget
       − Σ expenses.amount        (this month, ALL buckets)
       − Σ daily_logs.total_spent (this month — counts as Daily Spend)
       − Σ commitment instances   (this month's materialized fixed_costs rows)

   Per-bucket "used" totals let each bucket track its own mini-budget:
       daily       = Σ expenses(bucket=daily)   + Σ daily_logs.total_spent
       groceries   = Σ expenses(bucket=groceries)
       bills        = Σ expenses(bucket=bills)
       commitments = Σ fixed_costs(month = this month)

   The daily bar / day-by-day log read `dailyExpenses` only, so bills,
   groceries and commitments never distort the daily picture.
   ══════════════════════════════════════════════════════════════════ */
export async function loadBudgetSnapshot(userId, month = monthKey()) {
  const { start, end } = monthRange(month)

  const [budgetRes, commitRes, expRes, logsRes, settingsRes, recentRes] = await Promise.all([
    supabase.from('budgets').select('*')
      .eq('user_id', userId).eq('month', month).maybeSingle(),
    // Commitments = this month's materialized instances (templates have month = null)
    supabase.from('fixed_costs').select('*')
      .eq('user_id', userId).eq('month', month)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('expenses').select('*')
      .eq('user_id', userId).gte('date', start).lt('date', end),
    supabase.from('daily_logs').select('*')
      .eq('user_id', userId).gte('date', start).lt('date', end),
    supabase.from('bucket_settings').select('*').eq('user_id', userId),
    supabase.from('expenses').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(12),
  ])

  // If any redesign table/column isn't set up yet, the caller shows the
  // one-time SQL setup screen instead of a broken dashboard.
  const missingSchema =
    isMissingSchema(budgetRes.error) ||
    isMissingSchema(commitRes.error) ||
    isMissingSchema(logsRes.error) ||
    isMissingSchema(settingsRes.error)

  const budget = budgetRes.data ?? null
  const commitmentInstances = commitRes.data ?? []
  const monthExpenses = expRes.data ?? []
  const dailyLogs = logsRes.data ?? []
  const bucketSettings = settingsRes.data ?? []
  const recentExpenses = recentRes.data ?? []

  const {
    dailyExpenses, groceryExpenses, billsExpenses,
    dailyLogsTotal, dailyTotal, groceriesTotal, billsTotal, commitmentsTotal,
    spent, bucketTotals,
  } = splitByBucket({ monthExpenses, dailyLogs, commitmentInstances })

  const main = budget ? Number(budget.main_monthly_budget) || 0 : 0
  const hasBudget = !!budget && main > 0
  const remaining = main - spent

  return {
    month,
    missingSchema,
    budget,
    hasBudget,
    budgetMode: budget?.budget_mode ?? 'shared',

    // raw rows
    monthExpenses,
    dailyExpenses,
    groceryExpenses,
    billsExpenses,
    commitmentInstances,
    dailyLogs,
    recentExpenses,
    bucketSettings,
    settingsByBucket: indexSettings(bucketSettings),

    // per-bucket used totals (sum to `spent`)
    dailyTotal,
    dailyLogsTotal,
    groceriesTotal,
    billsTotal,
    commitmentsTotal,
    bucketTotals,

    // top-line
    main,
    spent,
    remaining,
    usedFraction: main > 0 ? Math.min(1, Math.max(0, spent / main)) : 0,
    overBudget: hasBudget && spent > main,
  }
}

// Permanently wipe a single month back to a blank first-time state: its
// expenses, daily logs, this month's commitment instances (the recurring
// templates themselves are untouched, so they still show up as "Suggested"
// afterwards), and its budget row. Never touches any other month.
export async function resetMonth(userId, month) {
  const { start, end } = monthRange(month)
  const [expRes, logsRes, fixedRes, budgetRes] = await Promise.all([
    supabase.from('expenses').delete().eq('user_id', userId).gte('date', start).lt('date', end),
    supabase.from('daily_logs').delete().eq('user_id', userId).gte('date', start).lt('date', end),
    supabase.from('fixed_costs').delete().eq('user_id', userId).eq('month', month),
    supabase.from('budgets').delete().eq('user_id', userId).eq('month', month),
  ])
  const error = expRes.error ?? logsRes.error ?? fixedRes.error ?? budgetRes.error ?? null
  return { error }
}
