import { supabase } from './supabase'

// A palette of distinct hues so each fixed cost gets its own dot/slice.
export const FIXED_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6',
  '#ef4444', '#14b8a6', '#a855f7', '#f97316', '#84cc16',
]

export function listFixedCosts(userId) {
  return supabase.from('fixed_costs').select('*')
    .eq('user_id', userId).order('created_at', { ascending: true })
}

export function createFixedCost(userId, { name, amount, color }) {
  return supabase.from('fixed_costs')
    .insert({ user_id: userId, name, amount, color })
    .select().single()
}

export function updateFixedCost(id, patch) {
  return supabase.from('fixed_costs').update(patch).eq('id', id).select().single()
}

export function deleteFixedCost(id) {
  return supabase.from('fixed_costs').delete().eq('id', id)
}
