import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import Logo from '../components/Logo'

// Wraps a floating card: outer layer follows the cursor (parallax),
// inner layer keeps the idle float animation — the two transforms compose.
function FloatingCard({ pos, float, depth, mouse, children }) {
  return (
    <div
      className="parallax-layer hidden lg:block"
      style={{
        position: 'absolute', zIndex: 3, ...pos,
        transform: `translate(${-mouse.nx * depth}px, ${-mouse.ny * depth}px)`,
      }}
    >
      <div className="float-card" style={floatStyle(...float)}>
        {children}
      </div>
    </div>
  )
}

function SavingsBadge() {
  return (
    <div style={{
      background: '#22c55e',
      color: '#fff',
      borderRadius: 999,
      padding: '10px 20px',
      fontSize: 13,
      fontWeight: 700,
      boxShadow: '0 8px 32px rgba(34,197,94,0.45), 0 2px 8px rgba(34,197,94,0.2)',
      whiteSpace: 'nowrap',
      letterSpacing: '-0.01em',
    }}>
      Saved ৳3,200 this month ↑
    </div>
  )
}

function TransactionCard() {
  // Deliberately dark in both themes — reads like a phone screenshot.
  return (
    <div style={{
      background: '#1a1a1a',
      color: '#f0f0f0',
      borderRadius: 18,
      padding: '12px 16px',
      width: 218,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: '1px solid var(--border-2)',
      boxShadow: 'var(--shadow-float-strong)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'linear-gradient(135deg, #92400e, #78350f)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fcd34d', fontWeight: 800, fontSize: 12, flexShrink: 0,
      }}>Tr</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Pathao Ride</div>
        <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Transport · Jun 25</div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>৳228</div>
    </div>
  )
}

function BudgetProgress() {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 16,
      padding: '13px 18px',
      width: 198,
      boxShadow: 'var(--shadow-float)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--n900)' }}>Food</span>
        <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>78% used</span>
      </div>
      <div style={{ height: 6, background: 'var(--track)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '78%', background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: 99 }} />
      </div>
    </div>
  )
}

function DonutChart() {
  const r = 20, cx = 28, cy = 28, sw = 8
  const circ = 2 * Math.PI * r

  const segments = [
    { pct: 33, color: '#3b82f6', label: 'Rent' },
    { pct: 32, color: '#22c55e', label: 'Food' },
    { pct: 25, color: '#f59e0b', label: 'Tuition' },
  ]

  let cumPct = 0
  const arcs = segments.map(seg => {
    const startAngle = cumPct * 3.6 - 90
    cumPct += seg.pct
    return { ...seg, startAngle }
  })

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: 'var(--shadow-float)',
      border: '1px solid var(--border)',
    }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--track)" strokeWidth={sw} />
        {arcs.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeDasharray={`${(seg.pct / 100) * circ} ${circ}`}
            transform={`rotate(${seg.startAngle}, ${cx}, ${cy})`}
          />
        ))}
      </svg>
      <div style={{ fontSize: 11, lineHeight: '19px' }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--n550)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{s.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--n900)', marginLeft: 3 }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FoodChip() {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 999,
      padding: '10px 18px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: 'var(--shadow-float)',
      border: '1px solid var(--border)',
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--n900)',
      whiteSpace: 'nowrap',
    }}>
      🍛 Food · ৳4,755
    </div>
  )
}

function UnderBudgetBadge() {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 999,
      padding: '10px 18px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: 'var(--shadow-float)',
      border: '1px solid var(--border)',
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--n900)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%', background: '#22c55e',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#fff', flexShrink: 0, fontWeight: 700,
      }}>✓</span>
      Under budget! 🎉
    </div>
  )
}

function Star({ color = '#7c3aed', size = 16 }) {
  return (
    <span style={{ color, fontSize: size, lineHeight: 1, display: 'block' }}>✦</span>
  )
}

function Sparkle({ pos, color, size, depth, mouse }) {
  return (
    <div
      className="parallax-layer hidden lg:block"
      style={{
        position: 'absolute', zIndex: 2, ...pos,
        transform: `translate(${-mouse.nx * depth}px, ${-mouse.ny * depth}px)`,
      }}
    >
      <Star color={color} size={size} />
    </div>
  )
}

// CSS custom-property helpers for float-card animation (defined in index.css)
function floatStyle(rotate, duration, delay) {
  return {
    '--card-rotate': rotate,
    '--card-duration': duration,
    '--card-delay': delay,
  }
}

