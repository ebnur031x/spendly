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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
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

function Tab({ to, label, active, Icon }) {
  return (
    <Link
      to={to}
      className="flex-1 flex flex-col items-center justify-center gap-1"
      style={{
        minHeight: 58,
        color: active ? 'var(--ink)' : 'var(--n350)',
        textDecoration: 'none',
        transition: 'color 0.15s, transform 0.15s',
        transform: active ? 'translateY(-1px)' : 'none',
      }}
    >
      <Icon active={active} />
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: '-0.01em' }}>{label}</span>
    </Link>
  )
}

function HomeIcon({ active }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path d="M4 11 12 4l8 7" stroke="currentColor" strokeWidth={active ? 2.3 : 1.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.8V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.8"
        stroke="currentColor" strokeWidth={active ? 2.3 : 1.9} strokeLinecap="round" strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.14 : 0} />
    </svg>
  )
}

function ReceiptIcon({ active }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 3h11v17.2l-2.3-1.4-2 1.4-2.2-1.4-2 1.4-2.5-1.4V3Z"
        stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
      <path d="M9.3 8.2h5.6M9.3 11.6h5.6M9.3 15h3.6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" />
    </svg>
  )
}

function SearchIcon({ active }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth={active ? 2.3 : 1.9}
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
      <path d="M19.5 19.5 15 15" stroke="currentColor" strokeWidth={active ? 2.3 : 1.9} strokeLinecap="round" />
    </svg>
  )
}

function PiggyIcon({ active }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <ellipse cx="10" cy="13" rx="6" ry="5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9}
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
      <path d="M16 13c1.1 0 2-.9 2-2s-.9-2-2-2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" />
      <path d="M10 8V6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" />
      <path d="M7.5 17.5 6 20M12.5 17.5 14 20" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" />
      <circle cx="8" cy="13" r="0.8" fill="currentColor" />
    </svg>
  )
}

