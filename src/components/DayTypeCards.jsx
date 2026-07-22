import { money0 } from '../lib/format'
import CategoryPill from './CategoryPill'

export default function DayTypeCards({ summary, dailyLogs = [], onLog }) {
  // Compute last-logged date per day type from raw logs
  const lastLoggedMap = {}
  for (const log of dailyLogs) {
    const key = log.day_type_id
    if (!lastLoggedMap[key] || log.date > lastLoggedMap[key]) {
      lastLoggedMap[key] = log.date
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {summary.map(dt => {
        const over = dt.overSub
        const barColor = over ? 'var(--danger)' : dt.pct != null && dt.pct > 85 ? 'var(--warn)' : dt.color
        const avg = dt.daysLogged > 0 ? Math.round(dt.spent / dt.daysLogged) : null
        const lastDate = lastLoggedMap[dt.id]
        const lastLabel = lastDate ? fmtLastLogged(lastDate) : null

        return (
          <button
            key={dt.id}
            onClick={() => onLog?.(dt)}
            className="card tile-press text-left p-6 flex flex-col"
            style={{ borderLeft: `3px solid ${dt.color}`, minHeight: 156 }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3 gap-2">
              <CategoryPill label={dt.name} color={dt.color} slug={dt.slug} maxWidth={140} />
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums flex-shrink-0"
                style={{ background: `${dt.color}1f`, color: dt.color }}>
                {dt.daysLogged} {dt.daysLogged === 1 ? 'day' : 'days'}
              </span>
            </div>

            {dt.daysLogged === 0 ? (
              <p className="text-xs" style={{ color: 'var(--n350)', fontStyle: 'italic', marginTop: 4 }}>
                No days logged yet
              </p>
            ) : (
              <>
                <p style={{ fontSize: '2rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                  {money0(dt.spent)}
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--n350)' }}>spent this month</p>
              </>
            )}

            {/* Avg + last logged row */}
            <div className="flex items-center gap-3 mt-auto pt-3" style={{ flexWrap: 'wrap' }}>
              {avg != null && (
                <span style={{ fontSize: '0.7rem', color: 'var(--n400)' }}>~{money0(avg)} / day</span>
              )}
              {lastLabel && (
                <span style={{ fontSize: '0.7rem', color: 'var(--n350)' }}>Last logged {lastLabel}</span>
              )}
            </div>

            {/* Sub-budget progress bar */}
            {dt.subBudget != null && dt.subBudget > 0 && (
              <div className="mt-3">
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

function fmtLastLogged(dateKey) {
  if (!dateKey) return null
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (dateKey === todayKey) return 'today'
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
