import { useState, useRef, useEffect } from 'react'
import { daysInMonth, monthKey, daysLeftInMonth } from '../lib/dates'
import { money0 } from '../lib/format'

// Theme-aware: these feed straight into SVG fill/stroke attributes, which
// resolve CSS custom properties the same way style props do.
const PLAIN_COLOR = 'var(--n400)'
const ZERO_COLOR = 'var(--border-2)'
const FALLBACK_TYPE_COLOR = '#6366f1'

// Returns an SVG path string for a rect with rounded top corners only.
function topRoundedRect(x, y, w, h, rx) {
  const r = Math.min(rx, h / 2, w / 2)
  if (h <= 0) return ''
  if (r < 0.5) return `M ${x},${y} L ${x+w},${y} L ${x+w},${y+h} L ${x},${y+h} Z`
  return `M ${x},${y+h} L ${x},${y+r} Q ${x},${y} ${x+r},${y} L ${x+w-r},${y} Q ${x+w},${y} ${x+w},${y+r} L ${x+w},${y+h} Z`
}

export default function SpendingTrend({
  monthExpenses = [],
  dailyLogs = [],
  dayTypes = [],
  month = monthKey(),
  remaining = 0,
}) {
  const days = daysInMonth(month)
  const todayDay = month === monthKey() ? new Date().getDate() : -1
  const [clicked, setClicked] = useState(null) // { day, mobile, left?, top? }
  const cardRef = useRef(null)
  const svgRef = useRef(null)

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
  for (const log of dailyLogs) {
    const d = dayOf(log.date)
    if (!d) continue
    const amt = Number(log.total_spent) || 0
    daily[d - 1].total += amt
    daily[d - 1].byType[log.day_type_id] = (daily[d - 1].byType[log.day_type_id] || 0) + amt
  }

  const maxTotal = Math.max(1, ...daily.map(x => x.total))

  function barColor(x) {
    let bestColor = PLAIN_COLOR
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

  // Daily allowance line: remaining ÷ days left in month
  const daysLeft = month === monthKey() ? daysLeftInMonth() : 0
  const dailyAllowance = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0
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
    // hidden, and surface a warning when that's actually the case.
    const logsForDay = dailyLogs.filter(l => l.date === dateStr)
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
    ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 60 }
    : clicked
      ? { position: 'absolute', left: clicked.left, top: (clicked.top ?? 0) - 8, transform: 'translate(-50%, -100%)', zIndex: 50 }
      : {}

  return (
    <div ref={cardRef} className="card p-6" style={{ position: 'relative' }}>
      <h2 style={{
        fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--n500)', marginBottom: '1rem',
      }}>
        This Month
      </h2>

      {/* Mobile scrim */}
      {clicked?.mobile && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'var(--scrim)' }}
          onClick={() => setClicked(null)}
        />
      )}

      {/* Tooltip */}
      {clicked && tooltipData && (
        <div
          key={clicked.day}
          className="pop-fade"
          style={{
            ...tooltipStyle,
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
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
        role="img"
        aria-label="Daily spending this month"
      >
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

        {/* Bars */}
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
            <path
              key={day}
              d={topRoundedRect(bx, by, barW, h, 3)}
              fill={has ? barColor(x) : ZERO_COLOR}
              opacity={has ? (isToday || isClicked ? 1 : 0.8) : 0.6}
              stroke={isToday ? 'var(--ink)' : 'none'}
              strokeWidth={isToday ? 1.5 : 0}
              style={{ cursor: has ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
              onClick={has ? e => handleBarClick(e, day, i, by) : undefined}
            />
          )
        })}

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
    </div>
  )
}
