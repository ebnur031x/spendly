import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCategoryMeta } from '../lib/categories'
import QuickLogModal from '../components/QuickLogModal'
import Reveal from '../components/Reveal'

/* ── small animated number hook ── */
function useCountUp(target, run, duration = 900) {
  const [val, setVal] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    if (!run) { setVal(0); return }
    let raf
    const from = ref.current
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (target - from) * eased
      setVal(next)
      ref.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, duration])
  return val
}

const money = (n) =>
  `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const money0 = (n) =>
  `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export default function Dashboard() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState([])
  const [budget, setBudget] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [editingBudget, setEditingBudget] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const [templates, setTemplates] = useState([])
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [onboard, setOnboard] = useState(false)
  const [toast, setToast] = useState(location.state?.welcome ?? '')

  useEffect(() => { loadData() }, [])

  // first-visit coachmark for Log Today
  useEffect(() => {
    let seen = true
    try { seen = !!localStorage.getItem('spendly.seenLogToday') } catch {}
    if (!seen) {
      const t = setTimeout(() => { setShowInfo(true); setOnboard(true) }, 950)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    window.history.replaceState({}, '')
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  function markSeen() { try { localStorage.setItem('spendly.seenLogToday', '1') } catch {} }
  function closeInfo() { setShowInfo(false); setOnboard(false); markSeen() }
  function toggleInfo() { setShowInfo(v => !v); setOnboard(false); markSeen() }
  function openQuickLog() { setShowQuickLog(true); closeInfo() }

  async function loadData() {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const [{ data: expData }, { data: budData }, { data: tplData }] = await Promise.all([
      supabase.from('expenses').select('*').gte('created_at', firstDay).order('created_at', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', now.toISOString().slice(0, 7)).maybeSingle(),
      supabase.from('quick_log_templates').select('*').order('created_at', { ascending: false }),
    ])
    setExpenses(expData ?? [])
    setTemplates(tplData ?? [])
    if (budData) { setBudget(budData); setBudgetInput(String(budData.monthly_budget)) }
    setLoading(false)
  }

  async function saveBudget() {
    const amount = parseFloat(budgetInput)
    if (isNaN(amount) || amount <= 0) return
    setSavingBudget(true)
    setBudgetError('')
    const month = new Date().toISOString().slice(0, 7)
    let error
    if (budget?.id) {
      ;({ error } = await supabase.from('budgets').update({ monthly_budget: amount, month }).eq('id', budget.id))
      if (!error) setBudget(prev => ({ ...prev, monthly_budget: amount }))
    } else {
      const { data, error: e } = await supabase
        .from('budgets').insert({ user_id: user.id, monthly_budget: amount, month }).select().single()
      error = e
      if (!error) { setBudget(data); setBudgetInput(String(data.monthly_budget)) }
    }
    setSavingBudget(false)
    if (error) setBudgetError(error.message)
    else setEditingBudget(false)
  }

  /* derived */
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const budgetAmount = budget ? Number(budget.monthly_budget) : 0
  const budgetLeft = budgetAmount > 0 ? budgetAmount - totalSpent : null
  const savedPct = budgetAmount > 0 ? Math.max(0, (budgetLeft / budgetAmount) * 100) : null
  const usedPct = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0

  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {})
  const categoryList = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const recentExpenses = expenses.slice(0, 5)

  const now = new Date()
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthShort = now.toLocaleString('default', { month: 'long' })
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth)
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const dailyAllowance = budgetLeft != null && daysLeft > 0 ? budgetLeft / daysLeft : null
  const topCat = categoryList[0] ? getCategoryMeta(categoryList[0][0]) : null

  const hour = now.getHours()
  const greetWord = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const status = usedPct > 100 ? 'over' : usedPct > 85 ? 'warn' : 'ok'
  const statusColor = status === 'over' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#22c55e'

  const run = !loading
  const cuSpent = useCountUp(totalSpent, run)
  const cuLeft = useCountUp(budgetLeft ?? 0, run)

  return (
    <main className="min-h-screen px-4 sm:px-8 py-10 max-w-5xl mx-auto" style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 420, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 65%)',
      }} />

      {/* Welcome toast */}
      {toast && (
        <div className="toast-in fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full"
          style={{ bottom: 28, backgroundColor: 'var(--ink)', color: 'var(--on-ink)', boxShadow: 'var(--shadow-toast)' }}>
          <span style={{ fontSize: 16 }}>👋</span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {showQuickLog && (
        <QuickLogModal templates={templates} onClose={() => setShowQuickLog(false)} onSaved={() => loadData()} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 fade-up relative" style={{ zIndex: 40 }}>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--n400)' }}>
              Good <span className="serif-accent">{greetWord}</span> 👋
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.04em' }}>
              Overview
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--n350)' }}>{monthLabel}</p>
          </div>

          {/* Log Today + info */}
          <div className="flex items-center gap-2 relative flex-shrink-0">
            <button
              onClick={toggleInfo}
              aria-label="What is Log Today?"
              className="rounded-full flex items-center justify-center font-bold"
              style={{
                width: 36, height: 36, fontSize: 14,
                background: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n400)',
              }}
            >?</button>
            <button
              onClick={openQuickLog}
              className={`btn-ink text-sm px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 ${onboard ? 'btn-pulse' : ''}`}
              style={{ letterSpacing: '-0.01em' }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚡</span>
              Log Today
            </button>

            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeInfo} />
                <div className="pop-fade absolute z-50 right-0 top-12 p-5 rounded-2xl"
                  style={{ width: 296, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-modal)' }}>
                  {onboard && (
                    <span className="inline-block text-[11px] font-bold uppercase mb-2 px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.14)', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                      New here?
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--n900)' }}>
                      What is <span className="serif-accent">Log Today</span>?
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--n500)' }}>
                    Log a whole day of spending in one tap. Pick a saved <b style={{ color: 'var(--n700)' }}>template</b> — like a typical “Uni Day” — confirm the amounts, and you're done.
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={openQuickLog} className="btn-ink text-xs px-3.5 py-2 rounded-full font-semibold">Try it now</button>
                    <Link to="/templates" className="text-xs font-semibold" style={{ color: 'var(--n500)' }} onClick={closeInfo}>
                      Manage templates →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Budget hero */}
        <Reveal className="mb-4" delay={40}>
          <div className="card p-6 sm:p-7">
            {budgetError && (
              <div className="mb-4 rounded-lg px-3 py-2 text-xs"
                style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
                {budgetError}
              </div>
            )}

            {budgetAmount > 0 && !editingBudget ? (
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                <BudgetRing pct={usedPct} color={statusColor}>
                  <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
                    {budgetLeft >= 0 ? 'Left' : 'Over'}
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums leading-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                    {money0(Math.abs(cuLeft))}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--n350)' }}>of {money0(budgetAmount)}</span>
                </BudgetRing>

                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>Spent in {monthShort}</p>
                      <p className="text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
                        {money(cuSpent)}
                      </p>
                    </div>
                    <button onClick={() => setEditingBudget(true)} className="btn-soft text-sm px-4 py-2 rounded-full font-medium">Edit</button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Pill
                      tone={status}
                      icon={status === 'over' ? '⚠️' : status === 'warn' ? '🟡' : '🎉'}
                      text={status === 'over' ? 'Over budget' : status === 'warn' ? 'Watch your spending' : `${Math.round(savedPct)}% of budget left`}
                    />
                    {dailyAllowance != null && dailyAllowance > 0 && (
                      <Pill icon="📅" text={`${money0(dailyAllowance)}/day · ${daysLeft} days left`} />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>Monthly Budget</p>
                {editingBudget ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" style={{ color: 'var(--n250)' }}>৳</span>
                      <input
                        type="number" min="1" step="1" value={budgetInput}
                        onChange={e => setBudgetInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveBudget()}
                        autoFocus
                        className="text-2xl font-bold w-44 rounded-xl px-3 py-1.5"
                        style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
                      />
                    </div>
                    <button onClick={saveBudget} disabled={savingBudget} className="btn-ink text-sm px-4 py-2 rounded-full font-medium">
                      {savingBudget ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => { setEditingBudget(false); setBudgetInput(budget ? String(budget.monthly_budget) : '') }}
                      className="btn-soft text-sm px-4 py-2 rounded-full font-medium">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
                        {money(cuSpent)}
                      </p>
                      <p className="text-sm mt-1" style={{ color: 'var(--n350)' }}>spent this month · set a budget to track progress</p>
                    </div>
                    <button onClick={() => setEditingBudget(true)} className="btn-ink text-sm px-5 py-2.5 rounded-full font-semibold">Set Budget</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Reveal>

        {/* Secondary stat chips */}
        <Reveal className="mb-4" delay={90}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatChip label="Transactions" value={loading ? null : String(expenses.length)} sub="this month" emoji="🧾" onClick={() => navigate('/expenses')} />
            <StatChip label="Daily avg" value={loading ? null : money0(dailyAvg)} sub={`over ${dayOfMonth} days`} emoji="📈" />
            <StatChip label="Top category" value={loading ? null : (topCat ? topCat.label : '—')} sub={topCat ? money0(categoryList[0][1]) : 'no data'} emoji={topCat ? topCat.emoji : '🏷️'} />
            <StatChip label="Days left" value={loading ? null : String(daysLeft)} sub={`in ${now.toLocaleString('default', { month: 'short' })}`} emoji="⏳" />
          </div>
        </Reveal>

        {/* Bottom panels */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Spending by Category — donut */}
          <Reveal delay={40}>
            <div className="card p-6 h-full">
              <h2 className="text-sm font-bold mb-5" style={{ color: 'var(--n900)' }}>
                Spending by <span className="serif-accent">Category</span>
              </h2>
              {loading ? (
                <Spinner />
              ) : categoryList.length === 0 ? (
                <Empty emoji="📊" text="No spending yet this month." />
              ) : (
                <div className="flex items-center gap-6">
                  <CategoryDonut data={categoryList} total={totalSpent} />
                  <div className="flex-1 flex flex-col gap-2.5">
                    {categoryList.map(([cat, amount]) => {
                      const meta = getCategoryMeta(cat)
                      const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0
                      return (
                        <div key={cat} className="flex items-center gap-2.5">
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                          <span className="text-sm font-medium flex-1" style={{ color: 'var(--n700)' }}>{meta.label}</span>
                          <span className="text-xs tabular-nums" style={{ color: 'var(--n350)' }}>{pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)', minWidth: 64, textAlign: 'right' }}>{money0(amount)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          {/* Recent transactions */}
          <Reveal delay={120}>
            <div className="card p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold" style={{ color: 'var(--n900)' }}>
                  Recent <span className="serif-accent">Transactions</span>
                </h2>
                <Link to="/expenses" className="link-ink text-xs">View all →</Link>
              </div>
              {loading ? (
                <Spinner />
              ) : recentExpenses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">🧾</p>
                  <p className="text-sm mb-2" style={{ color: 'var(--n350)' }}>No expenses yet.</p>
                  <Link to="/expenses" className="link-ink text-sm">Add your first →</Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {recentExpenses.map(e => {
                    const meta = getCategoryMeta(e.category)
                    return (
                      <li key={e.id} className="row-hover flex items-center gap-3 px-2 py-2.5 rounded-xl -mx-2">
                        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-base" style={{ backgroundColor: `${meta.color}1a` }}>
                          {meta.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{e.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                            {e.date && <span className="text-xs" style={{ color: 'var(--n250)' }}>· {e.date}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)' }}>−{money(e.amount)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Reveal>

        </div>
      </div>
    </main>
  )
}

/* ── Budget ring ── */
function BudgetRing({ pct, color, children }) {
  const size = 156, stroke = 13
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [draw, setDraw] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDraw(Math.min(100, pct)))
    return () => cancelAnimationFrame(id)
  }, [pct])
  const offset = c - (draw / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={pct > 100 ? '#ef4444' : pct > 85 ? '#f59e0b' : 'url(#ringGrad)'}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          className="ring-draw"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        {children}
      </div>
    </div>
  )
}

/* ── Category donut ── */
function CategoryDonut({ data, total }) {
  const size = 120, stroke = 16
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  const segs = data.map(([cat, amount]) => {
    const meta = getCategoryMeta(cat)
    const frac = total > 0 ? amount / total : 0
    const seg = { color: meta.color, len: frac * c, offset: acc }
    acc += frac * c
    return seg
  })
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      {segs.map((s, i) => (
        <circle
          key={i}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={s.color} strokeWidth={stroke}
          strokeDasharray={`${s.len} ${c - s.len}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  )
}

/* ── insight pill ── */
function Pill({ icon, text, tone }) {
  const bg = tone === 'over' ? 'rgba(239,68,68,0.12)' : tone === 'warn' ? 'rgba(245,158,11,0.12)' : tone === 'ok' ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)'
  const fg = tone === 'over' ? '#ef4444' : tone === 'warn' ? '#d97706' : tone === 'ok' ? '#16a34a' : 'var(--n600)'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
      style={{ background: bg, color: fg }}>
      <span style={{ fontSize: 12 }}>{icon}</span>{text}
    </span>
  )
}

/* ── stat chip ── */
function StatChip({ label, value, sub, emoji, onClick }) {
  const clickable = !!onClick
  return (
    <div
      onClick={onClick}
      className={`card p-4 ${clickable ? 'lift' : ''}`}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--n300)', letterSpacing: '0.06em' }}>{label}</p>
        <span style={{ fontSize: 14, opacity: 0.9 }}>{emoji}</span>
      </div>
      <p className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none tabular-nums truncate" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
        {value ?? <span className="inline-block h-6 w-16 rounded-md animate-pulse" style={{ backgroundColor: 'var(--track)' }} />}
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--n300)' }}>{sub}</p>
    </div>
  )
}

function Empty({ emoji, text }) {
  return (
    <div className="text-center py-8">
      <p className="text-3xl mb-2">{emoji}</p>
      <p className="text-sm" style={{ color: 'var(--n350)' }}>{text}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
    </div>
  )
}
