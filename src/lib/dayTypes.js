import { supabase } from './supabase'

// Seeded once for a new user so Log Today has something to offer straight
// away. After that day types are entirely user-owned (rename / recolor /
// edit fields / delete freely, add as many custom ones as they like).
export const DEFAULT_DAY_TYPES = [
  {
    name: 'Uni Day', slug: 'uni', color: '#6366f1', sub_budget: null,
    expense_fields: [
      { label: 'Transport to Uni', default_amount: 55 },
      { label: 'Transport Home', default_amount: 140 },
      { label: 'Food', default_amount: 0 },
      { label: 'Academic Expense', default_amount: 0, optional: true },
    ],
  },
  {
    name: 'Normal Day', slug: 'normal', color: '#22c55e', sub_budget: null,
    expense_fields: [
      { label: 'Food', default_amount: 0 },
      { label: 'Transport', default_amount: 0 },
      { label: 'Other', default_amount: 0, optional: true },
    ],
  },
  {
    name: 'Occasional Day', slug: 'occasional', color: '#f59e0b', sub_budget: null,
    expense_fields: [
      { label: 'Description', default_amount: 0 },
      { label: 'Amount', default_amount: 0 },
    ],
  },
]

export const DAY_TYPE_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6',
  '#ef4444', '#14b8a6', '#a855f7', '#f97316', '#0ea5e9',
]

export function listDayTypes(userId) {
  return supabase.from('day_types').select('*')
    .eq('user_id', userId).order('created_at', { ascending: true })
}

// Seed the three defaults the first time a user has none. Guarded by a
// localStorage flag so someone who deletes them all doesn't get them back.
export async function seedDefaultDayTypesIfEmpty(userId) {
  const { data, error } = await listDayTypes(userId)
  if (error) return { data: [], error }
  if (data.length > 0) return { data, error: null }

  const flag = `spendly.dayTypesSeeded.${userId}`
  try { if (localStorage.getItem(flag)) return { data: [], error: null } } catch {}

  const rows = DEFAULT_DAY_TYPES.map(d => ({ user_id: userId, ...d }))
  const { data: seeded, error: insErr } = await supabase.from('day_types').insert(rows).select()
  if (insErr) return { data: [], error: insErr }
  try { localStorage.setItem(flag, '1') } catch {}
  return { data: seeded ?? [], error: null }
}

export function createDayType(userId, dt) {
  return supabase.from('day_types').insert({ user_id: userId, ...dt }).select().single()
}

export function updateDayType(id, patch) {
  return supabase.from('day_types').update(patch).eq('id', id).select().single()
}

export function deleteDayType(id) {
  return supabase.from('day_types').delete().eq('id', id)
}

// Per-type rollup for the dashboard cards: spend + distinct days logged this
// month, and usage against sub_budget when one is set.
export function summarizeDayTypes(dayTypes, dailyLogs) {
  const byType = {}
  for (const log of dailyLogs) {
    const key = log.day_type_id || 'none'
    const bucket = (byType[key] ??= { spent: 0, dates: new Set() })
    bucket.spent += Number(log.total_spent) || 0
    bucket.dates.add(log.date)
  }
  return dayTypes.map(dt => {
    const agg = byType[dt.id] || { spent: 0, dates: new Set() }
    const sub = dt.sub_budget != null ? Number(dt.sub_budget) : null
    return {
      ...dt,
      spent: agg.spent,
      daysLogged: agg.dates.size,
      subBudget: sub,
      pct: sub && sub > 0 ? Math.min(100, (agg.spent / sub) * 100) : null,
      overSub: sub != null && sub > 0 && agg.spent > sub,
    }
  })
}

// The seed "Occasional Day" uses a "Description" field that's really a note,
// not an amount. Treat description/note-labelled fields as free text so they
// don't get summed into the day's total.
export function isTextField(field) {
  return /descr|note/i.test(field?.label || '')
}
