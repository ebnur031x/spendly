import { supabase } from './supabase'
import { monthRange } from './dates'

/* ══════════════════════════════════════════════════════════════════
   Data layer for the Daily Spend deep-dive calculator (see DailyDeepDive
   page). Two live concerns:
     - deepdive_daily_log (+ _items) — what actually happened, one row per
       calendar date, items typed freehand per date.
     - deepdive_day_types — a name and what a day of that shape costs,
       used to label dates and to project the month.
   Entirely separate from expenses/budgets/bucket_settings.
   ══════════════════════════════════════════════════════════════════ */

/* ── Day types ── */

export function listDayTypes(userId) {
  return supabase.from('deepdive_day_types').select('*')
    .eq('user_id', userId).order('created_at', { ascending: true })
}

export function createDayType(userId, name, costPerDay = 0) {
  return supabase.from('deepdive_day_types')
    .insert({ user_id: userId, name, cost_per_day: costPerDay }).select().single()
}

export function updateDayType(id, patch) {
  return supabase.from('deepdive_day_types').update(patch).eq('id', id).select().single()
}

export function deleteDayType(id) {
  return supabase.from('deepdive_day_types').delete().eq('id', id)
}

export function dayTypeCost(dt) {
  return Number(dt?.cost_per_day || 0)
}

// A day type's reusable "usually cost this" items (e.g. Uni Day's bus
// fares) — typed once, then reused as quick-add chips inside a single day's
// log or copied into every day at once via bulkFillDayType. Purely a
// convenience default: separate from cost_per_day, and never itself summed
// into the mix/plan math.
export function defaultItemsOf(dt) {
  return dt?.default_items ?? []
}

/* ── Daily log — one row per calendar date ── */

// Every logged date in a "YYYY-MM" month, items nested in one round trip.
export function listDailyLogs(userId, month) {
  const { start, end } = monthRange(month)
  return supabase.from('deepdive_daily_log')
    .select('id, date, day_type_id, deepdive_daily_log_items (id, name, amount)')
    .eq('user_id', userId)
    .gte('date', start).lt('date', end)
    .order('date', { ascending: true })
}

// Write (or overwrite) one date's log. Items are replaced wholesale rather
// than diffed — a save always means "this is what that day was".
export async function saveDailyLog(userId, date, dayTypeId, items) {
  const { data: log, error } = await supabase.from('deepdive_daily_log')
    .upsert({ user_id: userId, date, day_type_id: dayTypeId ?? null }, { onConflict: 'user_id,date' })
    .select().single()
  if (error) return { data: null, error }

  const { error: delErr } = await supabase.from('deepdive_daily_log_items')
    .delete().eq('daily_log_id', log.id)
  if (delErr) return { data: null, error: delErr }

  const rows = items
    .filter(it => it.name.trim() && Number(it.amount) > 0)
    .map(it => ({ daily_log_id: log.id, name: it.name.trim(), amount: Number(it.amount) }))
  // A day with nothing on it is still a logged day — ৳0 spent is real data.
  if (rows.length === 0) return { data: { ...log, deepdive_daily_log_items: [] }, error: null }

  const { data: saved, error: insErr } = await supabase
    .from('deepdive_daily_log_items').insert(rows).select()
  if (insErr) return { data: null, error: insErr }
  return { data: { ...log, deepdive_daily_log_items: saved ?? [] }, error: null }
}

// Items cascade on delete, so the day goes back to "not logged".
export function deleteDailyLog(id) {
  return supabase.from('deepdive_daily_log').delete().eq('id', id)
}

export function dailyLogTotal(log) {
  return (log?.deepdive_daily_log_items ?? [])
    .reduce((sum, it) => sum + Number(it.amount || 0), 0)
}

// Copy a day type's default items into every one of `dates` at once (e.g.
// "apply Uni Day to every day this month"). Each date is only ever the ones
// the caller has already filtered to not-yet-logged, so an existing day's
// own edits are never touched or overwritten.
export async function bulkFillDayType(userId, dates, dayTypeId, items) {
  const results = await Promise.all(dates.map(date => saveDailyLog(userId, date, dayTypeId, items)))
  const error = results.find(r => r.error)?.error ?? null
  return { error, filled: results.filter(r => !r.error).length }
}

/* ── Monthly allocations ── */

// Scoped to one "YYYY-MM" key; the screen only ever passes the current month.
export function listAllocations(userId, month) {
  return supabase.from('deepdive_allocations').select('*')
    .eq('user_id', userId).eq('month', month)
}

export function saveAllocation(userId, month, dayTypeId, dayCount) {
  return supabase.from('deepdive_allocations')
    .upsert(
      { user_id: userId, month, day_type_id: dayTypeId, day_count: dayCount },
      { onConflict: 'user_id,month,day_type_id' },
    )
    .select().single()
}

/* ── deepdive_items / deepdive_day_type_items — DORMANT ──
   The shared item pool and its day-type links were removed on 2026-07-28:
   a day type now carries a typed `cost_per_day`, and per-date spending is
   typed freehand into deepdive_daily_log_items. The tables were kept rather
   than dropped, but nothing reads or writes them any more. */
