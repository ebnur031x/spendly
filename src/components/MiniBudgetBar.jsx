import { money0 } from '../lib/format'

// Blends a bucket's identity color continuously toward amber, then
// orange-red, then a bold solid red as % used climbs — so the bar itself
// carries urgency while the icon/name keep the bucket's plain identity
// color. Interpolates between whichever two stops bracket the current %,
// so the tint shifts every few points instead of jumping at fixed breaks.
export function progressColor(pctRaw, color) {
  if (pctRaw > 100) return '#dc2626'
  const p = Math.min(100, Math.max(0, pctRaw))
  const stops = [
    { at: 0, color },
    { at: 50, color: `color-mix(in srgb, var(--warn) 40%, ${color})` },
    { at: 75, color: 'var(--warn)' },
    { at: 90, color: `color-mix(in srgb, #ea580c 50%, var(--warn))` },
    { at: 100, color: '#dc2626' },
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1]
    if (p <= b.at) {
      const ratio = (p - a.at) / (b.at - a.at) * 100
      return `color-mix(in srgb, ${b.color} ${ratio}%, ${a.color})`
    }
  }
  return stops[stops.length - 1].color
}

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
  const pctRaw = (used / cap) * 100
  const over = used > cap
  const barColor = progressColor(pctRaw, color)

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
