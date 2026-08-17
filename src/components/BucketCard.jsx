import { useState, useEffect } from 'react'
import { money0 } from '../lib/format'
import MiniBudgetBar, { progressColor } from './MiniBudgetBar'

/* One of the four dashboard bucket boxes. Visually self-contained (own color
   + icon), shows the mini-budget and a short preview of recent entries. The
   whole card taps through to that bucket's detail screen. */
export default function BucketCard({ view, used = 0, cap = null, entries = [], onOpen }) {
  const { name, tagline, icon, color } = view
  const hasCap = cap != null && cap > 0
  const pctRaw = hasCap ? (used / cap) * 100 : null
  const pct = hasCap ? Math.round(pctRaw) : null

  // Percentage-used popover: shown on hover (desktop) or tap (mobile) over
  // the progress bar only, so it doesn't fight the card's own tap-to-open.
  const [showPct, setShowPct] = useState(false)
  useEffect(() => {
    if (!showPct) return
    const close = () => setShowPct(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showPct])

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

      <div
        className="mb-3"
        style={{ position: 'relative' }}
        onMouseEnter={() => hasCap && setShowPct(true)}
        onMouseLeave={() => setShowPct(false)}
        onClick={e => {
          if (!hasCap) return
          e.stopPropagation()
          setShowPct(v => !v)
        }}
      >
        <MiniBudgetBar used={used} cap={cap} color={color} compact />

        {showPct && (
          <div
            className="pop-fade"
            style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              marginBottom: 10, zIndex: 30, pointerEvents: 'none',
              background: 'var(--tooltip-bg)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '10px 16px', minWidth: 96, textAlign: 'center',
              boxShadow: 'var(--shadow-tooltip)',
            }}
          >
            <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: progressColor(pctRaw, color) }}>
              {pct}%
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--n350)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 1 }}>
              of budget used
            </div>
          </div>
        )}
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
