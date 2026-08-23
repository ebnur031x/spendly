// Shared decorations + success overlay for the Login / Signup pages.

function floatStyle(rotate, duration, delay) {
  return { '--card-rotate': rotate, '--card-duration': duration, '--card-delay': delay }
}

function Chip({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 999,
      padding: '9px 16px',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--n900)',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-float)',
      border: '1px solid var(--border-soft)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      ...style,
    }}>
      {children}
    </div>
  )
}

// Soft floating chips arranged around the card. Purely decorative.
export function AuthDecor() {
  return (
    <div className="hidden lg:block" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* ambient color wash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 45% 40% at 18% 22%, rgba(124,58,237,0.06) 0%, transparent 70%)',
      }} />

      <div className="float-card" style={{ position: 'absolute', top: '16%', left: '14%', ...floatStyle('-3deg', '4.6s', '0s') }}>
        <Chip style={{ background: '#22c55e', color: '#fff', border: 'none', boxShadow: '0 8px 28px rgba(34,197,94,0.35)' }}>
          Saved ৳3,200 ↑
        </Chip>
      </div>

      <div className="float-card" style={{ position: 'absolute', top: '30%', right: '12%', ...floatStyle('2.5deg', '5.2s', '-1.4s') }}>
        <Chip>Food · ৳4,755</Chip>
      </div>

      <div className="float-card" style={{ position: 'absolute', bottom: '20%', left: '11%', ...floatStyle('2deg', '4.9s', '-2.2s') }}>
        <Chip>
          <span style={{
            width: 18, height: 18, borderRadius: '50%', background: '#22c55e',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff', fontWeight: 700,
          }}>✓</span>
          Under budget!
        </Chip>
      </div>

      <div className="float-card" style={{ position: 'absolute', bottom: '24%', right: '14%', ...floatStyle('-2deg', '4.3s', '-0.8s') }}>
        <Chip>Transport · ৳228</Chip>
      </div>
    </div>
  )
}

// Styled "keep me signed in" checkbox shared by Login + Signup.
export function RememberMe({ checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: checked ? '1.5px solid var(--ink)' : '1.5px solid var(--border-3)',
          background: checked ? 'var(--ink)' : 'var(--surface)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--n500)', fontWeight: 500 }}>Keep me signed in for 30 days</span>
    </label>
  )
}

// Full-screen success burst shown right before navigating to the dashboard.
export function SuccessOverlay({ title, subtitle }) {
  return (
    <div
      className="overlay-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="pop-in" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 26px' }}>
          <div className="ring-pulse" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e' }} />
          <div
            className="check-pop"
            style={{
              position: 'relative', width: 88, height: 88, borderRadius: '50%',
              background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 16px 44px rgba(34,197,94,0.42)',
            }}
          >
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--n900)', letterSpacing: '-0.03em', margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: 15, color: 'var(--n400)', margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  )
}
