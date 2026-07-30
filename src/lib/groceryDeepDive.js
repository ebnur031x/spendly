import { supabase } from './supabase'
import { startOfWeek, parseKey, dayKey, weekRangeLabel } from './dates'

/* ══════════════════════════════════════════════════════════════════
   Data layer for the Groceries deep-dive (see GroceriesDeepDive page).
   Deliberately flat: one row per thing bought — no reusable item pool, no
   trip wrapper. Log a name, a price, a date; weekly and monthly totals
   fall out of grouping that list. Entirely separate from
   expenses/budgets — nothing here touches those, except the explicit
   "set as my Groceries budget" action, which writes bucket_settings on
   request only (see GroceriesDeepDive.jsx).
   ══════════════════════════════════════════════════════════════════ */

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Every item bought in a "YYYY-MM" month, newest first. [start, end) half-
// open window — bounded by the real calendar month, not by "today", so an
// early-month entry (the 3rd, say) is never dropped, and next month starts
// completely empty regardless of how the switch happens.
export function listLogItems(userId, month) {
  return supabase.from('grocery_log_items').select('*')
    .eq('user_id', userId)
    .gte('date', `${month}-01`).lt('date', `${nextMonth(month)}-01`)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
}

export function addLogItem(userId, { date, name, amount }) {
  return supabase.from('grocery_log_items')
    .insert({ user_id: userId, date, name, amount }).select().single()
}

export function updateLogItem(id, patch) {
  return supabase.from('grocery_log_items').update(patch).eq('id', id).select().single()
}

export function deleteLogItem(id) {
  return supabase.from('grocery_log_items').delete().eq('id', id)
}

// Buckets an (already month-scoped) item list into calendar weeks, newest
// first. Weeks are NOT clipped to the month — an item near a month
// boundary can fall in a week that spans into the next/previous one, and
// the label should show the real week, not a truncated one.
export function groupItemsByWeek(items) {
  const map = new Map()
  for (const item of items) {
    const start = startOfWeek(parseKey(item.date))
    const key = dayKey(start)
    if (!map.has(key)) map.set(key, { key, start, items: [], total: 0 })
    const bucket = map.get(key)
    bucket.items.push(item)
    bucket.total += Number(item.amount) || 0
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(w => ({ ...w, label: weekRangeLabel(w.start) }))
}
