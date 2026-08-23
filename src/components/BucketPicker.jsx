import { bucketMeta } from '../lib/buckets'

// The three expense-backed buckets an entry can move between. Commitments is a
// separate store (fixed_costs), so it isn't a simple bucket swap and is omitted.
const MOVE_BUCKETS = ['daily', 'groceries', 'bills']

// A row of chips to reclassify an expense into another bucket.
export default function BucketPicker({ value, onChange }) {
  return (
    <div>
      <p className="eyebrow mb-2" style={{ color: 'var(--n400)' }}>
        Bucket
      </p>
      <div className="flex flex-wrap gap-2">
        {MOVE_BUCKETS.map(k => {
          const m = bucketMeta(k)
          const on = value === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
              style={{
                background: on ? `${m.color}20` : 'var(--surface-2)',
                color: on ? m.color : 'var(--n600)',
                border: '1.5px solid ' + (on ? `${m.color}66` : 'var(--border-soft)'),
              }}
            >
              <span style={{ fontSize: 15 }}>{m.icon}</span>{m.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
