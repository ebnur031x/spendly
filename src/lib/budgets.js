import { supabase } from './supabase'
import { monthKey } from './dates'

export function getBudget(userId, month = monthKey()) {
  return supabase.from('budgets').select('*')
    .eq('user_id', userId).eq('month', month).maybeSingle()
}

// Most recent budget row before `month` (any mode) — used to prefill the
// Budget Settings form when the current month has no row yet.
export function getLatestBudgetBefore(userId, month = monthKey()) {
  return supabase.from('budgets').select('*')
    .eq('user_id', userId).lt('month', month)
    .order('month', { ascending: false }).limit(1).maybeSingle()
}

// Create or update the month's budget row. Done as get-then-update/insert
// (rather than a DB upsert) so it also cleanly updates any legacy row that
// pre-existed for this month, without depending on a unique constraint.
// `category_budgets` is only included in the write when the caller passes
// it, so callers that don't know about per-bucket caps (the shared-budget
// edit flow) never touch that column.
export async function upsertBudget(userId, { main_monthly_budget, budget_mode, category_budgets }, month = monthKey()) {
  const { data: existing } = await getBudget(userId, month)
  const payload = { main_monthly_budget, budget_mode, month }
  if (category_budgets !== undefined) payload.category_budgets = category_budgets
  if (existing?.id) {
    return supabase.from('budgets').update(payload).eq('id', existing.id).select().single()
  }
  return supabase.from('budgets').insert({ user_id: userId, ...payload }).select().single()
}
