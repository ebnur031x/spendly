import { monthKey, shiftMonth } from '../lib/dates'

const arrowStyle = {
  width: 30, height: 30, borderRadius: '50%',
  background: 'var(--surface-2)', border: '1.5px solid var(--border-2)',
  color: 'var(--n600)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 15, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
}

// Prev/next month arrows + a "Today" jump-back when not on the current
// month. Shared by Dashboard and Budget Settings so both browse the same
// way and stay in sync when you navigate between them.
export default function MonthNav({ month, onChange }) {
  const isCurrent = month === monthKey()
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))} style={arrowStyle}>‹</button>
      <button aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))} style={arrowStyle}>›</button>
      {!isCurrent && (
        <button onClick={() => onChange(monthKey())} className="btn-soft text-xs rounded-full font-semibold px-2.5 py-1">
          Today
        </button>
      )}
    </div>
  )
}
