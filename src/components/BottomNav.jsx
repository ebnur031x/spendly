import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

// Mirrors Navbar: the browsed month has to survive a tab tap, or "All" lands
// on the real current month while the rest of the app is in another one.
const MONTH_AWARE = new Set(['/dashboard', '/transactions'])
const MONTH_RE = /^\d{4}-\d{2}$/

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : null
  const hrefFor = to => (month && MONTH_AWARE.has(to) ? `${to}?month=${month}` : to)

  function openLog() {
    navigate('/dashboard', { state: { openLog: Date.now() } })
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bar-frost bar-frost-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Tab to={hrefFor('/dashboard')} label="Home" active={pathname === '/dashboard'} Icon={HomeIcon} />
      <Tab to="/daily" label="Daily" active={pathname === '/daily'} Icon={ReceiptIcon} />

      <div className="flex-1 flex items-start justify-center" style={{ minHeight: 58 }}>
        <button
          onClick={openLog}
          aria-label="Log Today"
          className="flex items-center justify-center rounded-full tile-press"
          style={{
            width: 54, height: 54, marginTop: -16,
            background: 'var(--ink)', color: 'var(--on-ink)',
            boxShadow: 'var(--shadow-float)', border: '4px solid var(--bg)',
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1, fontWeight: 300 }}>＋</span>
        </button>
      </div>

      <Tab to={hrefFor('/transactions')} label="All" active={pathname === '/transactions'} Icon={SearchIcon} />
      <Tab to="/savings" label="Savings" active={pathname === '/savings'} Icon={PiggyIcon} />
    </nav>
  )
}

/* The reference marks the current tab with colour alone — the icons keep one
   stroke weight and the caption keeps one weight. Swapping stroke width and
   font weight on tap (what this did before) makes the row visibly reflow as
   you move between tabs. */
function Tab({ to, label, active, Icon }) {
  return (
    <Link
      to={to}
      className="flex-1 flex flex-col items-center justify-center"
      style={{
        minHeight: 58,
        gap: 3,
        color: active ? 'var(--ink)' : 'var(--n350)',
        textDecoration: 'none',
        transition: 'color 0.18s',
      }}
    >
      <Icon />
      <span className="tab-label">{label}</span>
    </Link>
  )
}

/* One stroke recipe for all four — 24px, 1.8 weight, rounded caps — the same
   spec the shared icon set uses, so the tab bar reads as part of the system
   rather than its own drawing style. */
function TabIcon({ children }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function HomeIcon() {
  return <TabIcon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></TabIcon>
}

function ReceiptIcon() {
  return (
    <TabIcon>
      <path d="M6.5 3h11v17.2l-2.3-1.4-2 1.4-2.2-1.4-2 1.4-2.5-1.4V3Z" />
      <path d="M9.3 8.6h5.4M9.3 12h5.4M9.3 15.4h3.4" />
    </TabIcon>
  )
}

function SearchIcon() {
  return <TabIcon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></TabIcon>
}

function PiggyIcon() {
  return (
    <TabIcon>
      <ellipse cx="10.5" cy="13" rx="6.5" ry="5.2" />
      <path d="M17 13c1.1 0 2-.9 2-2s-.9-2-2-2" />
      <path d="M10.5 7.8V6" />
      <path d="M7.8 17.8 6.4 20M13.2 17.8 14.6 20" />
      <path d="M8.2 12.6h.01" />
    </TabIcon>
  )
}
