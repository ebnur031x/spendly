import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { money0 } from '../lib/format'
import { monthKey, monthLabel, daysLeftInMonth } from '../lib/dates'
import { loadBudgetSnapshot } from '../lib/budget'
import { listDayTypes, seedDefaultDayTypesIfEmpty, summarizeDayTypes } from '../lib/dayTypes'
import { useCountUp } from '../hooks/useCountUp'
import Reveal from '../components/Reveal'
import BudgetRing from '../components/BudgetRing'
import FixedCostsCard from '../components/FixedCostsCard'
import FixedCostsModal from '../components/FixedCostsModal'
import DayTypeCards from '../components/DayTypeCards'
import RecentExpenses from '../components/RecentExpenses'
import LogTodayModal from '../components/LogTodayModal'
import DayTypesModal from '../components/DayTypesModal'
import SetupScreen from '../components/SetupScreen'

export default function Dashboard() {
  const { user } = useAuth()
  const location = useLocation()
  const month = monthKey()

  const [loading, setLoading] = useState(true)
  const [snap, setSnap] = useState(null)
  const [dayTypes, setDayTypes] = useState([])
  const [log, setLog] = useState(null)          // null | { type } → Log Today modal
  const [showFixed, setShowFixed] = useState(false)
  const [showDayTypes, setShowDayTypes] = useState(false)
  const [toast, setToast] = useState(location.state?.welcome ?? '')

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!toast) return
    window.history.replaceState({}, '')
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  // Nav "Log Today" buttons route here with an openLog signal.
  useEffect(() => {
    if (location.state?.openLog) {
      setLog({ type: null })
      window.history.replaceState({}, '')
    }
  }, [location.state?.openLog])

  async function load() {
    setLoading(true)
    const s = await loadBudgetSnapshot(user.id, month)
    setSnap(s)
    if (!s.missingSchema) {
      const { data } = await seedDefaultDayTypesIfEmpty(user.id)
      setDayTypes(data ?? [])
    }
    setLoading(false)
  }

  // Quiet background refresh after a mutation — no full-screen spinner.
  async function refresh() {
    const s = await loadBudgetSnapshot(user.id, month)
    setSnap(s)
    const { data } = await listDayTypes(user.id)
    setDayTypes(data ?? [])
  }

  function handleLogged() {
    setLog(null)
    setToast('Day logged 🎉')
    refresh()
  }

  // Count-up hooks must run on every render (before the gates below) to keep
  // hook order stable. They idle at 0 until a budget snapshot is loaded.
  const remaining = snap?.remaining ?? 0
  const spent = snap?.spent ?? 0
  const run = !!snap && snap.hasBudget
  const cuRemaining = useCountUp(remaining, run)
  const cuSpent = useCountUp(spent, run)

  /* ── gates: loading / schema / first-time budget ── */
  if (loading && !snap) return <FullSpinner />
  if (snap?.missingSchema) return <SetupScreen variant="schema" onRetry={load} />
  if (!snap?.hasBudget) return <SetupScreen variant="budget" month={month} userId={user.id} onDone={refresh} />

  /* ── derived ── */
  const { main, usedFraction, overBudget, fixedCosts, fixedTotal, recentExpenses, dailyLogs } = snap
  const summary = summarizeDayTypes(dayTypes, dailyLogs)
  const daysLeft = daysLeftInMonth()
  const ringColor = overBudget ? 'var(--danger)' : 'var(--n900)'

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto">
      {/* welcome / action toast */}
      {toast && (
        <div className="toast-in fixed left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2.5 px-5 py-3 rounded-full bottom-[calc(86px+env(safe-area-inset-bottom))] md:bottom-7"
          style={{ background: 'var(--ink)', color: 'var(--on-ink)', boxShadow: 'var(--shadow-toast)' }}>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* modals */}
      {log && (
        <LogTodayModal userId={user.id} dayTypes={dayTypes} initialType={log.type}
          onClose={() => setLog(null)} onSaved={handleLogged} />
      )}
      {showFixed && (
        <FixedCostsModal userId={user.id} fixedCosts={fixedCosts}
          onClose={() => setShowFixed(false)} onChanged={refresh} />
      )}
      {showDayTypes && (
        <DayTypesModal userId={user.id} dayTypes={dayTypes}
          onClose={() => setShowDayTypes(false)} onChanged={refresh} />
      )}

      {/* header */}
      <div className="flex items-center justify-between mb-7 gap-3 fade-up">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--n400)' }}>Good {greet}</p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>{monthLabel(month)}</h1>
        </div>
        <button onClick={() => setLog({ type: null })}
          className="btn-ink px-5 rounded-full text-sm font-bold flex items-center gap-2 flex-shrink-0"
          style={{ minHeight: 48 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Log Today
        </button>
      </div>

      {/* hero ring */}
      <Reveal className="mb-4">
        <div className="card p-8 flex flex-col items-center">
          <BudgetRing fraction={usedFraction} color={ringColor}>
            <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: overBudget ? 'var(--danger)' : 'var(--n900)', letterSpacing: '-0.03em' }}>
              {overBudget ? `−${money0(Math.abs(cuRemaining))}` : money0(cuRemaining)}
            </span>
            <span className="text-xs mt-2" style={{ color: 'var(--n400)' }}>
              {overBudget ? 'over budget' : 'left this month'}
            </span>
            <span className="text-[11px] mt-1 tabular-nums" style={{ color: 'var(--n300)' }}>of {money0(main)}</span>
          </BudgetRing>

          <div className="flex items-center gap-2.5 mt-7">
            <StatPill value={money0(cuSpent)} label="spent" />
            <span style={{ color: 'var(--n250)' }}>·</span>
            <StatPill value={String(daysLeft)} label={`day${daysLeft === 1 ? '' : 's'} left in month`} />
          </div>
        </div>
      </Reveal>

      {/* fixed costs */}
      <Reveal className="mb-4" delay={40}>
        <FixedCostsCard fixedCosts={fixedCosts} total={fixedTotal} onEdit={() => setShowFixed(true)} />
      </Reveal>

      {/* daily spending — day type cards */}
      <div className="flex items-center justify-between mb-3 mt-8 px-1">
        <h2 className="text-sm font-bold" style={{ color: 'var(--n900)' }}>Your days</h2>
        <button onClick={() => setShowDayTypes(true)} className="link-ink text-xs">Manage →</button>
      </div>
      {summary.length === 0 ? (
        <div className="card p-6 text-center mb-4">
          <p className="text-sm mb-2" style={{ color: 'var(--n350)' }}>No day types yet.</p>
          <button onClick={() => setShowDayTypes(true)} className="btn-ink text-xs px-4 py-2 rounded-full font-semibold">Add a day type</button>
        </div>
      ) : (
        <Reveal className="mb-4" delay={40}>
          <DayTypeCards summary={summary} onLog={(dt) => setLog({ type: dt })} />
        </Reveal>
      )}

      {/* recent expenses */}
      <div className="mt-8">
        <Reveal>
          <RecentExpenses expenses={recentExpenses} />
        </Reveal>
      </div>
    </main>
  )
}

function StatPill({ value, label }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 px-3.5 py-2 rounded-full"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
      <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--n900)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--n400)' }}>{label}</span>
    </span>
  )
}

function FullSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--n900)' }} />
    </div>
  )
}
