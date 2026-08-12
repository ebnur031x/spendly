import { money0 } from '../lib/format'
import MiniBudgetBar from './MiniBudgetBar'

/* One of the four dashboard bucket boxes. Visually self-contained (own color
   + icon), shows the mini-budget and a short preview of recent entries. The
   whole card taps through to that bucket's detail screen. */
export default function BucketCard({ view, used = 0, cap = null, entries = [], onOpen }) {
  const { name, tagline, icon, color } = view

  return (
    <button
      onClick={onOpen}
      className="card tile-press lift text-left p-5 flex flex-col w-full"
      style={{ minHeight: 168 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color}29, ${color}0d)`,
            boxShadow: `inset 0 0 0 1px ${color}40`,
            fontSize: 19,
          }}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight" style={{ color: 'var(--n900)' }}>{name}</p>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--n350)' }}>{tagline}</p>
        </div>
        <span className="text-lg flex-shrink-0" style={{ color: 'var(--n250)' }}>›</span>
      </div>

      <div className="mb-3">
        <MiniBudgetBar used={used} cap={cap} color={color} compact />
      </div>

      {/* Recent entries preview */}
      <div className="mt-auto pt-1">
        {entries.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--n300)', fontStyle: 'italic' }}>Nothing logged yet</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {entries.slice(0, 2).map((e, i) => (
              <li key={i} className="flex items-center gap-2" style={{ fontSize: '0.72rem' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span className="truncate" style={{ color: 'var(--n500)', flex: 1, minWidth: 0 }}>{e.name}</span>
                <span className="tabular-nums flex-shrink-0" style={{ color: 'var(--n600)', fontWeight: 600 }}>{money0(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </button>
  )
}
