import { supabase } from './supabase'
import { monthKey, monthRange } from './dates'
import { isMissingSchema } from './schema'

/* ══════════════════════════════════════════════════════════════════
   THE budget calculation — the single source of truth.

   Every screen derives its numbers from this one snapshot so the math is
   identical everywhere:

     remaining = main_monthly_budget
       − Σ fixed_costs.amount
       − Σ expenses.amount        (this month, this user)
       − Σ daily_logs.total_spent (this month, this user)

   "Spent" (what fills the ring) = fixed + expenses + daily_logs, i.e.
   everything already committed against the budget. remaining = main − spent.

   Current-month expenses are matched on the `expenses.date` column. Every
   row logged through the app sets `date`, so a plain range filter captures
   all of this month's spending (legacy null-date rows only ever exist in
   past months and so can't belong to the current month anyway).
   ══════════════════════════════════════════════════════════════════ */
export async function loadBudgetSnapshot(userId, month = monthKey()) {
  const { start, end } = monthRange(month)

  const [budgetRes, fixedRes, expRes, logsRes, recentRes] = await Promise.all([
    supabase.from('budgets').select('*')
      .eq('user_id', userId).eq('month', month).maybeSingle(),
    supabase.from('fixed_costs').select('*')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('expenses').select('*')
      .eq('user_id', userId).gte('date', start).lt('date', end),
    supabase.from('daily_logs').select('*')
      .eq('user_id', userId).gte('date', start).lt('date', end),
    supabase.from('expenses').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ])

  // If any of the redesign tables/columns aren't set up yet, the caller
  // shows the one-time SQL setup screen instead of a broken dashboard.
  const missingSchema =
    isMissingSchema(budgetRes.error) ||
    isMissingSchema(fixedRes.error) ||
    isMissingSchema(logsRes.error)

  const budget = budgetRes.data ?? null
  const fixedCosts = fixedRes.data ?? []
  const monthExpenses = expRes.data ?? []
  const dailyLogs = logsRes.data ?? []
  const recentExpenses = recentRes.data ?? []

  const fixedTotal = sum(fixedCosts, 'amount')
  const expensesTotal = sum(monthExpenses, 'amount')
  const dailyLogsTotal = sum(dailyLogs, 'total_spent')
  const spent = fixedTotal + expensesTotal + dailyLogsTotal

  const main = budget ? Number(budget.main_monthly_budget) || 0 : 0
  const hasBudget = !!budget && main > 0
  const remaining = main - spent

  return {
    month,
    missingSchema,
    budget,
    hasBudget,
    budgetMode: budget?.budget_mode ?? 'shared',
    // raw rows (reused by the day-type + recent-expenses UI)
    fixedCosts,
    monthExpenses,
    dailyLogs,
    recentExpenses,
    // totals
    fixedTotal,
    expensesTotal,
    dailyLogsTotal,
    main,
    spent,
    remaining,
    // fraction of the budget already used — clamped to 0..1 for the ring
    usedFraction: main > 0 ? Math.min(1, Math.max(0, spent / main)) : 0,
    overBudget: hasBudget && spent > main,
  }
}

function sum(rows, key) {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}
