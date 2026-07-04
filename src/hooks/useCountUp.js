import { useEffect, useRef, useState } from 'react'

// Eases a displayed number from its previous value up/down to `target`
// whenever `target` changes, as long as `run` is true.
export function useCountUp(target, run, duration = 900) {
  const [val, setVal] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    if (!run) { setVal(0); return }
    let raf
    const from = ref.current
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (target - from) * eased
      setVal(next)
      ref.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, duration])
  return val
}
