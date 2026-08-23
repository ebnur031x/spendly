import { useState } from 'react'
import { SETUP_SQL } from '../lib/schema'
import Logo from './Logo'

// Full-screen setup shown before the dashboard when the redesign tables
// aren't created yet in Supabase.
export default function SetupScreen({ onRetry }) {
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)

  async function copy() {
    try { await navigator.clipboard.writeText(SETUP_SQL); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  async function retry() {
    setChecking(true)
    await onRetry?.()
    setChecking(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <Logo size={40} word wordSize={20} />
        </div>
        <div className="card p-6 sm:p-8 fade-up">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>Finish setup</h1>
          <p className="text-sm mb-5" style={{ color: 'var(--n500)' }}>
            Spendly needs a few tables. Paste this into your <b style={{ color: 'var(--n700)' }}>Supabase → SQL editor</b> and run it once —
            it keeps your existing expenses untouched.
          </p>

          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--n400)' }}>SUPABASE_SETUP.sql</span>
              <button onClick={copy} className="btn-soft text-xs px-3 py-1 rounded-full font-semibold">{copied ? 'Copied ✓' : 'Copy'}</button>
            </div>
            <pre className="text-[11px] leading-relaxed overflow-x-auto no-scrollbar p-3 m-0"
              style={{ color: 'var(--n600)', maxHeight: 260, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
{SETUP_SQL}
            </pre>
          </div>

          <button onClick={retry} disabled={checking} className="btn-ink w-full py-3 rounded-xl text-sm font-bold">
            {checking ? 'Checking…' : "I've run it — continue"}
          </button>
        </div>
      </div>
    </main>
  )
}
