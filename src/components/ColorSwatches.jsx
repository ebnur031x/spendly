// A row of color swatches. The selected one gets a ring.
export default function ColorSwatches({ colors, value, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {colors.map(c => {
        const on = value === c
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Pick color ${c}`}
            className="rounded-full tile-press"
            style={{
              width: 26, height: 26, background: c, flexShrink: 0,
              border: on ? '2px solid var(--n900)' : '2px solid transparent',
              boxShadow: on ? '0 0 0 2px var(--surface), 0 0 0 4px ' + c : 'none',
              cursor: 'pointer',
            }}
          />
        )
      })}
    </div>
  )
}
