import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { supabase, setRememberMe } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AuthDecor, SuccessOverlay, RememberMe } from '../components/AuthExtras'
import ThemeToggle from '../components/ThemeToggle'
import Logo from '../components/Logo'

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: 'var(--surface)',
    borderRadius: 24,
    padding: '40px 36px',
    boxShadow: 'var(--shadow-pop)',
    border: '1px solid var(--border)',
  },
  logo: {
    width: 44, height: 44, borderRadius: 12, background: 'var(--ink)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--on-ink)', fontWeight: 700, fontSize: 18, flexShrink: 0,
    margin: '0 auto',
    textDecoration: 'none',
  },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--n600)', display: 'block', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid var(--border-2)', fontSize: 14,
    color: 'var(--n900)', background: 'var(--surface)', outline: 'none',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
  },
  btn: {
    width: '100%', marginTop: 4,
    padding: '13px', borderRadius: 99,
    background: 'var(--ink)', color: 'var(--on-ink)',
    fontSize: 15, fontWeight: 600,
    border: 'none', cursor: 'pointer',
    letterSpacing: '-0.01em',
    fontFamily: 'var(--font-sans)',
    transition: 'background 0.15s',
  },
  errorBox: {
    padding: '10px 14px', borderRadius: 10, fontSize: 13,
    background: 'var(--err-bg)', color: 'var(--err-txt)',
    border: '1px solid var(--err-border)',
  },
}

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [remember, setRemember] = useState(true)

  if (user && !success) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setRememberMe(remember)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard', { replace: true, state: { welcome: 'Welcome back!' } }), 1400)
    }
  }

  return (
    <div style={S.page}>
      <AuthDecor />
      <ThemeToggle style={{ position: 'absolute', top: 20, right: 20, zIndex: 2 }} />
      {success && <SuccessOverlay title="You're in!" subtitle="Taking you to your dashboard…" />}
      <div className="auth-card" style={{ ...S.card, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}><Logo size={46} /></Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--n900)', letterSpacing: '-0.03em', margin: '18px 0 6px' }}>
            Welcome <span className="serif-accent">back</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--n400)', margin: 0 }}>
            Sign in to continue to Spendly
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={S.errorBox}>{error}</div>}

          <div>
            <label style={S.label}>Email</label>
            <input
              type="email"
              className="auth-input"
              style={S.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label style={S.label}>Password</label>
            <input
              type="password"
              className="auth-input"
              style={S.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div style={{ marginTop: -2, marginBottom: 2 }}>
            <RememberMe checked={remember} onChange={setRemember} />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...S.btn, opacity: loading ? 0.55 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.background = 'var(--ink-hover)' }}
            onMouseOut={e => { if (!loading) e.currentTarget.style.background = 'var(--ink)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--n400)', margin: '24px 0 0' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
            Create one →
          </Link>
        </p>
      </div>
    </div>
  )
}
