import { money, money0 } from '../lib/format'

// "Fixed This Month" — color-dotted list of fixed costs, a small proportional
// pie, and the monthly total. The Edit button opens FixedCostsModal.
export default function FixedCostsCard({ fixedCosts, total, onEdit }) {
  const hasCosts = fixedCosts.length > 0

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold" style={{ color: 'var(--n900)' }}>Fixed This Month</h2>
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
            <FixedPie fixedCosts={fixedCosts} total={total} />
            <ul className="flex-1 flex flex-col gap-2.5 min-w-0">
              {fixedCosts.map(fc => (
                <li key={fc.id} className="flex items-center gap-2.5">
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: fc.color, flexShrink: 0 }} />
                  <span className="text-sm truncate flex-1" style={{ color: 'var(--n700)' }}>{fc.name}</span>
                  <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)' }}>
                    {money0(fc.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n350)', letterSpacing: '0.06em' }}>Total fixed</span>
            <span className="text-base font-extrabold tabular-nums" style={{ color: 'var(--n900)' }}>{money(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// Small proportional donut — each fixed cost gets a slice in its own color.
function FixedPie({ fixedCosts, total, size = 84 }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  const arcs = total > 0
    ? fixedCosts.map(fc => {
        const frac = (Number(fc.amount) || 0) / total
        const arc = { color: fc.color, len: frac * c, offset: acc }
        acc += frac * c
        return arc
      })
    : []

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={a.color} strokeWidth={stroke}
          strokeDasharray={`${a.len} ${c - a.len}`}
          strokeDashoffset={-a.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  )
}
