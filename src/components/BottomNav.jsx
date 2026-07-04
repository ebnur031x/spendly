import { Link, useLocation, useNavigate } from 'react-router-dom'

// Fixed iOS-style tab bar — mobile only. Two tabs flank a raised center
// Log button, which is the always-visible entry point to Log Today.
export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

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
      <Tab to="/dashboard" label="Home" active={pathname === '/dashboard'} Icon={HomeIcon} />

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

      <Tab to="/expenses" label="Expenses" active={pathname === '/expenses'} Icon={ReceiptIcon} />
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
