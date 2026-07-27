import { money0 } from '../lib/format'

/* A bucket's mini-budget progress. `cap` is the monthly-equivalent amount
   (callers convert a daily cap to cap × days). Purely presentational. */
export default function MiniBudgetBar({ used = 0, cap = null, color = '#22c55e', note, compact = false }) {
  if (cap == null || cap <= 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--n350)' }}>{note || 'No cap set'}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n800)' }}>{money0(used)}</span>
      </div>
    )
  }

  const pct = Math.min(100, (used / cap) * 100)
  const over = used > cap
  const barColor = over ? 'var(--danger)' : pct > 85 ? 'var(--warn)' : color

  return (
    <div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
        <div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(pct, used > 0 ? 3 : 0)}%`, background: barColor }} />
      </div>
      <div className="flex items-center justify-between mt-1.5" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>
        <span className="tabular-nums" style={{ color: 'var(--n400)' }}>
          {money0(used)} <span style={{ color: 'var(--n300)' }}>of {money0(cap)}</span>
        </span>
        <span className="tabular-nums font-semibold" style={{ color: over ? 'var(--err-txt)' : 'var(--n500)' }}>
          {over ? `${money0(used - cap)} over` : `${money0(cap - used)} left`}
        </span>
      </div>
    </div>
  )
}

// Resolve a bucket's monthly-equivalent cap from its stored mini-budget +
// cap period, plus a human label for the cap.
export function resolveCap({ miniBudget, capPeriod }, daysInMonth) {
  if (miniBudget == null || miniBudget <= 0) return { cap: null, label: 'No cap set' }
  if (capPeriod === 'daily') {
    return { cap: miniBudget * daysInMonth, label: `${money0(miniBudget)}/day cap` }
  }
  return { cap: miniBudget, label: `${money0(miniBudget)}/mo cap` }
}
