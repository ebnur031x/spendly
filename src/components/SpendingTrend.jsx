import { useState, useRef, useEffect, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { daysInMonth, monthKey, daysLeftInMonth } from '../lib/dates'
import { money0 } from '../lib/format'

// Theme-aware: these feed straight into SVG fill/stroke attributes, which
// resolve CSS custom properties the same way style props do.
const PLAIN_COLOR = 'var(--n400)'
const ZERO_COLOR = 'var(--border-2)'
const FALLBACK_TYPE_COLOR = '#6366f1'

// One shared spring so every moving part of the card feels like the same
// physical system — the iOS trick is consistency, not more animation.
const SPRING = { type: 'spring', stiffness: 320, damping: 30 }
const SPRING_SOFT = { type: 'spring', stiffness: 210, damping: 26 }

const CHART_TYPES = [
  {
    key: 'bar', label: 'Bar chart',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></svg>,
  },
  {
    key: 'line', label: 'Line chart',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l5.5-6 4 3.5L21 6" /></svg>,
  },
  {
    key: 'pie', label: 'Pie chart',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" /></svg>,
  },
]

// Catmull-Rom → cubic bézier, so the line view reads like iOS Health's
// gentle curve rather than a jagged polyline.
function smoothLinePath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

// Picks a font-size (px) for the pie's center money figure so it stays
// inside the donut hole regardless of how many digits the total has —
// a fixed size overflowed past the ring on bigger amounts (e.g. ৳50,000
// vs ৳670). ~0.58em average glyph width for the bold serif digits.
function fitMoneyFontSize(text, ringRadius) {
  const holeWidth = ringRadius * 1.5 // matches the center wrapper's width above
  const maxFont = ringRadius * 0.34
  const byWidth = holeWidth / (text.length * 0.58)
  return `${Math.max(11, Math.min(maxFont, byWidth))}px`
}

export default function SpendingTrend({
  categories = [],
  dailyLogs = [],
  dayTypes = [],
  month = monthKey(),
  remaining = 0,
}) {
  const days = daysInMonth(month)
  const todayDay = month === monthKey() ? new Date().getDate() : -1
  const [clicked, setClicked] = useState(null) // { day, mobile, left?, top? }
  const [selectedKey, setSelectedKey] = useState(categories[0]?.key)
  const [chartType, setChartType] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('spendly-chart-type') : null
    return CHART_TYPES.some(t => t.key === saved) ? saved : 'bar'
  })
  const cardRef = useRef(null)
  const svgRef = useRef(null)
  const clipId = useId()

  useEffect(() => {
    try { localStorage.setItem('spendly-chart-type', chartType) } catch { /* private mode */ }
  }, [chartType])

  const selected = categories.find(c => c.key === selectedKey) ?? categories[0] ?? { key: 'daily', label: 'Daily', color: FALLBACK_TYPE_COLOR, expenses: [] }
  const isDaily = selected.key === 'daily'
  const monthExpenses = selected.expenses ?? []
  const effectiveDailyLogs = isDaily ? dailyLogs : []

  const colorById = {}
  for (const dt of dayTypes) colorById[dt.id] = dt.color

  const dayOf = (dateStr) => {
    if (!dateStr) return null
    const d = Number(dateStr.slice(8, 10))
    return d >= 1 && d <= days ? d : null
  }

  const daily = Array.from({ length: days }, () => ({ total: 0, plain: 0, byType: {} }))
  for (const e of monthExpenses) {
    const d = dayOf(e.date)
    if (!d) continue
    const amt = Number(e.amount) || 0
    daily[d - 1].total += amt
    daily[d - 1].plain += amt
  }
  for (const log of effectiveDailyLogs) {
    const d = dayOf(log.date)
    if (!d) continue
    const amt = Number(log.total_spent) || 0
    daily[d - 1].total += amt
    daily[d - 1].byType[log.day_type_id] = (daily[d - 1].byType[log.day_type_id] || 0) + amt
  }

  const maxTotal = Math.max(1, ...daily.map(x => x.total))
  const categoryColor = selected.color || FALLBACK_TYPE_COLOR

  function barColor(x) {
    let bestColor = isDaily ? PLAIN_COLOR : categoryColor
    let bestAmt = x.plain
    for (const [id, amt] of Object.entries(x.byType)) {
      if (amt > bestAmt) {
        bestAmt = amt
        bestColor = colorById[id] || FALLBACK_TYPE_COLOR
      }
    }
    return bestColor
  }

  const slot = 20
  const barW = 14
  const barH = 130
  const labelH = 18
  const W = days * slot
  const H = barH + labelH

  // Whole-month totals per bucket — the pie view answers "where did the
  // month go" across buckets, which a per-day axis can't show.
  const bucketTotals = categories.map(c => {
    let total = (c.expenses ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
    if (c.key === 'daily') total += dailyLogs.reduce((s, l) => s + (Number(l.total_spent) || 0), 0)
    return { ...c, total }
  })
  const monthTotal = bucketTotals.reduce((s, b) => s + b.total, 0)

  // Daily allowance line: remaining ÷ days left in month. Only meaningful
  // against the Daily Spend bucket — the overall budget remainder has no
  // sensible per-day reading for groceries/bills/commitments.
  const daysLeft = month === monthKey() ? daysLeftInMonth() : 0
  const dailyAllowance = isDaily && daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0
  const rawLineY = dailyAllowance > 0 ? barH - (dailyAllowance / maxTotal) * barH : -1
  const lineY = rawLineY >= 2 && rawLineY <= barH - 2 ? rawLineY : null

  const labelDays = Array.from({ length: days }, (_, i) => i + 1).filter(d => d === 1 || d % 5 === 0)

  // Close tooltip on any outside click
  useEffect(() => {
    if (!clicked) return
    const handle = () => setClicked(null)
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [clicked])

  function handleBarClick(e, day, barI, svgBarTopY) {
    e.stopPropagation()
    if (clicked?.day === day) {
      setClicked(null)
      return
    }
    const isMobile = window.innerWidth < 640
    if (isMobile) {
      setClicked({ day, mobile: true })
    } else {
      const cardRect = cardRef.current.getBoundingClientRect()
      const svgRect = svgRef.current.getBoundingClientRect()
      const scale = svgRect.width / W
      const barCx = (barI * slot + slot / 2) * scale
      const rawLeft = svgRect.left - cardRect.left + barCx
      const left = Math.max(110, Math.min(rawLeft, cardRect.width - 110))
      const top = svgRect.top - cardRect.top + svgBarTopY * scale
      setClicked({ day, mobile: false, left, top })
    }
  }

  // Build tooltip data for the clicked day
  let tooltipData = null
  if (clicked) {
    const { day } = clicked
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    const [y, m] = month.split('-').map(Number)
    const dateObj = new Date(y, m - 1, day)
    const monthStr = dateObj.toLocaleString('default', { month: 'short' })
    const weekday = dateObj.toLocaleString('default', { weekday: 'long' })

    const expenses = monthExpenses.filter(e => e.date === dateStr)
    // A date can have more than one Log Today entry (nothing currently stops
    // creating a second one) — aggregate ALL of them so nothing is silently
    // hidden, and surface a warning when that's actually the case. Day logs
    // only ever belong to the Daily Spend bucket.
    const logsForDay = effectiveDailyLogs.filter(l => l.date === dateStr)
    const dt = logsForDay.length === 1 ? dayTypes.find(d => d.id === logsForDay[0].day_type_id) : null
    const dayTypeNames = logsForDay.length > 1
      ? logsForDay.map(l => dayTypes.find(d => d.id === l.day_type_id)?.name || 'Day log')
      : []
    const logItems = logsForDay.flatMap(log =>
      (log.expenses ?? []).filter(x => !/descr|note/i.test(x.label || ''))
    )
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) +
                  logsForDay.reduce((s, l) => s + (Number(l.total_spent) || 0), 0)

    tooltipData = {
      dateDisplay: `${monthStr} ${day} · ${weekday}`,
      dt, dayTypeNames, expenses, logItems, total,
      multipleLogs: logsForDay.length > 1,
      logsCount: logsForDay.length,
    }
  }

  const tooltipStyle = clicked?.mobile
    ? { position: 'fixed', top: '50%', left: '50%', zIndex: 60 }
    : clicked
      ? { position: 'absolute', left: clicked.left, top: (clicked.top ?? 0) - 8, zIndex: 50 }
      : {}

  // Points for the line view — every day, zeros included, so the curve
  // reads a full month, not disconnected islands.
  const linePts = daily.map((x, i) => ({
    x: i * slot + slot / 2,
    y: barH - (x.total / maxTotal) * (barH - 8),
  }))
  const linePath = smoothLinePath(linePts)
  const areaPath = linePath
    ? `${linePath} L ${linePts[linePts.length - 1].x},${barH} L ${linePts[0].x},${barH} Z`
    : ''

  return (
    <div ref={cardRef} className="card p-6" style={{ position: 'relative' }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: '0.75rem' }}>
        <h2 style={{
          fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--n500)',
        }}>
          This Month
        </h2>

        {/* iOS-style segmented control with a sliding thumb */}
        <div style={{
          display: 'flex', gap: 2, padding: 2, borderRadius: 10,
          background: 'var(--surface-2)', border: '1px solid var(--border-soft)',
        }}>
          {CHART_TYPES.map(t => {
            const on = t.key === chartType
            return (
              <button
                key={t.key}
                type="button"
                aria-label={t.label}
                title={t.label}
                onClick={() => { setChartType(t.key); setClicked(null) }}
                style={{
                  position: 'relative', width: 34, height: 26, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: on ? 'var(--n900)' : 'var(--n350)',
                }}
              >
                {on && (
                  <motion.span
                    layoutId="chart-type-thumb"
                    transition={SPRING}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 8,
                      background: 'var(--surface)', border: '1px solid var(--border-2)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>{t.icon}</span>
              </button>
            )
          })}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: '1rem' }}>
          {categories.map(c => {
            const on = c.key === selected.key
            return (
              <motion.button
                key={c.key}
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={SPRING}
                onClick={() => { setSelectedKey(c.key); setClicked(null) }}
                className="flex items-center gap-1 rounded-full font-semibold"
                style={{
                  padding: '4px 10px', fontSize: '0.68rem',
                  background: on ? `${c.color}22` : 'var(--surface-2)',
                  color: on ? c.color : 'var(--n400)',
                  border: '1.5px solid ' + (on ? `${c.color}66` : 'var(--border-soft)'),
                  cursor: 'pointer', transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                }}
              >
                {c.icon && <span style={{ fontSize: '0.75rem' }}>{c.icon}</span>}
                {c.label}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Mobile scrim */}
      <AnimatePresence>
        {clicked?.mobile && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'var(--scrim)' }}
            onClick={() => setClicked(null)}
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {clicked && tooltipData && (
          <motion.div
            key={clicked.day}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}
            transition={SPRING}
            style={{
              ...tooltipStyle,
              // framer-motion owns `transform` — recreate the old CSS
              // centering translate via margin-left / translate on a wrapper
              ...(clicked.mobile
                ? { marginTop: 0, translate: '-50% -50%' }
                : { translate: '-50% -100%' }),
              background: 'var(--tooltip-bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 12,
              minWidth: 200,
              maxWidth: 240,
              boxShadow: 'var(--shadow-tooltip)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--n900)', marginBottom: 6 }}>
              {tooltipData.dateDisplay}
            </div>

            {tooltipData.dt && (
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: tooltipData.dt.color + '28',
                  border: `1px solid ${tooltipData.dt.color}60`,
                  borderRadius: 99, padding: '2px 8px',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: tooltipData.dt.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tooltipData.dt.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {tooltipData.dt.name}
                  </span>
                </span>
              </div>
            )}

            {tooltipData.multipleLogs && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: 8, padding: '4px 8px',
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--warn)' }}>
                  ⚠ {tooltipData.logsCount} day logs for this date ({tooltipData.dayTypeNames.join(', ')})
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tooltipData.expenses.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--n400)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title || 'Expense'}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--n900)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {money0(e.amount)}
                  </span>
                </div>
              ))}
              {tooltipData.logItems.map((x, i) => (
                <div key={'l' + i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--n400)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--n900)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {money0(x.amount)}
                  </span>
                </div>
              ))}
              {tooltipData.expenses.length === 0 && tooltipData.logItems.length === 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--n350)' }}>No details recorded</span>
              )}
            </div>

            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--n350)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--n900)', fontVariantNumeric: 'tabular-nums' }}>{money0(tooltipData.total)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {chartType === 'pie' ? (
          <motion.div
            key="pie"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6, transition: { duration: 0.14 } }}
            transition={SPRING_SOFT}
          >
            <PieView
              bucketTotals={bucketTotals}
              monthTotal={monthTotal}
              selectedKey={selected.key}
              onSelect={k => setSelectedKey(k)}
            />
          </motion.div>
        ) : (
          <motion.div
            // Stable key across bar↔line: only the pie↔svg swap goes through
            // AnimatePresence. A compound key here (chartType + category)
            // could change twice in quick succession, which wedges
            // mode="wait" into showing nothing at all.
            key="svg-chart"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6, transition: { duration: 0.14 } }}
            transition={SPRING_SOFT}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
              role="img"
              aria-label={`Daily ${selected.label} spending this month`}
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={0} y={0} width={W} height={barH} />
                </clipPath>
                <linearGradient id={`${clipId}-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={categoryColor} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={categoryColor} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Daily allowance dashed line */}
              {lineY !== null && (
                <g>
                  <line
                    x1={0} y1={lineY} x2={W} y2={lineY}
                    stroke="var(--border-3)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <text x={W - 2} y={lineY - 3} textAnchor="end" fontSize="8" fill="var(--n350)">
                    {money0(Math.round(dailyAllowance))}/day
                  </text>
                </g>
              )}

              {chartType === 'bar' ? (
                <g key="bars" clipPath={`url(#${clipId})`}>
                  {daily.map((x, i) => {
                    const day = i + 1
                    const cx = i * slot + slot / 2
                    const has = x.total > 0
                    const h = has ? Math.max(6, (x.total / maxTotal) * barH) : 3
                    const bx = cx - barW / 2
                    const by = barH - h
                    const isToday = day === todayDay
                    const isClicked = clicked?.day === day
                    return (
                      <motion.rect
                        key={day}
                        x={bx}
                        width={barW}
                        rx={3}
                        initial={{ y: barH, height: 0 }}
                        animate={{
                          y: by,
                          // extend 4px past the baseline so the rounded
                          // bottom corners are hidden by the clipPath
                          height: h + 4,
                          opacity: has ? (isToday || isClicked ? 1 : 0.8) : 0.6,
                        }}
                        transition={{ ...SPRING_SOFT, delay: i * 0.012 }}
                        whileHover={has ? { opacity: 1 } : undefined}
                        whileTap={has ? { scaleY: 0.94, scaleX: 1.08 } : undefined}
                        fill={has ? barColor(x) : ZERO_COLOR}
                        stroke={isToday ? 'var(--ink)' : 'none'}
                        strokeWidth={isToday ? 1.5 : 0}
                        style={{
                          cursor: has ? 'pointer' : 'default',
                          transformBox: 'fill-box', originX: 0.5, originY: 1,
                        }}
                        onClick={has ? e => handleBarClick(e, day, i, by) : undefined}
                      />
                    )
                  })}
                </g>
              ) : (
                // Keyed by category so picking a different bucket re-runs
                // the draw-in rather than snapping the path instantly.
                <g key={`line-${selected.key}`}>
                  <motion.path
                    d={areaPath}
                    fill={`url(#${clipId}-area)`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  />
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke={categoryColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                  {daily.map((x, i) => {
                    const day = i + 1
                    if (!(x.total > 0) && day !== todayDay) return null
                    const p = linePts[i]
                    const isToday = day === todayDay
                    const isClicked = clicked?.day === day
                    return (
                      <motion.circle
                        key={day}
                        cx={p.x} cy={p.y}
                        fill={x.total > 0 ? barColor(x) : 'var(--surface)'}
                        stroke={isToday ? 'var(--ink)' : 'var(--surface)'}
                        strokeWidth={isToday ? 2 : 1.5}
                        initial={{ r: 0 }}
                        animate={{ r: isClicked ? 6 : 4 }}
                        transition={{ ...SPRING, delay: 0.15 + i * 0.01 }}
                        whileHover={{ r: 6 }}
                        style={{ cursor: x.total > 0 ? 'pointer' : 'default' }}
                        onClick={x.total > 0 ? e => handleBarClick(e, day, i, p.y - 6) : undefined}
                      />
                    )
                  })}
                </g>
              )}

              {/* Day number labels */}
              {labelDays.map(d => (
                <text
                  key={d}
                  x={(d - 1) * slot + slot / 2}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--n350)"
                >
                  {d}
                </text>
              ))}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* Donut of the whole month by bucket. Tapping a slice (or a chip above)
   focuses it — the center figure crossfades to that bucket's total. */
function PieView({ bucketTotals, monthTotal, selectedKey, onSelect }) {
  const SIZE = 176
  const CX = SIZE / 2
  const R = 60
  const C = 2 * Math.PI * R
  const GAP = 2.5 // px of breathing room between slices
  // Widest the ring stroke ever gets (the focused slice) — the hole left
  // for the center label is 2 * (R - ACTIVE_STROKE / 2), so this number
  // and the label's own font-size/max-width below have to agree, or big
  // amounts push past the ring instead of sitting inside it.
  const ACTIVE_STROKE = 22
  const IDLE_STROKE = 16

  const active = bucketTotals.find(b => b.key === selectedKey)
  const slices = []
  let cum = 0
  for (const b of bucketTotals) {
    if (b.total <= 0) continue
    const frac = b.total / monthTotal
    slices.push({ ...b, frac, startFrac: cum })
    cum += frac
  }

  if (monthTotal <= 0) {
    return (
      <div style={{ padding: '38px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--n350)' }}>Nothing spent this month yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, flexWrap: 'wrap', padding: '6px 0 2px' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ display: 'block' }}>
          {slices.map((s, i) => {
            const len = Math.max(0, s.frac * C - GAP)
            const on = s.key === selectedKey
            return (
              <motion.circle
                key={s.key}
                cx={CX} cy={CX} r={R}
                fill="none"
                stroke={s.color}
                strokeLinecap={slices.length > 1 ? 'butt' : 'round'}
                transform={`rotate(${s.startFrac * 360 - 90} ${CX} ${CX})`}
                initial={{ strokeDasharray: `0 ${C}`, strokeWidth: IDLE_STROKE, opacity: 0 }}
                animate={{
                  strokeDasharray: `${len} ${C - len}`,
                  strokeWidth: on ? ACTIVE_STROKE : IDLE_STROKE,
                  opacity: on ? 1 : 0.55,
                }}
                transition={{ ...SPRING_SOFT, delay: 0.08 + i * 0.07 }}
                whileHover={{ opacity: 1 }}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(s.key)}
              />
            )
          })}
        </svg>

        {/* Center figure — crossfades when the focused bucket changes.
            Width-capped to the ring's inner hole (see ACTIVE_STROKE above)
            with a shrinking font scale, so a big total never pokes past
            the donut — it steps down instead of overflowing. */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center',
        }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedKey}
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.1 } }}
              transition={SPRING}
              style={{ width: R * 1.5, padding: '0 4px' }}
            >
              <div
                className="money-serif"
                style={{
                  color: active?.color ?? 'var(--n900)', lineHeight: 1.1,
                  fontSize: fitMoneyFontSize(money0(active?.total ?? monthTotal), R),
                  whiteSpace: 'nowrap',
                }}
              >
                {money0(active?.total ?? monthTotal)}
              </div>
              <div style={{
                fontSize: '0.52rem', fontWeight: 600, color: 'var(--n350)', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginTop: 3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {active?.label ?? 'Total'}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Share list — the "how big is each slice" readout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
        {bucketTotals.map(b => {
          const share = monthTotal > 0 ? Math.round((b.total / monthTotal) * 100) : 0
          const on = b.key === selectedKey
          return (
            <motion.button
              key={b.key}
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              onClick={() => onSelect(b.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px',
                borderRadius: 10, border: '1px solid ' + (on ? `${b.color}55` : 'transparent'),
                background: on ? `${b.color}14` : 'none',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, background: b.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: on ? 'var(--n900)' : 'var(--n500)', flex: 1 }}>{b.label}</span>
              <span className="data-mono" style={{ fontSize: '0.68rem', color: 'var(--n400)', flexShrink: 0 }}>
                {money0(b.total)} · {share}%
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
