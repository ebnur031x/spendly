// Shared date helpers for day + week bucketing.
// Week model (Bangladesh): weeks start on Sunday, weekend = Friday & Saturday.
// Uni days are Sun–Thu, so a Friday/Saturday review lands at the end of the week.

export function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// The day an expense belongs to: explicit date, else the day it was logged.
export function expenseDay(e) {
  if (e.date) return e.date
  if (e.created_at) return dayKey(new Date(e.created_at))
  return null
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/* ── Month helpers (drive the budget math + setup screen) ── */

// "2026-07" for the given date (defaults to today).
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Full name for a "2026-07" key, e.g. "July".
export function monthName(key = monthKey()) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' })
}

// "July 2026" for a "2026-07" key.
export function monthLabel(key = monthKey()) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

// Inclusive first / exclusive last day-keys of a month, for range filters:
//   { start: "2026-07-01", end: "2026-08-01" }
export function monthRange(key = monthKey()) {
  const [y, m] = key.split('-').map(Number)
  return { start: dayKey(new Date(y, m - 1, 1)), end: dayKey(new Date(y, m, 1)) }
}

// Shift a "YYYY-MM" key by `delta` months (negative goes back), e.g.
// shiftMonth("2026-12", 1) === "2027-01".
export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

export function daysInMonth(key = monthKey()) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// Whole days remaining in the month *after* today (0 on the last day).
// Only meaningful for the current month; returns 0 for past/future keys.
export function daysLeftInMonth(now = new Date()) {
  return Math.max(0, daysInMonth(monthKey(now)) - now.getDate())
}

// Every date in a month, first to last — the whole calendar month, always
// (28/29/30/31), never truncated at today. Drives the deep-dive spine.
export function monthDates(key = monthKey()) {
  const [y, m] = key.split('-').map(Number)
  return Array.from({ length: daysInMonth(key) }, (_, i) => {
    const d = new Date(y, m - 1, i + 1)
    return {
      key: dayKey(d),
      dayNum: i + 1,
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase(),
    }
  })
}

// Split a month's dates into calendar weeks (Sunday-start, per the app's
// Bangladesh week model). Weeks are CLIPPED to the month — the first and
// last are usually partial — so grouping can never pull in a neighbouring
// month's dates. Label reads "Jul 1 – 4".
export function groupDatesByWeek(dates) {
  const weeks = []
  let current = null
  for (const d of dates) {
    const wk = dayKey(startOfWeek(parseKey(d.key)))
    if (!current || current.key !== wk) {
      current = { key: wk, days: [] }
      weeks.push(current)
    }
    current.days.push(d)
  }
  const monthShort = (k) => parseKey(k).toLocaleDateString(undefined, { month: 'short' })
  for (const w of weeks) {
    const first = w.days[0]
    const last = w.days[w.days.length - 1]
    w.label = first === last
      ? `${monthShort(first.key)} ${first.dayNum}`
      : `${monthShort(first.key)} ${first.dayNum} – ${last.dayNum}`
  }
  return weeks
}

// Midnight of the Sunday on/before d.
export function startOfWeek(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay()) // getDay(): Sun = 0
  return x
}

// Bangladesh weekend = Friday (5) & Saturday (6).
export function isWeekendDay(d) {
  const g = d.getDay()
  return g === 5 || g === 6
}

export function sameWeek(a, b) {
  return dayKey(startOfWeek(a)) === dayKey(startOfWeek(b))
}

// "Jun 1 – 7" (same month) or "Jun 29 – Jul 5" (crossing months).
export function weekRangeLabel(start) {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const s = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const e = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' },
  )
  return `${s} – ${e}`
}
