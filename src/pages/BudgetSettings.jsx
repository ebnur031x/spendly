import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { monthKey, monthLabel } from '../lib/dates'
import { getBudget, getLatestBudgetBefore, upsertBudget } from '../lib/budgets'
import { isMissingSchema } from '../lib/schema'
import { BUCKETS, BUCKET_KEYS } from '../lib/buckets'
import Reveal from '../components/Reveal'
import MonthNav from '../components/MonthNav'
import SetupScreen from '../components/SetupScreen'

const MONTH_RE = /^\d{4}-\d{2}$/

function emptyCats() {
  const out = {}
  for (const k of BUCKET_KEYS) out[k] = ''
  return out
}

function fillCats(source) {
  const out = emptyCats()
  if (source) for (const k of BUCKET_KEYS) if (source[k] != null) out[k] = String(source[k])
  return out
}

// Dedicated screen for setting this month's overall cap plus a per-bucket
// (Daily / Groceries / Bills / Commitments) split, stored in
// budgets.category_budgets under budget_mode='per_category'. Reached from
// the Overview ring's "Edit" link — never touches budget_mode='shared' rows.
export default function BudgetSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKey()

  function goToMonth(m) {
    if (m === monthKey()) setSearchParams({})
    else setSearchParams({ month: m })
  }

  const [loading, setLoading] = useState(true)
  const [missingSchema, setMissingSchema] = useState(false)
  const [hadRow, setHadRow] = useState(false)
  const [cats, setCats] = useState(emptyCats())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [month])

  async function load() {
    setLoading(true)
    const { data: existing, error: err } = await getBudget(user.id, month)
    if (isMissingSchema(err)) { setMissingSchema(true); setLoading(false); return }

    if (existing) {
      setCats(fillCats(existing.category_budgets))
      // "Has a real budget here" now means real per-bucket numbers, since the
      // overall cap is just their sum, not an independently-set value.
      setHadRow(BUCKET_KEYS.some(k => existing.category_budgets?.[k] != null))
    } else {
      // No row for this month yet — start from the most recent prior month's
      // numbers as editable defaults.
      const { data: prev } = await getLatestBudgetBefore(user.id, month)
      if (prev) setCats(fillCats(prev.category_budgets))
      setHadRow(false)
    }
    setLoading(false)
  }

  // The overall cap is never typed directly — it's always the live sum of
  // the four bucket caps below, right up until save.
  const mainNum = BUCKET_KEYS.reduce((s, k) => s + (parseFloat(cats[k]) || 0), 0)
  const canSave = mainNum > 0 && !saving

  async function save() {
    if (!canSave) return
    setSaving(true); setError('')
    const category_budgets = {}
    for (const k of BUCKET_KEYS) {
      const v = parseFloat(cats[k])
      if (!isNaN(v) && v > 0) category_budgets[k] = v
    }
    const { error: err } = await upsertBudget(user.id, {
      main_monthly_budget: mainNum,
      budget_mode: 'per_category',
      category_budgets,
    }, month)
    setSaving(false)
    if (err) {
      if (isMissingSchema(err)) setMissingSchema(true)
      else setError(err.message)
      return
    }
    toast({ icon: '🎯', message: 'Budget saved' })
    navigate(month === monthKey() ? '/dashboard' : `/dashboard?month=${month}`)
  }

  if (missingSchema) return <SetupScreen variant="schema" onRetry={load} />

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--n900)' }} />
      </main>
    )
  }

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up">
      <Link to={month === monthKey() ? '/dashboard' : `/dashboard?month=${month}`}
        className="text-xs font-semibold inline-block mb-4" style={{ color: 'var(--n400)' }}>← Overview</Link>

      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
          {monthLabel(month)} budget
        </h1>
        <MonthNav month={month} onChange={goToMonth} />
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--n400)' }}>
        {hadRow ? 'Update your per-bucket limits below.' : 'Set your per-bucket caps below.'}
      </p>

      <Reveal>
        <div className="card p-5 mb-4">
          <label className="block text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
            Overall monthly cap
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--n350)' }}>
            Adds up automatically from the four bucket caps below.
          </p>
          <div className="flex items-center rounded-2xl px-4" aria-live="polite"
            style={{ background: 'var(--surface)', border: '1.5px dashed var(--border-3)' }}>
            <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
            <span className="w-full py-3 text-3xl font-extrabold tabular-nums select-none"
              style={{ color: 'var(--n500)', letterSpacing: '-0.02em' }}>
              {mainNum.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="card p-5 mb-4">
          <p className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
            Per-bucket caps
          </p>
          <div className="flex flex-col gap-3">
            {BUCKETS.map(b => (
              <div key={b.key} className="flex items-center gap-3">
                {b.key === 'daily' ? (
                  <Link to={month === monthKey() ? '/budget-settings/daily-deep-dive' : `/budget-settings/daily-deep-dive?month=${month}`}
                    className="flex items-center gap-3 flex-1 min-w-0 row-hover rounded-xl -mx-1 px-1 py-1"
                    style={{ textDecoration: 'none' }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${b.color}22`, fontSize: 16 }}>{b.icon}</span>
                    <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--n700)' }}>{b.name}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--n300)' }}>Deep dive ›</span>
                  </Link>
                ) : (
                  <>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${b.color}22`, fontSize: 16 }}>{b.icon}</span>
                    <span className="text-sm font-medium flex-1" style={{ color: 'var(--n700)' }}>{b.name}</span>
                  </>
                )}
                <div className="flex items-center rounded-xl px-3" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', width: 140 }}>
                  <span className="text-sm mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                  <input
                    type="number" min="0" step="50" value={cats[b.key]}
                    onChange={e => setCats(prev => ({ ...prev, [b.key]: e.target.value }))}
                    placeholder="0"
                    className="w-full py-2 text-sm font-semibold tabular-nums text-right"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
          {error}
        </div>
      )}

      <button onClick={save} disabled={!canSave} className="btn-ink w-full py-3 rounded-xl text-sm font-bold">
        {saving ? 'Saving…' : 'Save budget'}
      </button>
    </main>
  )
}