export default function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [fading, setFading] = useState(false)
  const [mouse, setMouse] = useState({ nx: 0, ny: 0, px: -9999, py: -9999, active: false })

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  function handleStartCTA(e) {
    e.preventDefault()
    setFading(true)
    setTimeout(() => navigate('/signup'), 340)
  }

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    setMouse({
      nx: (px / rect.width - 0.5) * 2,   // -1 .. 1
      ny: (py / rect.height - 0.5) * 2,
      px, py, active: true,
    })
  }

  function handleMouseLeave() {
    setMouse(m => ({ ...m, nx: 0, ny: 0, active: false }))
  }

  const navLink = {
    fontSize: 14, fontWeight: 500, color: 'var(--n550)', textDecoration: 'none',
    padding: '6px 14px', borderRadius: 8,
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      color: 'var(--n800)',
      fontFamily: 'Inter, system-ui, sans-serif',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.34s ease',
    }}>

      {/* ── Navbar ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64,
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: 'var(--nav-bg)',
        backdropFilter: 'blur(12px)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Logo size={34} word wordSize={16} />
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {['Features', 'Budgets', 'For students', 'Pricing'].map(item => (
            <a key={item} href="#"
              style={navLink}
              onMouseOver={e => { e.currentTarget.style.color = 'var(--n900)'; e.currentTarget.style.background = 'var(--track)' }}
              onMouseOut={e => { e.currentTarget.style.color = 'var(--n550)'; e.currentTarget.style.background = 'transparent' }}
            >{item}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <Link to="/login"
            style={{ ...navLink, padding: '8px 16px' }}
            onMouseOver={e => { e.currentTarget.style.color = 'var(--n900)'; e.currentTarget.style.background = 'var(--track)' }}
            onMouseOut={e => { e.currentTarget.style.color = 'var(--n550)'; e.currentTarget.style.background = 'transparent' }}
          >Sign in</Link>
          <Link to="/signup" style={{
            fontSize: 14, fontWeight: 600, color: 'var(--on-ink)', textDecoration: 'none',
            padding: '9px 22px', borderRadius: 99, background: 'var(--ink)',
            letterSpacing: '-0.01em', display: 'inline-block',
          }}>Get started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '80px 40px 60px',
        }}
      >
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: [
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(124,58,237,0.07) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 50% at 100% 60%, rgba(59,130,246,0.05) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 50% at 0% 70%, rgba(34,197,94,0.04) 0%, transparent 70%)',
          ].join(', '),
        }} />

        {/* Cursor-following glow */}
        <div
          className="hidden lg:block"
          style={{
            position: 'absolute', top: 0, left: 0,
            width: 460, height: 460, borderRadius: '50%',
            marginLeft: -230, marginTop: -230,
            background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, rgba(59,130,246,0.05) 40%, transparent 70%)',
            transform: `translate(${mouse.px}px, ${mouse.py}px)`,
            transition: 'transform 0.18s ease-out, opacity 0.4s ease',
            opacity: mouse.active ? 1 : 0,
            pointerEvents: 'none', zIndex: 1,
          }}
        />

        {/* ── Floating cards (parallax + idle float) ── */}
        <FloatingCard pos={{ top: '13%', left: '9%' }}  float={['-2deg', '4.2s', '0s']}    depth={14} mouse={mouse}><SavingsBadge /></FloatingCard>
        <FloatingCard pos={{ top: '48%', left: '4%' }}  float={['-1.5deg', '5s', '-1.5s']} depth={22} mouse={mouse}><TransactionCard /></FloatingCard>
        <FloatingCard pos={{ top: '72%', left: '12%' }} float={['1.5deg', '4.5s', '-2.5s']} depth={18} mouse={mouse}><BudgetProgress /></FloatingCard>
        <FloatingCard pos={{ top: '10%', right: '5%' }}  float={['2deg', '3.8s', '-0.8s']}  depth={20} mouse={mouse}><DonutChart /></FloatingCard>
        <FloatingCard pos={{ top: '53%', right: '6%' }}  float={['-1deg', '5.2s', '-1.8s']} depth={16} mouse={mouse}><FoodChip /></FloatingCard>
        <FloatingCard pos={{ top: '71%', right: '6%' }}  float={['1.2deg', '4.8s', '-3.2s']} depth={24} mouse={mouse}><UnderBudgetBadge /></FloatingCard>

        {/* Sparkle stars — react more strongly to feel closer */}
        <Sparkle pos={{ top: '19%', left: '47%' }} color="#7c3aed" size={18} depth={34} mouse={mouse} />
        <Sparkle pos={{ top: '57%', left: '60%' }} color="#f59e0b" size={13} depth={40} mouse={mouse} />
        <Sparkle pos={{ top: '38%', right: '22%' }} color="#22c55e" size={11} depth={30} mouse={mouse} />
        <Sparkle pos={{ top: '63%', left: '62%' }} color="#3b82f6" size={10} depth={44} mouse={mouse} />

        {/* ── Center content ── */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 4, maxWidth: 580 }}>
          <h1 style={{
            fontSize: 'clamp(52px, 7.5vw, 96px)',
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-0.04em',
            color: 'var(--n900)',
            margin: '0 0 22px 0',
          }}>
            Every{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "var(--font-serif)", fontWeight: 500 }}>taka,</em>
            <br />
            accounted
            <br />
            for.
          </h1>

          <p style={{
            fontSize: 17,
            color: 'var(--n500)',
            lineHeight: 1.65,
            margin: '0 0 36px 0',
            fontWeight: 400,
          }}>
            Built for BRAC students. Track spending, set budgets,<br />
            stay ahead — all in one clean dashboard.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              onClick={handleStartCTA}
              style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'var(--ink)', color: 'var(--on-ink)',
                padding: '13px 28px', borderRadius: 99,
                fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                letterSpacing: '-0.01em', fontFamily: 'inherit',
              }}
            >
              Start tracking free
            </button>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', color: 'var(--n700)',
              padding: '13px 24px', borderRadius: 99,
              fontSize: 15, fontWeight: 500,
              border: '1.5px solid var(--border-3)', cursor: 'pointer',
              letterSpacing: '-0.01em', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 11, lineHeight: 1 }}>▶</span>
              See how it works
            </button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--n300)', margin: 0, letterSpacing: '0.01em' }}>
            Free forever for students · No credit card needed
          </p>
        </div>
      </section>
    </div>
  )
}
