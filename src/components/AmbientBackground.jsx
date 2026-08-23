// Soft blurred color behind the app's frosted cards — the same visual
// language as the dashboard hero, generalized for every signed-in screen.
// Rendered once in App's <Protected> shell rather than per page: a page's
// <main> carries `fade-up`, whose animation leaves a `transform` behind,
// and a transformed ancestor becomes the containing block for
// `position: fixed` descendants. Mounted inside a page, this layer would
// therefore stretch to the full document height instead of the viewport —
// stranding the glow at the very top and bottom of a long page and leaving
// everything in between (the chart, the middle of a long list) flat.
//
// Pair with the `frost-page` class on a page's <main> (see index.css):
// that class auto-frosts every `.card` so it reads as glass over this.
// Colors are the app's own accent trio (see .accent-bar) plus the hero's
// gold, so it ties back to something established rather than a new palette.
export default function AmbientBackground() {
  return (
    <div className="page-ambient" aria-hidden="true">
      {/* Blobs track the content column, not the window: the app is
          max-w-2xl and centred, so viewport-edge blobs on a wide desktop
          glow either side of the content and never behind it. */}
      <div className="ambient-col">
        <div className="blob" style={{ width: 340, height: 340, background: '#7c3aed', top: '-10%', left: '-16%' }} />
        <div className="blob" style={{ width: 300, height: 300, background: '#3b82f6', top: '14%', right: '-18%' }} />
        <div className="blob" style={{ width: 300, height: 300, background: '#22c55e', bottom: '-8%', left: '4%' }} />
        <div className="blob" style={{ width: 260, height: 260, background: '#b8862e', bottom: '18%', right: '-10%' }} />
      </div>
    </div>
  )
}
