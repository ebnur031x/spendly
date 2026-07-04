import { money0 } from '../lib/format'

// Responsive grid of day-type cards (2-col desktop, 1-col mobile). Each card
// has a left border in its type color and shows this month's spend, days
// logged, and a usage bar when the type has a sub_budget. Tapping a card
// starts a Log Today for that type.
export default function DayTypeCards({ summary, onLog }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {summary.map(dt => {
        const over = dt.overSub
        const barColor = over ? 'var(--danger)' : dt.pct != null && dt.pct > 85 ? 'var(--warn)' : dt.color
        return (
          <button
            key={dt.id}
            onClick={() => onLog?.(dt)}
            className="card tile-press text-left p-5 flex flex-col"
            style={{ borderLeft: `3px solid ${dt.color}` }}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: dt.color, flexShrink: 0 }} />
                <span className="text-sm font-bold truncate" style={{ color: 'var(--n900)' }}>{dt.name}</span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums flex-shrink-0"
                style={{ background: `${dt.color}1f`, color: dt.color }}>
                {dt.daysLogged} {dt.daysLogged === 1 ? 'day' : 'days'}
              </span>
            </div>

            <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
              {money0(dt.spent)}
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--n350)' }}>
              {dt.daysLogged === 0 ? 'nothing logged yet' : 'spent this month'}
            </p>

            {dt.subBudget != null && dt.subBudget > 0 && (
              <div className="mt-4">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                  <div className="bar-fill h-full rounded-full" style={{ width: `${dt.pct}%`, background: barColor }} />
                </div>
                <p className="text-[11px] mt-1.5 tabular-nums" style={{ color: over ? 'var(--err-txt)' : 'var(--n350)' }}>
                  {over
                    ? `${money0(dt.spent - dt.subBudget)} over ${money0(dt.subBudget)}`
                    : `${money0(dt.subBudget - dt.spent)} left of ${money0(dt.subBudget)}`}
                </p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
