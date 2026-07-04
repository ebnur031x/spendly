import { useState } from 'react'
import { SETUP_SQL } from '../lib/schema'
import { monthName } from '../lib/dates'
import { upsertBudget } from '../lib/budgets'
import Logo from './Logo'

// Full-screen setup shown before the dashboard when either the redesign
// tables aren't created yet (variant="schema") or the current month has no
// budget yet (variant="budget").
export default function SetupScreen({ variant, month, userId, onRetry, onDone }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <Logo size={40} word wordSize={20} />
        </div>
        {variant === 'schema'
          ? <SchemaSetup onRetry={onRetry} />
          : <BudgetSetup month={month} userId={userId} onDone={onDone} />}
      </div>
    </main>
  )
}

function SchemaSetup({ onRetry }) {
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
    <div className="card p-6 sm:p-8 fade-up">
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>Finish setup</h1>
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
  )
}

function BudgetSetup({ month, userId, onDone }) {
  const name = monthName(month)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('shared')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = parseFloat(amount) > 0

  async function save() {
    if (!canSave || saving) return
    setSaving(true); setError('')
    const { data, error } = await upsertBudget(userId, {
      main_monthly_budget: parseFloat(amount),
      budget_mode: mode,
    }, month)
    setSaving(false)
    if (error) { setError(error.message); return }
    onDone?.(data)
  }

  return (
    <div className="card p-6 sm:p-8 fade-up">
      <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
        Welcome to <span className="serif-accent">Spendly</span>
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--n500)' }}>Let's set your budget for {name}.</p>

      <label className="block text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
        What's your budget for {name}?
      </label>
      <div className="flex items-center rounded-2xl px-4 mb-6" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
        <span className="text-3xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
        <input
          type="number" min="0" step="100" autoFocus value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="0"
          className="w-full py-4 text-4xl font-extrabold tabular-nums"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)', letterSpacing: '-0.02em' }}
        />
      </div>

      <label className="block text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
        How do you want to track it?
      </label>
      <div className="grid grid-cols-1 gap-2.5 mb-6">
        <ModeTile
          on={mode === 'shared'} onClick={() => setMode('shared')}
          icon="🎯" title="One shared budget"
          desc="Everything comes out of a single monthly pool."
        />
        <ModeTile
          on={mode === 'per_category'} onClick={() => setMode('per_category')}
          icon="🗂️" title="Track categories separately"
          desc="Give day types their own sub-budgets to watch."
        />
      </div>

      {error && <p className="text-xs mb-3" style={{ color: 'var(--err-txt)' }}>{error}</p>}

      <button onClick={save} disabled={!canSave || saving} className="btn-ink w-full py-3 rounded-xl text-sm font-bold">
        {saving ? 'Saving…' : 'Start tracking →'}
      </button>
    </div>
  )
}

function ModeTile({ on, onClick, icon, title, desc }) {
  return (
    <button onClick={onClick} className="tile-press flex items-start gap-3 p-4 rounded-2xl text-left"
      style={{
        background: on ? 'var(--surface-2)' : 'var(--surface)',
        border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border-2)'),
      }}>
      <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)', fontSize: 18 }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--n900)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--n400)' }}>{desc}</p>
      </div>
      <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ border: '2px solid ' + (on ? 'var(--ink)' : 'var(--border-3)'), background: on ? 'var(--ink)' : 'transparent' }}>
        {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--on-ink)' }} />}
      </span>
    </button>
  )
}
