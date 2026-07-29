import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

const links = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/daily', label: 'Daily' },
  { to: '/transactions', label: 'All' },
  { to: '/savings', label: 'Savings' },
]

// The month you're browsing has to survive a nav click, or "All" drops you
// back on the real current month while the rest of the app is in August.
// Only these two read ?month=; forwarding it elsewhere would be URL noise.
const MONTH_AWARE = new Set(['/dashboard', '/transactions'])
const MONTH_RE = /^\d{4}-\d{2}$/

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : null
  const hrefFor = to => (month && MONTH_AWARE.has(to) ? `${to}?month=${month}` : to)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  // Opening Log Today is a dashboard action — route there and signal it.
  function openLog() {
    navigate('/dashboard', { state: { openLog: Date.now() } })
  }

  return (
    <nav
      className="hidden md:flex sticky top-0 z-40 items-center justify-between px-5 sm:px-8 h-16"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      <Link to="/dashboard" className="flex items-center flex-shrink-0" style={{ textDecoration: 'none' }}>
        <Logo size={32} word wordSize={16} />
      </Link>

      <div className="flex items-center gap-1">
        {links.map(({ to, label }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={hrefFor(to)}
              className="nav-link text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ color: active ? 'var(--n900)' : 'var(--n400)', background: active ? 'var(--track)' : 'transparent' }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <ThemeToggle style={{ width: 32, height: 32 }} />
        <button
          onClick={openLog}
          className="btn-ink text-sm font-semibold rounded-full flex items-center gap-1.5 px-4 py-2"
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> Log Today
        </button>
        <button onClick={handleSignOut} className="btn-soft text-sm font-medium px-3.5 py-1.5 rounded-full">Sign out</button>
      </div>
    </nav>
  )
}
