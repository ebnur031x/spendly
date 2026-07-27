import { Link } from 'react-router-dom'
import { suggestBucket } from '../lib/classify'
import { bucketMeta } from '../lib/buckets'

/* Symmetric cross-bucket sanity check for every composer (Daily, Groceries,
   Bills, Commitments): if the text being typed looks like it belongs to a
   *different* bucket than the one currently open, show an instant warning
   with a link there. One type never silently lands in another bucket's
   list — but this never blocks saving either; it's a heads-up, not a lock,
   since keyword matches can be wrong. */
export default function BucketMismatchWarning({ text, currentBucket }) {
  const suggestion = suggestBucket(text)
  if (!suggestion || suggestion === currentBucket) return null

  const target = bucketMeta(suggestion)
  return (
    <div className="flex items-center justify-between gap-2 -mt-2 mb-4 px-3 py-2.5 rounded-xl"
      style={{ background: `${target.color}1f`, border: `1px solid ${target.color}59` }}>
      <span className="text-xs" style={{ color: target.color }}>
        {target.icon} That looks like {target.name}, not here.
      </span>
      <Link to={`/${suggestion}`} className="text-xs font-bold whitespace-nowrap" style={{ color: target.color }}>
        Go to {target.name} →
      </Link>
    </div>
  )
}
