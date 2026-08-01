import { useEffect, useState } from 'react'

// Large hero donut. The full ring is drawn in white (the "remaining" track);
// a coloured arc on top shows how much of the budget is used, drawn in on
// mount with a pure CSS stroke-dashoffset transition (no library). The arc
// colour is budget-health driven (green / amber / red), passed via `color`.
// Center content is passed as children (the remaining amount, etc.).
export default function BudgetRing({ fraction, color, children }) {
  const size = 240
  const stroke = 18
  const r = 100
  const c = 2 * Math.PI * r
  const [drawn, setDrawn] = useState(false)

  // Two rAFs: paint the empty ring first, then transition to the target so
  // the stroke visibly sweeps in.
  useEffect(() => {
    let id2
    const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setDrawn(true)) })
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2) }
  }, [])

  const frac = Math.min(1, Math.max(0, fraction || 0))
  const target = c * (1 - frac) // dashoffset: c = empty, 0 = full

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 240 240" style={{ display: 'block' }}>
        <circle cx={120} cy={120} r={r} fill="none" stroke="var(--n900)" strokeWidth={stroke} />
        <circle
          cx={120} cy={120} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn ? target : c}
          className="ring-draw"
          transform="rotate(-90 120 120)"
        />
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 3,
      }}>
        {children}
      </div>
    </div>
  )
}
