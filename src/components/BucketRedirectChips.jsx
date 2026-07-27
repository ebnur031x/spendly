import { Link } from 'react-router-dom'
import { bucketMeta } from '../lib/buckets'

const ALL_BUCKETS = ['daily', 'groceries', 'bills', 'commitments']

/* ══════════════════════════════════════════════════════════════════
   Mandatory, live "which bucket is this going to" confirmation — shown the
   instant any text is typed, identically on every composer (Daily,
   Groceries, Bills, Commitments), so there's one consistent answer
   everywhere instead of a passive warning on some pages and a richer
   picker on others.

   Tapping Daily/Groceries/Bills redirects where the CURRENT entry saves
   (via `setTarget`, from useBucketRedirect). Commitments can't be
   redirected into inline — it needs its own repeat/due-date setup — so on
   every other page it's a link there instead of a toggle.
   ══════════════════════════════════════════════════════════════════ */
export default function BucketRedirectChips({ text, target, setTarget, homeBucket }) {
  if (!text || !text.trim()) return null

  return (
    <div className="mb-4">
      <p className="text-[11px] mb-2" style={{ color: 'var(--n350)' }}>
        {target === homeBucket ? 'Logging to:' : 'Looks like it belongs here — tap to change:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_BUCKETS.map(k => {
          const m = bucketMeta(k)
          const on = target === k
          const isLinkOnly = k === 'commitments' && homeBucket !== 'commitments'
          const style = {
            background: on ? `${m.color}20` : 'var(--surface-2)',
            color: on ? m.color : 'var(--n600)',
            border: '1.5px solid ' + (on ? `${m.color}66` : 'var(--border-soft)'),
            textDecoration: 'none', cursor: 'pointer',
          }
          if (isLinkOnly) {
            return (
              <Link key={k} to="/commitments"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium" style={style}>
                <span style={{ fontSize: 15 }}>{m.icon}</span>{m.name}
                <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
              </Link>
            )
          }
          return (
            <button key={k} type="button" onClick={() => setTarget(k)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium" style={style}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>{m.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
