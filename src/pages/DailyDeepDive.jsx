import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { money, money0 } from '../lib/format'
import { monthKey, monthLabel, daysInMonth, dayKey, monthDates, groupDatesByWeek } from '../lib/dates'
import { isMissingSchema } from '../lib/schema'
import { bucketMeta, ensureBucketSettings, updateBucketSetting, indexSettings } from '../lib/buckets'
import {
  listDayTypes, createDayType, updateDayType, deleteDayType, dayTypeCost,
  listDailyLogs, dailyLogTotal,
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
  const rows = useMemo(() => {
    const out = []
    for (const w of weeks) {
      out.push({ kind: 'week', key: w.key, week: w })
      if (openWeeks[w.key]) for (const d of w.days) out.push({ kind: 'day', key: d.key, day: d })
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
  async function handleDeleteDayType(id) {
    const prevDayTypes = dayTypes
    const prevAlloc = allocMap
    setDayTypes(dayTypes.filter(dt => dt.id !== id))
    setAllocMap(prev => { const next = { ...prev }; delete next[id]; return next })
    const { error: err } = await deleteDayType(id)
    if (err) { setError(err.message); setDayTypes(prevDayTypes); setAllocMap(prevAlloc) }
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
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up">
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
        />
      )}
    </main>
  )
}
