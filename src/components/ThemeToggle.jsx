import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ style, className }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={className}
      style={{
        width: 36, height: 36, borderRadius: 999, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)',
        border: '1.5px solid var(--border-2)',
        color: 'var(--n500)',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s',
        ...style,
      }}
      onMouseOver={e => { e.currentTarget.style.color = 'var(--n900)'; e.currentTarget.style.borderColor = 'var(--border-3)' }}
      onMouseOut={e => { e.currentTarget.style.color = 'var(--n500)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <span key={theme} className="theme-icon-pop" style={{ display: 'inline-flex' }}>
        {dark ? (
          // sun
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          // moon
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
  )
}
