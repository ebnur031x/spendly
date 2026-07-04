import { supabase } from './supabase'
import { monthKey } from './dates'

export function getBudget(userId, month = monthKey()) {
  return supabase.from('budgets').select('*')
    .eq('user_id', userId).eq('month', month).maybeSingle()
}

// Create or update the month's budget row. Done as get-then-update/insert
// (rather than a DB upsert) so it also cleanly updates any legacy row that
// pre-existed for this month, without depending on a unique constraint.
export async function upsertBudget(userId, { main_monthly_budget, budget_mode }, month = monthKey()) {
  const { data: existing } = await getBudget(userId, month)
  const payload = { main_monthly_budget, budget_mode, month }
  if (existing?.id) {
    return supabase.from('budgets').update(payload).eq('id', existing.id).select().single()
  }
  return supabase.from('budgets').insert({ user_id: userId, ...payload }).select().single()
}
