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
    .select('id, date, day_type_id, sent_log_id, deepdive_daily_log_items (id, name, amount)')
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

/* ── Send to Daily Spend — the bridge to the REAL budget ──
   The deep-dive is a private planning copy and never touches expenses/
   budgets/bucket_settings on its own. Sending a day writes one real
   daily_logs row (the same shape "Log Today" already produces), so it
   counts toward the actual Daily Spend total and the main budget ring. */

// Insert a new real daily_logs row, or — if `existingRealLogId` is given —
// update that same row in place, so re-sending an already-sent day never
// creates a second real entry. If the linked row no longer exists (e.g. it
// was deleted directly from Daily Spend), the update matches nothing —
// falls back to inserting fresh rather than failing, so re-sending always
// gets the day into the real table instead of erroring on a dead link.
export async function sendDayToRealLog(userId, date, items, totalSpent, note, existingRealLogId) {
  const payload = { user_id: userId, date, day_type_id: null, expenses: items, total_spent: totalSpent, notes: note }
  if (existingRealLogId) {
    const { data, error } = await supabase.from('daily_logs').update(payload).eq('id', existingRealLogId).select()
    if (error) return { data: null, error }
    if (data && data.length > 0) return { data: data[0], error: null }
  }
  return supabase.from('daily_logs').insert(payload).select().single()
}

// Record which real daily_logs row this deep-dive day was sent to, so the
// page can show "Sent ✓" and re-sending targets the same real row. No
// .select() here on purpose — the caller already holds the full log (with
// its items) and only needs to know this succeeded, not get a row shape
// back that's missing the nested items.
export function markLogSent(deepdiveLogId, realLogId) {
  return supabase.from('deepdive_daily_log').update({ sent_log_id: realLogId }).eq('id', deepdiveLogId)
}

// Undo a send: removes the real daily_logs row it created (if it's still
// there) and clears the link, so the day goes back to "not sent" — its
// deep-dive items are untouched, so you can fix them and send again clean.
export async function undoSend(deepdiveLogId, realLogId) {
  if (realLogId) {
    const { error } = await supabase.from('daily_logs').delete().eq('id', realLogId)
    if (error) return { error }
  }
  const { error } = await supabase.from('deepdive_daily_log').update({ sent_log_id: null }).eq('id', deepdiveLogId)
  return { error }
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
