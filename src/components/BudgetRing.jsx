import { useEffect, useState } from 'react'

// Large hero donut. A single arc shows how much of the budget is used, drawn
// in on mount with a pure CSS stroke-dashoffset transition (no library).
// Center content is passed as children (the remaining amount, etc.).
export default function BudgetRing({ fraction, color, size = 220, stroke = 16, children }) {
  const r = (size - stroke) / 2
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
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn ? target : c}
          className="ring-draw"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3, textAlign: 'center', padding: 12,
      }}>
        {children}
      </div>
    </div>
  )
}
