// Small rounded category pill: a coloured left dot + an uppercase label on a
// tinted background. Used for day-type tags in Transactions + the day cards so
// the whole app speaks one visual language.
//
// The three seeded day types get bespoke deep-tint backgrounds; anything else
// (custom day types, expense categories) falls back to a translucent wash of
// its own colour.
const SLUG_PILL_BG = {
  uni: '#1e1b4b',        // indigo
  normal: '#052e16',     // dark green
  occasional: '#451a03', // dark amber
}

function pillBg(slug, color) {
  return SLUG_PILL_BG[slug] || `${color}22`
}

export default function CategoryPill({ label, color = '#888888', slug, maxWidth }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        background: pillBg(slug, color),
        color,
        fontSize: '0.65rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        lineHeight: 1.35,
        flexShrink: 0,
        maxWidth,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  )
}
