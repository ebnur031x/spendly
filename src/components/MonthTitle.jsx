/* Month names are the masthead of a screen, so they get the display serif
   in italic with the year as a small mono superscript — the treatment from
   the Nightstand reference. They used to be either bold sans or mono caps
   ("AUGUST 2026"), both of which read as machine output rather than a
   title.

   `size` is a plain number of px: these sit at a handful of distinct
   scales (page h1, card header, step label) that don't line up with the
   Tailwind text-* ramp, and the serif needs its own optical sizing anyway. */
export default function MonthTitle({ month, size = 30, className = '', style }) {
  const [y, m] = String(month).split('-').map(Number)
  const name = new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' })
  return (
    <span className={`month-title ${className}`} style={{ fontSize: size, ...style }}>
      {name}<span className="yr">’{String(y).slice(2)}</span>
    </span>
  )
}
