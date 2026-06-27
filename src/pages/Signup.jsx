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
    fontFamily: 'Inter, system-ui, sans-serif',
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
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--on-ink)', fontWeight: 800, fontSize: 18,
    textDecoration: 'none',
  },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--n600)', display: 'block', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid var(--border-2)', fontSize: 14,
    color: 'var(--n900)', background: 'var(--surface)', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s',
  },
  btn: {
    width: '100%', marginTop: 4,
    padding: '13px', borderRadius: 99,
    background: 'var(--ink)', color: 'var(--on-ink)',
    fontSize: 15, fontWeight: 600,
    border: 'none', cursor: 'pointer',
    letterSpacing: '-0.01em',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'background 0.15s',
  },
  errorBox: {
    padding: '10px 14px', borderRadius: 10, fontSize: 13,
    background: 'var(--err-bg)', color: 'var(--err-txt)',
    border: '1px solid var(--err-border)',
  },
}

export default function Signup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [remember, setRemember] = useState(true)

  if (user && !success) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setRememberMe(remember)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
    } else if (data.session) {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard', { replace: true, state: { welcome: "You're all set!" } }), 1400)
    } else {
      setLoading(false)
      setConfirmedEmail(email)
    }
  }

  return (
    <div style={S.page}>
      <AuthDecor />
      <ThemeToggle style={{ position: 'absolute', top: 20, right: 20, zIndex: 2 }} />
      {success && <SuccessOverlay title="Account created!" subtitle="Setting up your dashboard…" />}
      <div className="auth-card" style={{ ...S.card, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}><Logo size={46} /></Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--n900)', letterSpacing: '-0.03em', margin: '18px 0 6px' }}>
            Create your <span className="serif-accent">account</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--n400)', margin: 0 }}>
            Free forever for BRAC students
          </p>
        </div>

        {confirmedEmail ? (
          /* ── Email confirmation sent ── */
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)',
              border: '1.5px solid rgba(34,197,94,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#22c55e',
              margin: '0 auto 20px',
            }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--n900)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Check your inbox
            </p>
            <p style={{ fontSize: 14, color: 'var(--n400)', margin: '0 0 28px', lineHeight: 1.55 }}>
              We sent a confirmation link to<br />
              <span style={{ color: 'var(--n550)', fontWeight: 500 }}>{confirmedEmail}</span>
            </p>
            <Link to="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
              Back to sign in →
            </Link>
          </div>
        ) : (
          /* ── Form ── */
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
                placeholder="At least 6 characters"
                minLength={6}
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--n250)', margin: '2px 0 0', lineHeight: 1.5 }}>
              By signing up you agree to our terms of service
            </p>
          </form>
        )}

        <div style={{ height: 1, background: 'var(--track)', margin: '24px -36px' }} />

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--n400)', margin: 0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
