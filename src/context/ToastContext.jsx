import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)
let uid = 0

const TONE = {
  default: { bg: 'var(--ink)', fg: 'var(--on-ink)' },
  success: { bg: '#16a34a', fg: '#fff' },
  error: { bg: '#dc2626', fg: '#fff' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  // toast({ message, icon, actionLabel, onAction, tone, duration })
  // Fires onAction + dismisses when the action button is pressed;
  // auto-dismisses (without calling onAction) after `duration`.
  const toast = useCallback(({ message, icon, actionLabel, onAction, tone = 'default', duration = 4200 }) => {
    const id = ++uid
    setToasts(prev => [...prev.slice(-2), { id, message, icon, actionLabel, onAction, tone }])
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
    return id
  }, [dismiss])

  function runAction(t) {
    t.onAction?.()
    dismiss(t.id)
  }

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="bottom-[calc(86px+env(safe-area-inset-bottom))] md:bottom-7"
        style={{
          position: 'fixed', left: '50%', zIndex: 200,
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => {
          const c = TONE[t.tone] ?? TONE.default
          return (
            <div
              key={t.id}
              className="toast-in"
              style={{
                pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px 10px 16px', borderRadius: 999,
                background: c.bg, color: c.fg,
                boxShadow: 'var(--shadow-toast)',
                maxWidth: 'min(90vw, 420px)',
              }}
            >
              {t.icon && <span style={{ fontSize: 15, flexShrink: 0 }}>{t.icon}</span>}
              <span style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.message}
              </span>
              {t.actionLabel && (
                <button
                  onClick={() => runAction(t)}
                  style={{
                    background: 'color-mix(in srgb, currentColor 18%, transparent)',
                    border: 'none', color: 'inherit',
                    fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999,
                    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                    transition: 'transform 0.08s',
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                style={{
                  background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5,
                  cursor: 'pointer', fontSize: 12, padding: '4px 4px 4px 0', flexShrink: 0, lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext) ?? { toast: () => {}, dismiss: () => {} }
}
