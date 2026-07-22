import { useState } from 'react'
import { money, money0 } from '../lib/format'

const FALLBACK_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const fixedColor = (fc, i) => fc.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]

// SVG arc path for a donut slice from startAngle to endAngle.
// Handles the degenerate full-circle case by splitting into two halves.
function arcPath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const sweep = endAngle - startAngle
  if (Math.abs(sweep) < 0.001) return ''
  if (sweep >= 2 * Math.PI - 0.001) {
    const mid = startAngle + Math.PI
    return arcPath(cx, cy, rInner, rOuter, startAngle, mid) + ' ' +
           arcPath(cx, cy, rInner, rOuter, mid, endAngle)
  }
  const largeArc = sweep > Math.PI ? 1 : 0
  const cos = Math.cos
  const sin = Math.sin
  return [
    `M ${cx + rOuter * cos(startAngle)} ${cy + rOuter * sin(startAngle)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${cx + rOuter * cos(endAngle)} ${cy + rOuter * sin(endAngle)}`,
    `L ${cx + rInner * cos(endAngle)} ${cy + rInner * sin(endAngle)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${cx + rInner * cos(startAngle)} ${cy + rInner * sin(startAngle)}`,
    'Z',
  ].join(' ')
}

function FixedPie({ fixedCosts, total, size = 96, selected, onSelect }) {
  const [hovered, setHovered] = useState(-1)
  const stroke = 16
  const r = (size - stroke) / 2   // 40
  const rInner = r - stroke / 2   // 32
  const rOuter = r + stroke / 2   // 48
  const cx = size / 2
  const cy = size / 2

  let angle = -Math.PI / 2
  const arcs = total > 0
    ? fixedCosts.map((fc, i) => {
        const frac = (Number(fc.amount) || 0) / total
        const start = angle
        const end = angle + frac * 2 * Math.PI
        angle = end
        return { i, path: arcPath(cx, cy, rInner, rOuter, start, end), color: fixedColor(fc, i) }
      })
    : []

  return (
    <svg width={size} height={size} style={{ flexShrink: 0, overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      {arcs.map((a) => (
        <path
          key={a.i}
          d={a.path}
          fill={a.color}
          stroke="#0d1117"
          strokeWidth={2}
          onClick={() => onSelect(selected === a.i ? null : a.i)}
          onMouseEnter={() => setHovered(a.i)}
          onMouseLeave={() => setHovered(-1)}
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: (selected === a.i || hovered === a.i) ? 'scale(1.05)' : 'none',
            transition: 'transform 0.15s ease',
            cursor: 'pointer',
          }}
        />
      ))}
    </svg>
  )
}

// "Fixed This Month" — color-dotted list of fixed costs, a small proportional
// pie, and the monthly total. Clicking a pie slice shows its details inline.
export default function FixedCostsCard({ fixedCosts, total, onEdit }) {
  const hasCosts = fixedCosts.length > 0
  const [selected, setSelected] = useState(null)

  const selectedFc = selected !== null ? fixedCosts[selected] : null
  const pct = selectedFc && total > 0
    ? ((Number(selectedFc.amount) || 0) / total * 100).toFixed(1)
    : '0.0'

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h2 style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--n500)' }}>Fixed This Month</h2>
        <button onClick={onEdit} className="btn-soft text-xs px-3 py-1.5 rounded-full font-semibold">
          {hasCosts ? 'Edit' : 'Add'}
        </button>
      </div>

      {!hasCosts ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 18 }}>📌</span>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--n500)' }}>No fixed costs yet</p>
          <p className="text-xs mb-3" style={{ color: 'var(--n350)' }}>Rent, subscriptions, tuition…</p>
          <button onClick={onEdit} className="btn-ink text-xs px-4 py-2 rounded-full font-semibold">Add fixed costs</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <FixedPie fixedCosts={fixedCosts} total={total} selected={selected} onSelect={setSelected} />
            <ul className="flex-1 flex flex-col gap-2.5 min-w-0">
              {fixedCosts.map((fc, i) => (
                <li key={fc.id} className="flex items-center gap-2.5">
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: fixedColor(fc, i), flexShrink: 0 }} />
                  <span className="text-sm truncate flex-1" style={{ color: 'var(--n700)' }}>{fc.name}</span>
                  <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)' }}>
                    {money0(fc.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Dynamic info row: slice details or total */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
            {selectedFc ? (
              <div
                key={selected}
                className="fade-in"
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: fixedColor(selectedFc, selected), flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedFc.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--n500)', fontVariantNumeric: 'tabular-nums' }}>
                  · {money0(selectedFc.amount)}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--n350)' }}>
                  · {pct}%
                </span>
              </div>
            ) : (
              <div
                key="default"
                className="fade-in"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n350)', letterSpacing: '0.06em' }}>Total fixed</span>
                <span className="text-base font-extrabold tabular-nums" style={{ color: 'var(--n900)' }}>{money(total)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
