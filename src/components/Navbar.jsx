import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'

const links = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/templates', label: 'Templates' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-8 h-16"
      style={{
        backgroundColor: 'var(--nav-bg)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        boxShadow: scrolled ? '0 6px 24px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 0.25s ease',
      }}
    >
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center" style={{ textDecoration: 'none' }}>
        <Logo size={32} word wordSize={16} />
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {links.map(({ to, label }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`nav-link text-sm font-medium px-3 py-1.5 rounded-lg ${active ? 'active' : ''}`}
              style={{ color: active ? 'var(--n900)' : 'var(--n400)' }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="btn-soft text-sm font-medium px-3.5 py-1.5 rounded-full"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
