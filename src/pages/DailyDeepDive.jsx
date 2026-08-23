import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import MonthTitle from '../components/MonthTitle'
import { money, money0 } from '../lib/format'
import { monthKey, monthLabel, daysInMonth, dayKey, monthDates, groupDatesByWeek } from '../lib/dates'
import { isMissingSchema } from '../lib/schema'
import { bucketMeta, ensureBucketSettings, updateBucketSetting, indexSettings } from '../lib/buckets'
import {
  listDayTypes, createDayType, updateDayType, deleteDayType, dayTypeCost,
  listDailyLogs, dailyLogTotal, defaultItemsOf, bulkFillDayType,
  sendDayToRealLog, markLogSent, undoSend,
  listAllocations, saveAllocation,
} from '../lib/dailyDeepDive'
import Reveal from '../components/Reveal'
import SetupScreen from '../components/SetupScreen'
import DeepDiveDayModal from '../components/DeepDiveDayModal'

/* ══════════════════════════════════════════════════════════════════
   Daily Spend deep-dive — a standalone budgeting calculator reached from
   Budget Settings. Two sections: the month day by day (what actually
   happened), then day types and this month's mix (what you're planning).
   Purely additive — does not read or write budgets/expenses/bucket_settings.

   ONE MONTH ONLY: `month` is a plain `monthKey()` — today's "YYYY-MM" — and
   never becomes state. The spine runs the full calendar month start to end
   and day counts are bounded by daysInMonth(month), so the screen can only
   ever describe a single month.
   ══════════════════════════════════════════════════════════════════ */

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}
const editBtnStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'var(--surface-2)', border: '1.5px solid var(--border-soft)',
  color: 'var(--n500)', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const sectionLabelStyle = { color: 'var(--n400)', letterSpacing: '0.07em' }

/* Spine geometry. The <li> sits inside the <ul>'s left padding, so the
   marker and spine hang back into that gutter at negative offsets. In gutter
   coordinates the marker spans x 0–10 and the spine x 4–6 — both centred on
   x 5. MARKER_TOP centres the marker on the 20px date row. */
const SPINE_W = 2
const TRACK = 30
const MARKER_LEFT = -TRACK
const SPINE_LEFT = -TRACK + 4
// Day node: centred on the 20px date row → centre y 10.
const MARKER = 10
const MARKER_TOP = 5
// Week node: slightly larger, centred on the header button's label. The
// button is py-2.5 around a 20px line, so its label centre sits at y 20.
const WEEK_MARKER = 12
const WEEK_MARKER_TOP = 14
const nodeTop = r => (r.kind === 'week' ? WEEK_MARKER_TOP : MARKER_TOP)
const nodeSize = r => (r.kind === 'week' ? WEEK_MARKER : MARKER)

const MONTH_RE = /^\d{4}-\d{2}$/

function parseAllocValue(raw) {
  const n = parseInt(raw, 10)
  return isNaN(n) || n < 0 ? 0 : n
}

