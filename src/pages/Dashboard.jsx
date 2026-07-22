import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { money0 } from '../lib/format'
import { monthKey, monthLabel, daysLeftInMonth } from '../lib/dates'
import { loadBudgetSnapshot } from '../lib/budget'
import { upsertBudget } from '../lib/budgets'
import { listDayTypes, seedDefaultDayTypesIfEmpty, summarizeDayTypes } from '../lib/dayTypes'
import { useCountUp } from '../hooks/useCountUp'
import Reveal from '../components/Reveal'
import BudgetRing from '../components/BudgetRing'
import SpendingTrend from '../components/SpendingTrend'
import FixedCostsCard from '../components/FixedCostsCard'
import FixedCostsModal from '../components/FixedCostsModal'
import DayTypeCards from '../components/DayTypeCards'
import Transactions from '../components/Transactions'
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
  const [log, setLog] = useState(null)
  const [showFixed, setShowFixed] = useState(false)
  const [showDayTypes, setShowDayTypes] = useState(false)
  const [showBudgetEdit, setShowBudgetEdit] = useState(false)
  const [budgetEditVal, setBudgetEditVal] = useState('')
  const [toast, setToast] = useState(location.state?.welcome ?? '')
  const [weather, setWeather] = useState(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!toast) return
    window.history.replaceState({}, '')
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (location.state?.openLog) {
      setLog({ type: null })
      window.history.replaceState({}, '')
    }
  }, [location.state?.openLog])

  // Real-time clock — re-evaluate greeting every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Dhaka weather via Open-Meteo (no API key needed)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=23.7104&longitude=90.4074&current=temperature_2m,weather_code&timezone=Asia%2FDhaka')
      .then(r => r.json())
      .then(d => setWeather({ temp: d.current.temperature_2m, code: d.current.weather_code }))
      .catch(() => {})
  }, [])

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

  async function refresh() {
    const s = await loadBudgetSnapshot(user.id, month)
    setSnap(s)
    const { data } = await listDayTypes(user.id)
    setDayTypes(data ?? [])
  }

  async function saveBudget() {
    const val = parseFloat(budgetEditVal)
    if (!(val > 0)) return
    setShowBudgetEdit(false)
    await upsertBudget(user.id, { main_monthly_budget: val, budget_mode: snap.budgetMode ?? 'shared' }, month)
    refresh()
  }

  function handleLogged() {
    setLog(null)
    setToast('Day logged 🎉')
    refresh()
  }

  const remaining = snap?.remaining ?? 0
  const spent = snap?.spent ?? 0
  const run = !!snap && snap.hasBudget
  const cuRemaining = useCountUp(remaining, run)
  const cuSpent = useCountUp(spent, run)

  if (loading && !snap) return <FullSpinner />
  if (snap?.missingSchema) return <SetupScreen variant="schema" onRetry={load} />
  if (!snap?.hasBudget) return <SetupScreen variant="budget" month={month} userId={user.id} onDone={refresh} />

  const { main, usedFraction, overBudget, fixedCosts, fixedTotal, monthExpenses, dailyLogs } = snap
  const summary = summarizeDayTypes(dayTypes, dailyLogs)
  const daysLeft = daysLeftInMonth()
  const health = budgetHealth({ main, remaining, overBudget, daysLeft })
  const ringColor = health.color
  // Size the hero number so it always sits inside the ring — based on the
  // final value's width (not the animating one) so it doesn't jump mid count-up.
  const heroSize = heroFontSize(overBudget ? `−${money0(Math.abs(remaining))}` : money0(remaining))

  // Pin greeting to Dhaka local time regardless of device timezone
  const dhakaHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', hourCycle: 'h23' }).format(now)
  )
  const greet = dhakaHour < 5 ? 'night' : dhakaHour < 12 ? 'morning' : dhakaHour < 17 ? 'afternoon' : dhakaHour < 21 ? 'evening' : 'night'

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto">
      {toast && (
        <div className="toast-in fixed left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2.5 px-5 py-3 rounded-full bottom-[calc(86px+env(safe-area-inset-bottom))] md:bottom-7"
          style={{ background: 'var(--ink)', color: 'var(--on-ink)', boxShadow: 'var(--shadow-toast)' }}>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

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
      {showBudgetEdit && (
        <div className="modal-scrim" onClick={() => setShowBudgetEdit(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Monthly budget</h2>
                <button onClick={() => setShowBudgetEdit(false)} aria-label="Close"
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--n400)', border: '1px solid var(--border-2)' }}>✕</button>
              </div>
              <div className="flex items-center rounded-xl px-4 py-3 mb-4"
                style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-base mr-2" style={{ color: 'var(--n350)' }}>৳</span>
                <input
                  type="number" min="1" step="1"
                  value={budgetEditVal}
                  onChange={e => setBudgetEditVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveBudget()}
                  className="flex-1 text-base font-semibold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                  autoFocus
                />
              </div>
              <button
                onClick={saveBudget}
                disabled={!(parseFloat(budgetEditVal) > 0)}
                className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-7 gap-3 fade-up">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--n400)' }}>
            Good {greet}
            {weather != null && (
              <span style={{ marginLeft: 6, opacity: 0.85 }}>
                · {wxIcon(weather.code)} {Math.round(weather.temp)}°C
              </span>
            )}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>{monthLabel(month)}</h1>
        </div>
        <button
          onClick={() => setLog({ type: null })}
          className="px-5 rounded-full text-sm flex items-center gap-2 flex-shrink-0"
          style={{ background: '#ffffff', color: '#000000', fontWeight: 600, border: '1.5px solid rgba(0,0,0,0.1)', minHeight: 48, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Log Today
        </button>
      </div>

      {/* Hero ring */}
      <Reveal className="mb-4">
        <div className="card p-8 flex flex-col items-center">
          <BudgetRing fraction={usedFraction} color={ringColor}>
            <span
              className="tabular-nums leading-none"
              style={{
                fontSize: heroSize,
                fontWeight: 700,
                color: overBudget ? 'var(--danger)' : 'var(--n900)',
                letterSpacing: '-0.03em',
                whiteSpace: 'nowrap',
              }}
            >
              {overBudget ? `−${money0(Math.abs(cuRemaining))}` : money0(cuRemaining)}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#888', letterSpacing: '0.07em', marginTop: '0.4rem' }}>
              {overBudget ? 'over budget' : 'left this month'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <span className="tabular-nums" style={{ fontSize: '0.7rem', color: 'var(--n350)' }}>
                of {money0(main)}
              </span>
              <button
                onClick={() => { setBudgetEditVal(String(main)); setShowBudgetEdit(true) }}
                className="btn-soft text-xs rounded-full font-semibold"
                style={{ fontSize: '0.65rem', padding: '1px 7px' }}
              >
                Edit
              </button>
            </div>
          </BudgetRing>

          <div className="flex items-center gap-2.5 mt-7">
            <StatPill value={money0(cuSpent)} label="spent" />
            <span style={{ color: 'var(--n250)' }}>·</span>
            <StatPill value={String(daysLeft)} label={`day${daysLeft === 1 ? '' : 's'} left`} />
          </div>

          {/* Budget health — one muted line derived from the same health bucket
              that colours the ring */}
          <p className="text-center mt-4" style={{ fontSize: '0.78rem', color: 'var(--n400)' }}>
            {health.emoji} {health.message}
          </p>
        </div>
      </Reveal>

      {/* Daily spending trend */}
      <Reveal className="mb-4" delay={20}>
        <SpendingTrend
          monthExpenses={monthExpenses}
          dailyLogs={dailyLogs}
          dayTypes={dayTypes}
          month={month}
          remaining={remaining}
        />
      </Reveal>

      {/* Fixed costs */}
      <Reveal className="mb-4" delay={40}>
        <FixedCostsCard fixedCosts={fixedCosts} total={fixedTotal} onEdit={() => setShowFixed(true)} />
      </Reveal>

      {/* Day type cards */}
      <div className="flex items-center justify-between mb-3 mt-8 px-1">
        <h2 style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--n500)' }}>
          Your Days
        </h2>
        <button onClick={() => setShowDayTypes(true)} className="link-ink text-xs">Manage →</button>
      </div>
      {summary.length === 0 ? (
        <div className="card p-6 text-center mb-4">
          <p className="text-sm mb-2" style={{ color: 'var(--n350)' }}>No day types yet.</p>
          <button onClick={() => setShowDayTypes(true)} className="btn-ink text-xs px-4 py-2 rounded-full font-semibold">Add a day type</button>
        </div>
      ) : (
        <Reveal className="mb-4" delay={40}>
          <DayTypeCards summary={summary} dailyLogs={dailyLogs} onLog={(dt) => setLog({ type: dt })} />
        </Reveal>
      )}

      {/* Transactions */}
      <div className="mt-8">
        <Reveal>
          <Transactions
            monthExpenses={monthExpenses}
            dailyLogs={dailyLogs}
            fixedCosts={fixedCosts}
            dayTypes={dayTypes}
            onRefresh={refresh}
          />
        </Reveal>
      </div>
    </main>
  )
}

// Single source of truth for budget health → drives both the ring arc colour
// and the indicator line. Daily allowance = remaining spread over the days
// left in the month (guard against a divide-by-zero on the last day).
// WMO weather code → emoji. Covers the full Open-Meteo code table.
function wxIcon(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌧️'
  return '⛈️'
}

function budgetHealth({ main, remaining, overBudget, daysLeft }) {
  const perDay = money0(Math.abs(remaining) / Math.max(1, daysLeft))
  if (overBudget) {
    return { level: 'over', color: '#ef4444', emoji: '🔴', message: `Over budget by ${money0(Math.abs(remaining))}` }
  }
  const remFrac = main > 0 ? remaining / main : 0
  if (remFrac > 0.5) {
    return { level: 'good', color: '#22c55e', emoji: '🟢', message: `On track — ${perDay} per day available` }
  }
  if (remFrac >= 0.2) {
    return { level: 'watch', color: '#f59e0b', emoji: '🟡', message: `Watch your spending — ${perDay} per day left` }
  }
  return { level: 'low', color: '#ef4444', emoji: '🔴', message: `Budget running low — ${perDay} per day left` }
}

// Pick a hero font size so the amount sits comfortably inside the ring.
// Inner ring diameter = 2 × (r - stroke/2) = 2 × 91 = 182 px.
// At 16px base: 2.2rem ≈ 35px → "৳5,516" is ~120px wide, well inside.
function heroFontSize(str) {
  const n = str.length
  if (n <= 5) return '2.8rem'   // ৳0–999
  if (n <= 6) return '2.2rem'   // ৳1,000–9,999  (e.g. ৳5,516)
  if (n <= 7) return '1.95rem'  // ৳10,000–99,999
  if (n <= 8) return '1.7rem'   // ৳100,000–999,999 / −৳22,696
  return '1.5rem'
}

function StatPill({ value, label }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 px-3.5 py-2 rounded-full"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--n900)' }}>{value}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--n400)' }}>{label}</span>
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
