import { useState, useMemo } from 'react'
import { suggestBucket } from '../lib/classify'

/* ══════════════════════════════════════════════════════════════════
   Drives the "which bucket is this going to" picker shared by every
   composer (Daily, Groceries, Bills, Commitments).

   `target` is a PURE derived value — computed fresh every render from
   `text` + `manualTarget`, never its own separately-updated state. That
   matters: an earlier version used a useEffect to sync a bucket-choice
   state after typing, and if Add/Enter fired before that effect caught up,
   the save silently used a stale bucket. Deriving synchronously makes that
   whole bug class impossible — there's nothing that can lag.
   ══════════════════════════════════════════════════════════════════ */
export function useBucketRedirect(text, homeBucket) {
  const [manualTarget, setManualTarget] = useState(null) // null = follow the live suggestion
  const suggestion = useMemo(() => suggestBucket(text), [text])
  const suggestedTarget = (suggestion === 'groceries' || suggestion === 'bills' || suggestion === 'commitments')
    ? suggestion : homeBucket
  const target = manualTarget ?? suggestedTarget

  // 'commitments' can only ever be an actual save target on the Commitments
  // page itself — it needs its own repeat/due-date setup that the other
  // composers don't have. Elsewhere it's informational only; Add still saves
  // into the current page's own bucket unless the user navigates there.
  const saveTarget = (target === 'commitments' && homeBucket !== 'commitments') ? homeBucket : target

  function setTarget(k) { setManualTarget(k) }
  function reset() { setManualTarget(null) }

  return { target, saveTarget, suggestion, setTarget, reset }
}
