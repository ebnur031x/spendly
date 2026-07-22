import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

const links = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/savings', label: 'Savings' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

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
              to={to}
              className="nav-link text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ color: active ? 'var(--n900)' : 'var(--n400)', background: active ? 'var(--track)' : 'transparent' }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={openLog}
          className="text-sm rounded-full flex items-center gap-1.5 px-4 py-2"
          style={{ background: '#ffffff', color: '#000000', fontWeight: 600, border: '1.5px solid rgba(0,0,0,0.1)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> Log Today
        </button>
        <button onClick={handleSignOut} className="btn-soft text-sm font-medium px-3.5 py-1.5 rounded-full">Sign out</button>
      </div>
    </nav>
  )
}