export default function DailyDeepDive() {
  const { user } = useAuth()
  const { deleteWithUndo } = useUndoableDelete()
  const daily = bucketMeta('daily')

  // Re-derived on an interval rather than captured once at mount: a tab left
  // open across midnight on the 31st would otherwise keep showing last month.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => {
      setNow(prev => (dayKey(prev) === dayKey(new Date()) ? prev : new Date()))
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Follows the month you're browsing, same ?month= contract as Dashboard and
  // Budget Settings — otherwise stepping those to August left this screen
  // stuck on the real current month. Absent//malformed param → current month.
  const [searchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const today = dayKey(now)
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKey(now)
  const isCurrentMonth = month === monthKey(now)
  const totalDays = daysInMonth(month)
  const weeks = useMemo(() => groupDatesByWeek(monthDates(month)), [month])

  const [loading, setLoading] = useState(true)
  const [missingSchema, setMissingSchema] = useState(false)
  const [error, setError] = useState('')

  const [dayTypes, setDayTypes] = useState([])
  const [logs, setLogs] = useState([])
  const [allocMap, setAllocMap] = useState({})   // { day_type_id: "3" }
  const [costMap, setCostMap] = useState({})     // { day_type_id: "110" }
  const [editingDate, setEditingDate] = useState(null)
  const [openWeeks, setOpenWeeks] = useState({}) // { weekKey: true }
  const [dailySetting, setDailySetting] = useState(null) // bucket_settings row for 'daily'
  const syncingRef = useRef(false)

  // day type composer
  const [dayTypeName, setDayTypeName] = useState('')
  const [dayTypeCostInput, setDayTypeCostInput] = useState('')
  const [savingDayType, setSavingDayType] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  // allocation
  const [overAllocWarning, setOverAllocWarning] = useState(null) // { id, room }
  const warnTimerRef = useRef(null)

  // default items (per day type "usually cost this" list)
  const [openDefaults, setOpenDefaults] = useState({})     // { [dayTypeId]: true }
  const [newDefaultItem, setNewDefaultItem] = useState({}) // { [dayTypeId]: { name, amount } }
  const [bulkConfirmId, setBulkConfirmId] = useState(null) // day type id pending bulk-apply confirm
  const [bulkApplying, setBulkApplying] = useState(false)

  // send to Daily Spend (the real budget)
  const [sendingKey, setSendingKey] = useState(null)       // date currently being sent
  const [sendWeekConfirm, setSendWeekConfirm] = useState(null) // week object pending confirm
  const [sendingWeekKey, setSendingWeekKey] = useState(null)
  const [undoingKey, setUndoingKey] = useState(null)       // date currently being un-sent
  const anySendBusy = sendingKey !== null || sendingWeekKey !== null || undoingKey !== null

  // Keyed on `month` so a rollover past midnight refetches into the new month
  // instead of leaving the previous month's rows on screen.
  useEffect(() => { load() /* eslint-disable-next-line */ }, [month])

  async function load() {
    setLoading(true)
    const [dayTypesRes, logsRes, allocRes, settingsRes] = await Promise.all([
      listDayTypes(user.id),
      listDailyLogs(user.id, month),
      listAllocations(user.id, month),
      ensureBucketSettings(user.id),
    ])
    if ([dayTypesRes, logsRes, allocRes].some(r => isMissingSchema(r.error))) {
      setMissingSchema(true); setLoading(false); return
    }
    for (const r of [dayTypesRes, logsRes, allocRes]) if (r.error) setError(r.error.message)
    setDailySetting(indexSettings(settingsRes.data ?? [])['daily'] ?? null)

    const loadedDayTypes = dayTypesRes.data ?? []
    setDayTypes(loadedDayTypes)
    setLogs(logsRes.data ?? [])

    const costs = {}
    for (const dt of loadedDayTypes) costs[dt.id] = String(dt.cost_per_day ?? 0)
    setCostMap(costs)

    const alloc = {}
    for (const a of allocRes.data ?? []) alloc[a.day_type_id] = String(a.day_count)
    setAllocMap(alloc)

    setLoading(false)
  }

  /* ── The month, day by day ── */

  const logsByDate = useMemo(() => {
    const map = {}
    for (const l of logs) map[l.date] = l
    return map
  }, [logs])

  const dayTypeLabel = (id) => dayTypes.find(dt => dt.id === id)?.name ?? null

  const allDays = useMemo(() => weeks.flatMap(w => w.days), [weeks])
  const loggedCount = allDays.filter(d => logsByDate[d.key]).length
  const monthTotal = logs.reduce((s, l) => s + dailyLogTotal(l), 0)

  // Weeks collapse by default; the flat row list is what actually renders, so
  // "is this the last node on the spine" stays a single index check.
  //
  // `key` is prefixed by kind — a week's own key is its Sunday start date,
  // which is IDENTICAL to its first day's date whenever that week starts
  // inside the month (i.e. every week except the leading partial one). Two
  // sibling rows sharing a React key ("week" and "day", both "2026-08-16")
  // corrupts reconciliation the moment that week is opened/closed, which is
  // what caused rows to visibly duplicate/glitch on toggle.
  const rows = useMemo(() => {
    const out = []
    for (const w of weeks) {
      out.push({ kind: 'week', key: `week-${w.key}`, week: w })
      if (openWeeks[w.key]) for (const d of w.days) out.push({ kind: 'day', key: `day-${d.key}`, day: d })
    }
    return out
  }, [weeks, openWeeks])

  function weekStats(w) {
    let logged = 0, total = 0
    for (const d of w.days) {
      const log = logsByDate[d.key]
      if (log) { logged++; total += dailyLogTotal(log) }
    }
    return { logged, total }
  }

  function handleDaySaved(saved) {
    setLogs(prev => [...prev.filter(l => l.date !== saved.date), saved]
      .sort((a, b) => a.date.localeCompare(b.date)))
    setEditingDate(null)
  }

  function handleDayDeleted(date) {
    setLogs(prev => prev.filter(l => l.date !== date))
    setEditingDate(null)
  }

  // The day modal can save a typed row as a day type's default in the
  // moment — keep this page's own day type list in sync so the deep-dive
  // section 2 card and any later-opened day modal both see it immediately.
  function handleDayTypeUpdated(updated) {
    setDayTypes(prev => prev.map(d => (d.id === updated.id ? updated : d)))
  }

  /* ── Send to Daily Spend — the bridge to the real budget ──
     Sending writes one real daily_logs row (same shape as "Log Today"), so
     it counts toward the actual Daily Spend total and the main ring. A day
     already sent is linked via sent_log_id — sending again updates that
     same real row instead of creating a second one. */

  async function sendOneDay(log) {
    const dt = dayTypes.find(d => d.id === log.day_type_id)
    const items = (log.deepdive_daily_log_items ?? []).map(it => ({ label: it.name, amount: Number(it.amount) }))
    const total = dailyLogTotal(log)
    const note = `Sent from deep-dive${dt ? ` · ${dt.name}` : ''}`
    const { data: realLog, error: err } = await sendDayToRealLog(user.id, log.date, items, total, note, log.sent_log_id)
    if (isMissingSchema(err)) { setMissingSchema(true); return { error: err } }
    if (err) return { error: err }
    const { error: err2 } = await markLogSent(log.id, realLog.id)
    if (err2) return { error: err2 }
    // Patch sent_log_id onto the full log we already have, rather than
    // trusting markLogSent's response — that update only returns the base
    // deepdive_daily_log columns, not the nested items, and replacing the
    // whole log with that would make the day look emptied out the instant
    // it's sent (a real bug this caused: items still safe in the database,
    // but the page showed "Nothing spent" right after every send).
    return { data: { ...log, sent_log_id: realLog.id } }
  }

  async function handleSendDay(log) {
    setSendingKey(log.date)
    const { data, error: err } = await sendOneDay(log)
    setSendingKey(null)
    if (err) { setError(err.message); return }
    setLogs(prev => prev.map(l => (l.id === data.id ? data : l)))
  }

  // Removes the real entry a day was sent to and clears the link, so it
  // goes back to "not sent" — the deep-dive's own items are untouched, so
  // you can fix them and send again cleanly, with no orphaned real entry
  // left behind to double-count later.
  async function handleUndoSend(log) {
    setUndoingKey(log.date)
    const { error: err } = await undoSend(log.id, log.sent_log_id)
    setUndoingKey(null)
    if (err) { setError(err.message); return }
    setLogs(prev => prev.map(l => (l.id === log.id ? { ...l, sent_log_id: null } : l)))
  }

  // Only the not-yet-sent days in this week are touched — an already-sent
  // day is left exactly as it is, never re-sent as a side effect of a bulk
  // week action.
  async function handleSendWeek(week) {
    const unsent = week.days.map(d => logsByDate[d.key]).filter(l => l && !l.sent_log_id)
    if (unsent.length === 0) { setSendWeekConfirm(null); return }
    setSendingWeekKey(week.key)
    const results = await Promise.all(unsent.map(sendOneDay))
    setSendingWeekKey(null)
    setSendWeekConfirm(null)
    const errored = results.find(r => r.error)
    if (errored) setError(errored.error.message)
    const updatedById = new Map(results.filter(r => r.data).map(r => [r.data.id, r.data]))
    setLogs(prev => prev.map(l => updatedById.get(l.id) ?? l))
  }

  /* ── Day types ── */

  const canAddDayType = !!dayTypeName.trim() && !savingDayType

  async function handleAddDayType(e) {
    e?.preventDefault()
    if (!canAddDayType) return
    setSavingDayType(true); setError('')
    const cost = parseFloat(dayTypeCostInput) || 0
    const { data, error: err } = await createDayType(user.id, dayTypeName.trim(), cost)
    setSavingDayType(false)
    // A reload alone can't surface a missing cost_per_day: listDayTypes uses
    // select('*'), so the gap only shows up on the first write.
    if (isMissingSchema(err)) { setMissingSchema(true); return }
    if (err) { setError(err.message); return }
    setDayTypes(prev => [...prev, data])
    setCostMap(prev => ({ ...prev, [data.id]: String(data.cost_per_day ?? 0) }))
    setDayTypeName(''); setDayTypeCostInput('')
  }

  function openRename(dt) {
    setRenamingId(dt.id)
    setRenameValue(dt.name)
  }

  async function saveRename() {
    if (!renameValue.trim()) return
    const { data, error: err } = await updateDayType(renamingId, { name: renameValue.trim() })
    if (err) { setError(err.message); return }
    setDayTypes(prev => prev.map(dt => dt.id === data.id ? data : dt))
    setRenamingId(null)
  }

  async function handleCostBlur(dayTypeId) {
    const cost = parseFloat(costMap[dayTypeId]) || 0
    const { data, error: err } = await updateDayType(dayTypeId, { cost_per_day: cost })
    if (isMissingSchema(err)) { setMissingSchema(true); return }
    if (err) { setError(err.message); return }
    setDayTypes(prev => prev.map(dt => dt.id === data.id ? data : dt))
    setCostMap(prev => ({ ...prev, [dayTypeId]: String(cost) }))
  }

  // Logged days survive this (day_type_id is set null in the DB); their pill
  // just stops resolving, which the spine already renders as "no type".
  function handleDeleteDayType(id) {
    const item = dayTypes.find(dt => dt.id === id)
    if (!item) return
    const prevDayTypes = dayTypes
    const prevAlloc = allocMap
    deleteWithUndo({
      message: `Deleted "${item.name}"`,
      remove: () => {
        setDayTypes(prev => prev.filter(dt => dt.id !== id))
        setAllocMap(prev => { const next = { ...prev }; delete next[id]; return next })
      },
      commit: async () => {
        const { error: err } = await deleteDayType(id)
        if (err) { setError(err.message); setDayTypes(prevDayTypes); setAllocMap(prevAlloc) }
      },
      restore: () => { setDayTypes(prevDayTypes); setAllocMap(prevAlloc) },
    })
  }

  /* ── Default items (a day type's reusable "usually cost this" list) ── */

  async function addDefaultItem(dt) {
    const draft = newDefaultItem[dt.id]
    const name = draft?.name?.trim()
    const amount = parseFloat(draft?.amount)
    if (!name || !(amount > 0)) return
    const items = [...defaultItemsOf(dt), { name, amount }]
    const { data, error: err } = await updateDayType(dt.id, { default_items: items })
    if (isMissingSchema(err)) { setMissingSchema(true); return }
    if (err) { setError(err.message); return }
    setDayTypes(prev => prev.map(d => (d.id === data.id ? data : d)))
    setNewDefaultItem(prev => ({ ...prev, [dt.id]: { name: '', amount: '' } }))
  }

  async function removeDefaultItem(dt, index) {
    const items = defaultItemsOf(dt).filter((_, i) => i !== index)
    const { data, error: err } = await updateDayType(dt.id, { default_items: items })
    if (err) { setError(err.message); return }
    setDayTypes(prev => prev.map(d => (d.id === data.id ? data : d)))
  }

  // Only fills in days that don't have a log yet — an already-logged day
  // (including a deliberate day off) is never touched or overwritten.
  async function handleBulkApply(dt, dates) {
    setBulkApplying(true)
    const { error: err } = await bulkFillDayType(user.id, dates, dt.id, defaultItemsOf(dt))
    setBulkApplying(false)
    setBulkConfirmId(null)
    if (err) { setError(err.message); return }
    await load()
  }

  /* ── Allocation ── */

  function parsedAlloc(dayTypeId) {
    return parseAllocValue(allocMap[dayTypeId])
  }

  const totalAllocated = useMemo(
    () => dayTypes.reduce((s, dt) => s + parseAllocValue(allocMap[dt.id]), 0),
    [dayTypes, allocMap],
  )
  const daysRemaining = totalDays - totalAllocated

  const runningTotal = useMemo(
    () => dayTypes.reduce((s, dt) => s + dayTypeCost(dt) * parseAllocValue(allocMap[dt.id]), 0),
    [dayTypes, allocMap],
  )

  function handleAllocChange(dayTypeId, raw) {
    const trimmed = raw.replace(/[^\d]/g, '')
    let n = trimmed === '' ? 0 : parseInt(trimmed, 10)
    const othersSum = dayTypes.reduce((s, dt) => dt.id === dayTypeId ? s : s + parsedAlloc(dt.id), 0)
    const room = Math.max(0, totalDays - othersSum)
    clearTimeout(warnTimerRef.current)
    if (n > room) {
      setOverAllocWarning({ id: dayTypeId, room })
      warnTimerRef.current = setTimeout(() => setOverAllocWarning(null), 3500)
      setAllocMap(prev => ({ ...prev, [dayTypeId]: String(room) }))
    } else {
      setOverAllocWarning(w => (w?.id === dayTypeId ? null : w))
      setAllocMap(prev => ({ ...prev, [dayTypeId]: trimmed }))
    }
  }

  async function handleAllocBlur(dayTypeId) {
    const n = parsedAlloc(dayTypeId)
    const { error: err } = await saveAllocation(user.id, month, dayTypeId, n)
    if (err) setError(err.message)
  }

  /* ── Sync the finalised total to the Daily Spend cap ──
     A month counts as finalised the moment every day is assigned. The cap
     then tracks the projection: edit the mix afterwards and it re-syncs, so
     nothing here ever locks. Falling back below a full month leaves the last
     synced cap in place — it just stops being current. */

  const isFinalised = daysRemaining === 0 && dayTypes.length > 0
  // bucket_settings holds ONE Daily cap, not one per month, so only the month
  // you're actually in may write to it — otherwise browsing to August and
  // filling it in would silently rewrite the cap you're living by today.
  const canSyncCap = isFinalised && isCurrentMonth
  const capInSync = !!dailySetting && Number(dailySetting.mini_budget) === runningTotal

  useEffect(() => {
    if (loading || !dailySetting || !canSyncCap || capInSync || syncingRef.current) return
    syncingRef.current = true
    ;(async () => {
      const { data, error: err } = await updateBucketSetting(dailySetting.id, {
        mini_budget: runningTotal,
        cap_period: 'monthly',
      })
      syncingRef.current = false
      if (err) { setError(err.message); return }
      setDailySetting(data)
    })()
  }, [loading, dailySetting, canSyncCap, capInSync, runningTotal])

  /* ── Remaining-days color state ── */
  const nearThreshold = Math.max(3, Math.ceil(totalDays * 0.15))
  const remainingColor = daysRemaining <= 0
    ? 'var(--warn)'
    : daysRemaining <= nearThreshold
      ? 'var(--warn)'
      : 'var(--success)'
  const remainingBg = daysRemaining <= 0
    ? 'color-mix(in srgb, var(--warn) 14%, transparent)'
    : daysRemaining <= nearThreshold
      ? 'color-mix(in srgb, var(--warn) 10%, transparent)'
      : 'color-mix(in srgb, var(--success) 10%, transparent)'

  if (missingSchema) return <SetupScreen onRetry={load} />

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--n900)' }} />
      </main>
    )
  }

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up frost-page">
      <Link to={isCurrentMonth ? '/budget-settings' : `/budget-settings?month=${month}`}
        className="text-xs font-semibold inline-block mb-4" style={{ color: 'var(--n400)' }}>
        ← Budget Settings
      </Link>

      <div className="flex items-start gap-3 mb-1">
        <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${daily.color}22`, fontSize: 21 }}>{daily.icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
            Daily Spend deep-dive
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--n350)' }}>
            Log the month day by day, then plan the mix.
          </p>
        </div>
      </div>

      <p className="text-xs mt-3 mb-6 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', color: 'var(--n400)' }}>
        A standalone calculator. It won't change your Daily Spend cap on Budget Settings — yet.
      </p>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
          {error}
        </div>
      )}

      {/* ── 1. The month, day by day ── */}
      <Reveal>
        <div className="card px-5 py-6 sm:px-7 mb-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-xs font-semibold uppercase" style={sectionLabelStyle}>1 · {monthLabel(month)}</p>
            <span className="text-xs" style={{ color: 'var(--n350)' }}>{totalDays} days</span>
          </div>

          <p className="text-sm mb-7" style={{ color: 'var(--n350)' }}>
            {loggedCount > 0
              ? <>{loggedCount} of {totalDays} days logged · <span className="tabular-nums" style={{ color: 'var(--n600)' }}>{money0(monthTotal)}</span> so far</>
              : 'Nothing logged yet this month.'}
          </p>

          <div style={{ paddingLeft: TRACK }}>
            {rows.map((row, i) => {
              const isLast = i === rows.length - 1
              /* Node rows are their own relative blocks and stack flush, so a
                 segment spans from this marker's underside to the next
                 marker's top edge. Week and day nodes sit at different
                 heights, so the next row's offset has to be read, not assumed. */
              const segTop = nodeTop(row) + nodeSize(row)
              const spine = !isLast && (
                <span aria-hidden style={{
                  position: 'absolute', left: SPINE_LEFT, top: segTop, width: SPINE_W,
                  height: `calc(100% - ${segTop - nodeTop(rows[i + 1])}px)`,
                  background: 'var(--border-2)',
                }} />
              )

              if (row.kind === 'week') {
                const { logged, total } = weekStats(row.week)
                const open = !!openWeeks[row.week.key]
                const hasToday = row.week.days.some(d => d.key === today)
                const unsentInWeek = row.week.days.map(d => logsByDate[d.key]).filter(l => l && !l.sent_log_id)
                return (
                  <div key={row.key} style={{ position: 'relative', paddingBottom: open ? 18 : 10 }}>
                    {spine}
                    <span aria-hidden style={{
                      position: 'absolute', left: MARKER_LEFT - 1, top: WEEK_MARKER_TOP, width: WEEK_MARKER, height: WEEK_MARKER,
                      borderRadius: 3,
                      background: logged > 0 ? daily.color : 'var(--surface)',
                      border: logged > 0 ? 'none' : '1.5px solid var(--border-3)',
                    }} />
                    {/* flex-wrap safety net, same reasoning as the day-type
                        row below: harmless on normal phones, only engages
                        on the narrowest screens with "this week" showing. */}
                    <button type="button"
                      onClick={() => setOpenWeeks(p => ({ ...p, [row.week.key]: !p[row.week.key] }))}
                      aria-expanded={open}
                      className="w-full flex items-center flex-wrap text-left rounded-xl px-3.5 py-2.5"
                      style={{
                        columnGap: 12, rowGap: 4,
                        background: open ? 'var(--surface-2)' : 'transparent',
                        border: `1.5px solid ${open ? 'var(--border-soft)' : 'var(--border-2)'}`,
                      }}>
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap flex-shrink-0" style={{ color: 'var(--n800)' }}>
                        {row.week.label}
                      </span>
                      {hasToday && <span className="text-[11px]" style={{ color: 'var(--n300)' }}>this week</span>}
                      <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--n350)' }}>
                        {logged}/{row.week.days.length}
                      </span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: total > 0 ? 'var(--n900)' : 'var(--n300)', minWidth: 62, textAlign: 'right' }}>
                        {money0(total)}
                      </span>
                      <span aria-hidden className="text-xs flex-shrink-0"
                        style={{ color: 'var(--n400)', transition: 'transform 0.18s ease', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
                    </button>

                    {/* Only surfaced once you've expanded to see the days,
                        and only when there's something un-sent to act on. */}
                    {open && unsentInWeek.length > 0 && (
                      <button type="button" onClick={() => setSendWeekConfirm(row.week)}
                        disabled={anySendBusy}
                        className="text-xs font-semibold mt-1.5 ml-1"
                        style={{ color: daily.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: anySendBusy ? 0.5 : 1 }}>
                        Send {unsentInWeek.length} day{unsentInWeek.length === 1 ? '' : 's'} to Daily Spend →
                      </button>
                    )}
                  </div>
                )
              }

              const d = row.day
              const log = logsByDate[d.key]
              const logged = !!log
              const typeName = logged ? dayTypeLabel(log.day_type_id) : null
              const entries = log?.deepdive_daily_log_items ?? []

              return (
                /* No paddingTop here: markers are positioned from the row's
                   top edge, so top padding would slide the date text out from
                   under its own node. Spacing comes from paddingBottom. */
                <div key={row.key} style={{ position: 'relative', paddingBottom: logged ? 22 : 16 }}>
                  {spine}
                  <span aria-hidden style={{
                    position: 'absolute', left: MARKER_LEFT, top: MARKER_TOP, width: MARKER, height: MARKER, borderRadius: 2,
                    background: logged ? daily.color : 'var(--surface)',
                    border: logged ? 'none' : '1.5px solid var(--border-3)',
                  }} />

                  <div className="flex items-center gap-2 flex-wrap" style={{ minHeight: 20 }}>
                    <span className="text-sm tabular-nums"
                      style={{ color: logged ? 'var(--n800)' : 'var(--n350)', fontWeight: logged ? 600 : 400 }}>
                      {d.weekday} {d.dayNum}
                    </span>
                    {typeName && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${daily.color}1a`, color: daily.color }}>
                        {typeName}
                      </span>
                    )}
                    {d.key === today && <span className="text-[11px]" style={{ color: 'var(--n300)' }}>today</span>}
                  </div>

                  {logged ? (
                    /* card branches right off the node — square corner nearest it */
                    <div role="button" tabIndex={0}
                      onClick={() => setEditingDate(d.key)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setEditingDate(d.key))}
                      className="tile-press mt-2.5 cursor-pointer"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1.5px solid var(--border-soft)',
                        borderRadius: 16, borderTopLeftRadius: 0,
                        padding: '14px 16px',
                      }}>
                      {entries.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--n350)' }}>Nothing spent.</p>
                      ) : entries.map(it => (
                        <div key={it.id} className="flex items-baseline gap-4 py-1">
                          <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--n700)' }}>{it.name}</span>
                          <span className="text-sm tabular-nums flex-shrink-0" style={{ color: 'var(--n800)' }}>{money(it.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-baseline justify-between mt-3 pt-3"
                        style={{ borderTop: '1px solid var(--border-2)' }}>
                        <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
                          Day total
                        </span>
                        <span className="text-base font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                          {money0(dailyLogTotal(log))}
                        </span>
                      </div>

                      {/* Sends this day into the REAL daily_logs table, so it
                          counts toward actual Daily Spend / the main ring —
                          everything else on this page is planning-only. */}
                      <div className="flex items-center justify-between mt-2.5 pt-2.5"
                        style={{ borderTop: '1px solid var(--border-2)' }}>
                        {log.sent_log_id ? (
                          <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Sent ✓</span>
                        ) : <span />}
                        <div className="flex items-center gap-3">
                          {log.sent_log_id && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); handleUndoSend(log) }}
                              disabled={anySendBusy}
                              title="Removes the real entry this created and lets you re-send fresh"
                              className="text-xs font-semibold"
                              style={{ color: 'var(--err-txt)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: anySendBusy ? 0.5 : 1 }}>
                              {undoingKey === d.key ? 'Undoing…' : 'Undo'}
                            </button>
                          )}
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleSendDay(log) }}
                            disabled={anySendBusy}
                            className="text-xs font-semibold"
                            style={{
                              color: log.sent_log_id ? 'var(--n400)' : daily.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              opacity: anySendBusy ? 0.5 : 1,
                            }}>
                            {sendingKey === d.key ? 'Sending…' : log.sent_log_id ? 'Re-send' : 'Send to Daily Spend →'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingDate(d.key)}
                      className="text-xs font-semibold rounded-lg mt-2"
                      style={{ padding: '6px 12px', background: 'transparent', border: '1.5px dashed var(--border-2)', color: 'var(--n400)' }}>
                      log this day
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Reveal>

      {/* ── 2. Day types + this month's mix ── */}
      <Reveal delay={60}>
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase" style={sectionLabelStyle}>2 · The mix</p>
            <span className="text-xs" style={{ color: 'var(--n350)' }}>{totalDays} days in {monthLabel(month)}</span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--n350)' }}>
            A day type is a name and what a day of it costs.
          </p>

          <form onSubmit={handleAddDayType} className="flex items-center gap-2 mb-4">
            <input value={dayTypeName} onChange={e => setDayTypeName(e.target.value)} placeholder="e.g. Uni Day"
              className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm" style={inputStyle} />
            <div className="flex items-center rounded-xl px-3 flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', width: 108 }}>
              <span className="text-sm mr-1" style={{ color: 'var(--n300)' }}>৳</span>
              <input type="number" min="0" step="1" value={dayTypeCostInput}
                onChange={e => setDayTypeCostInput(e.target.value)} placeholder="0"
                className="w-full py-2 text-sm font-semibold tabular-nums"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
            </div>
            <button type="submit" disabled={!canAddDayType}
              className="btn-ink rounded-xl font-semibold flex-shrink-0"
              style={{ padding: '0 18px', height: 44, fontSize: 14, opacity: !canAddDayType ? 0.45 : 1 }}>
              Create
            </button>
          </form>

          <div className="flex items-center justify-between gap-3 my-4 px-4 py-3 rounded-2xl" style={{ background: remainingBg }}>
            <div>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: remainingColor, letterSpacing: '-0.02em' }}>
                {daysRemaining}
              </p>
              <p className="text-xs font-semibold" style={{ color: remainingColor }}>
                {daysRemaining === 0 ? 'days left to allocate — fully allocated' : daysRemaining < 0 ? 'over-allocated' : 'days left to allocate'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                {money0(runningTotal)}
              </p>
              <p className="text-xs font-semibold" style={{ color: 'var(--n400)' }}>projected this month</p>
            </div>
          </div>

          {/* Finalised → the projection becomes the Daily Spend cap. Fades in
              rather than swapping abruptly, and stays fully editable. */}
          <div style={{
            maxHeight: canSyncCap && capInSync ? 60 : 0,
            opacity: canSyncCap && capInSync ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease, margin 0.35s ease',
            marginBottom: canSyncCap && capInSync ? 12 : 0,
          }}>
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
              style={{ background: `${daily.color}14`, border: `1px solid ${daily.color}44` }}>
              <span aria-hidden style={{ color: daily.color, fontSize: 13 }}>✓</span>
              <p className="text-xs font-semibold" style={{ color: daily.color }}>
                Month fully allocated — {money0(runningTotal)} is now your Daily Spend cap.
              </p>
            </div>
          </div>

          {isFinalised && !isCurrentMonth && (
            <p className="text-xs mb-3 px-3.5 py-2.5 rounded-xl"
              style={{ background: 'var(--surface-2)', color: 'var(--n400)' }}>
              {monthLabel(month)} is fully allocated at {money0(runningTotal)} — kept as a plan only.
              Your Daily Spend cap tracks the month you're in.
            </p>
          )}

          {overAllocWarning && (
            <div className="mb-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
              style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
              Only {overAllocWarning.room} day{overAllocWarning.room === 1 ? '' : 's'} left to allocate.
            </div>
          )}

          {dayTypes.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--n300)' }}>No day types yet — create one above.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dayTypes.map(dt => (
                <li key={dt.id} className="px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    {renamingId === dt.id ? (
                      <>
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveRename()}
                          className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-sm" style={inputStyle} autoFocus />
                        <button onClick={saveRename} title="Save" style={editBtnStyle}>✓</button>
                        <button onClick={() => setRenamingId(null)} title="Cancel" style={editBtnStyle}>✕</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--n800)' }}>{dt.name}</span>
                        <button onClick={() => openRename(dt)} title="Rename" style={editBtnStyle}>✎</button>
                        <button onClick={() => handleDeleteDayType(dt.id)} className="btn-delete" title="Delete">×</button>
                      </>
                    )}
                  </div>

                  {/* flex-wrap + the subtotal's auto margin: on phones wide
                      enough (~375px+) everything sits on one line same as
                      before; on genuinely narrow screens the subtotal drops
                      to its own right-aligned line instead of overflowing
                      the card. Verified at 0px overflow from 320–430px. */}
                  <div className="flex items-center flex-wrap" style={{ columnGap: 6, rowGap: 8 }}>
                    <div className="flex items-center rounded-lg px-2 flex-shrink-0" style={{ width: 92, ...inputStyle, borderRadius: 10 }}>
                      <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
                      <input type="number" min="0" step="1" value={costMap[dt.id] ?? ''}
                        onChange={e => setCostMap(prev => ({ ...prev, [dt.id]: e.target.value }))}
                        onBlur={() => handleCostBlur(dt.id)} placeholder="0"
                        className="w-full text-sm font-semibold tabular-nums text-right py-1.5"
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--n300)' }}>/day ×</span>
                    <input type="text" inputMode="numeric" value={allocMap[dt.id] ?? ''} placeholder="0"
                      onChange={e => handleAllocChange(dt.id, e.target.value)}
                      onBlur={() => handleAllocBlur(dt.id)}
                      className="text-base font-bold tabular-nums text-center flex-shrink-0"
                      style={{ width: 48, background: 'var(--surface)', border: '1.5px solid var(--border-2)', borderRadius: 10, color: 'var(--n900)', padding: '6px 0' }} />
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--n300)' }}>days</span>
                    <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)', marginLeft: 'auto' }}>
                      {money0(dayTypeCost(dt) * parseAllocValue(allocMap[dt.id]))}
                    </span>
                  </div>

                  {/* Default items: a reusable "usually cost this" list for
                      this day type, so repeated items (e.g. Uni Day's bus
                      fares) don't have to be retyped for every single day. */}
                  <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border-2)' }}>
                    <button type="button"
                      onClick={() => setOpenDefaults(p => ({ ...p, [dt.id]: !p[dt.id] }))}
                      className="flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: 'var(--n400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <span aria-hidden style={{ transition: 'transform 0.15s ease', transform: openDefaults[dt.id] ? 'rotate(90deg)' : 'none' }}>›</span>
                      Default items{defaultItemsOf(dt).length > 0 ? ` (${defaultItemsOf(dt).length})` : ''}
                    </button>

                    {openDefaults[dt.id] && (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {defaultItemsOf(dt).map((it, i) => (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
                            <span className="flex-1 min-w-0 text-xs truncate" style={{ color: 'var(--n700)' }}>{it.name}</span>
                            <span className="text-xs font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n800)' }}>{money0(it.amount)}</span>
                            <button onClick={() => removeDefaultItem(dt, i)} className="btn-delete flex-shrink-0"
                              title="Remove" style={{ width: 20, height: 20, fontSize: 11 }}>×</button>
                          </div>
                        ))}

                        <div className="flex items-center gap-1.5">
                          <input value={newDefaultItem[dt.id]?.name ?? ''}
                            onChange={e => setNewDefaultItem(p => ({ ...p, [dt.id]: { ...p[dt.id], name: e.target.value } }))}
                            placeholder="Item name…" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs" style={inputStyle} />
                          <div className="flex items-center rounded-lg px-2 flex-shrink-0" style={{ width: 76, ...inputStyle }}>
                            <span className="text-xs mr-0.5" style={{ color: 'var(--n350)' }}>৳</span>
                            <input type="number" min="0" step="1" value={newDefaultItem[dt.id]?.amount ?? ''}
                              onChange={e => setNewDefaultItem(p => ({ ...p, [dt.id]: { ...p[dt.id], amount: e.target.value } }))}
                              placeholder="0" className="w-full text-xs font-semibold tabular-nums py-1"
                              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
                          </div>
                          <button type="button" onClick={() => addDefaultItem(dt)}
                            disabled={!newDefaultItem[dt.id]?.name?.trim() || !(parseFloat(newDefaultItem[dt.id]?.amount) > 0)}
                            className="btn-soft text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0">
                            + Add
                          </button>
                        </div>

                        {defaultItemsOf(dt).length > 0 && (
                          <button type="button" onClick={() => setBulkConfirmId(dt.id)}
                            className="text-xs font-semibold mt-1 text-left"
                            style={{ color: daily.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            Apply to every day this month →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>

      {editingDate && (
        <DeepDiveDayModal
          userId={user.id}
          date={editingDate}
          log={logsByDate[editingDate] ?? null}
          dayTypes={dayTypes}
          accent={daily.color}
          onClose={() => setEditingDate(null)}
          onSaved={handleDaySaved}
          onDeleted={handleDayDeleted}
          onDayTypeUpdated={handleDayTypeUpdated}
        />
      )}

      {bulkConfirmId && (() => {
        const dt = dayTypes.find(d => d.id === bulkConfirmId)
        if (!dt) return null
        const missingDates = allDays.filter(d => !logsByDate[d.key])
        return (
          <div className="modal-scrim" onClick={() => !bulkApplying && setBulkConfirmId(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-lg font-extrabold mb-2" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                  Apply "{dt.name}" to {missingDates.length} day{missingDates.length === 1 ? '' : 's'}?
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--n400)' }}>
                  {missingDates.length === 0
                    ? 'Every day this month already has a log — nothing to fill in.'
                    : `Fills in ${defaultItemsOf(dt).map(it => it.name).join(', ')} on every not-yet-logged day this month. Already-logged days (including any you've marked off) are left exactly as they are — you can still edit any single day afterwards.`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setBulkConfirmId(null)} disabled={bulkApplying}
                    className="btn-soft flex-1 py-2.5 rounded-xl text-sm font-semibold">
                    Cancel
                  </button>
                  {missingDates.length > 0 && (
                    <button onClick={() => handleBulkApply(dt, missingDates.map(d => d.key))} disabled={bulkApplying}
                      className="btn-ink flex-1 py-2.5 rounded-xl text-sm font-semibold">
                      {bulkApplying ? 'Applying…' : 'Apply'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {sendWeekConfirm && (() => {
        const week = sendWeekConfirm
        const unsent = week.days.map(d => logsByDate[d.key]).filter(l => l && !l.sent_log_id)
        const sending = sendingWeekKey === week.key
        return (
          <div className="modal-scrim" onClick={() => !sending && setSendWeekConfirm(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-lg font-extrabold mb-2" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                  Send {unsent.length} day{unsent.length === 1 ? '' : 's'} ({week.label}) to Daily Spend?
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--n400)' }}>
                  Each day is written to your real Daily Spend on its own date and will count toward this month's actual spent total and main budget. Days you've already sent in this week are skipped, not re-sent.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setSendWeekConfirm(null)} disabled={sending}
                    className="btn-soft flex-1 py-2.5 rounded-xl text-sm font-semibold">
                    Cancel
                  </button>
                  <button onClick={() => handleSendWeek(week)} disabled={sending || sendingKey !== null || undoingKey !== null}
                    className="btn-ink flex-1 py-2.5 rounded-xl text-sm font-semibold">
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </main>
  )
}
