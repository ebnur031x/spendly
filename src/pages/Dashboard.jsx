import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { money0 } from '../lib/format'
import { monthKey, monthLabel, daysLeftInMonth, daysInMonth } from '../lib/dates'
import { loadBudgetSnapshot, resetMonth } from '../lib/budget'
import { BUCKETS, bucketView, ensureBucketSettings } from '../lib/buckets'
import { listDayTypes, seedDefaultDayTypesIfEmpty } from '../lib/dayTypes'
import { useCountUp } from '../hooks/useCountUp'
import Reveal from '../components/Reveal'
import BudgetRing from '../components/BudgetRing'
import SpendingTrend from '../components/SpendingTrend'
import BucketCard from '../components/BucketCard'
import MonthNav from '../components/MonthNav'
import { resolveCap } from '../components/MiniBudgetBar'
import LogTodayModal from '../components/LogTodayModal'
import SetupScreen from '../components/SetupScreen'
import ThemeToggle from '../components/ThemeToggle'

const MONTH_RE = /^\d{4}-\d{2}$/

const DOT_LEGEND = [
  { color: '#ff5f57', label: 'Over budget' },
  { color: '#febc2e', label: 'Approaching limit' },
  { color: '#28c840', label: 'On track' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKey()
  const isCurrentMonth = month === monthKey()

  // Navbar (desktop-only) already has this; mobile has never had any way to
  // sign out, so it's duplicated here rather than lifted into a shared
  // component — same one-line logic in both places.
  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  function goToMonth(m) {
    if (m === monthKey()) setSearchParams({})
    else setSearchParams({ month: m })
  }

  const [loading, setLoading] = useState(true)
  const [snap, setSnap] = useState(null)
  const [dayTypes, setDayTypes] = useState([])
  const [log, setLog] = useState(null)
  const [toast, setToast] = useState(location.state?.welcome ?? '')
  const [weather, setWeather] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [showReset, setShowReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [dotHover, setDotHover] = useState(null)

  useEffect(() => {
    if (dotHover === null) return
    const close = () => setDotHover(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [dotHover])

  useEffect(() => { load() /* eslint-disable-next-line */ }, [month])

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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=23.7104&longitude=90.4074&current=temperature_2m,weather_code&timezone=Asia%2FDhaka')
      .then(r => r.json())
      .then(d => setWeather({ temp: d.current.temperature_2m, code: d.current.weather_code }))
      .catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    await ensureBucketSettings(user.id)
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

  function handleLogged() {
    setLog(null)
    setToast('Day logged')
    refresh()
  }

  async function handleReset() {
    setResetting(true)
    const { error } = await resetMonth(user.id, month)
    setResetting(false)
    setShowReset(false)
    if (error) { setToast(error.message); return }
    setToast(`${monthLabel(month)} reset`)
    refresh()
  }

  const remaining = snap?.remaining ?? 0
  const spent = snap?.spent ?? 0
  const run = !!snap && snap.hasBudget
  const cuRemaining = useCountUp(remaining, run)
  const cuSpent = useCountUp(spent, run)

  if (loading && !snap) return <FullSpinner />
  if (snap?.missingSchema) return <SetupScreen onRetry={load} />

  if (!snap?.hasBudget) {
    // Every month with no budget row — current, past, future, or just reset
    // — gets the same plain empty state, not a special first-run wizard.
    return (
      <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up frost-page">
        <div className="flex items-center justify-between mb-7 gap-3">
          <h1><MonthTitle month={month} size={30} /></h1>
          <MonthNav month={month} onChange={goToMonth} />
        </div>
        <div className="card p-8 text-center">
          <p className="text-sm mb-4" style={{ color: 'var(--n400)' }}>No budget set for {monthLabel(month)} yet.</p>
          <Link to={`/budget-settings?month=${month}`} className="btn-ink inline-block px-5 py-2.5 rounded-xl text-sm font-bold">
            Set up this month's budget →
          </Link>
        </div>
      </main>
    )
  }

  const { main, usedFraction, overBudget, dailyExpenses, dailyLogs } = snap
  const daysLeft = daysLeftInMonth()
  const dpm = daysInMonth(month)
  const health = budgetHealth({ main, remaining, overBudget, daysLeft, isCurrentMonth })
  const ringColor = health.color
  const heroSize = heroFontSize(overBudget ? `−${money0(Math.abs(remaining))}` : money0(remaining))

  const dhakaHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', hourCycle: 'h23' }).format(now)
  )
  const greet = dhakaHour < 5 ? 'night' : dhakaHour < 12 ? 'morning' : dhakaHour < 17 ? 'afternoon' : dhakaHour < 21 ? 'evening' : 'night'

  // Build the four bucket cards
  const byCreated = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  const preview = {
    daily: [...dailyExpenses].sort(byCreated).map(e => ({ name: e.title, amount: e.amount })),
    groceries: [...snap.groceryExpenses].sort(byCreated).map(e => ({ name: e.title, amount: e.amount })),
    bills: [...snap.billsExpenses].sort(byCreated).map(e => ({ name: e.title, amount: e.amount })),
    commitments: [...snap.commitmentInstances].map(c => ({ name: c.name, amount: c.amount })),
  }
  const cards = BUCKETS.map(b => {
    const view = bucketView(b.key, snap.settingsByBucket)
    const { cap } = resolveCap({ miniBudget: view.miniBudget, capPeriod: view.capPeriod }, dpm)
    return { view, cap, used: snap.bucketTotals[b.key] || 0, entries: preview[b.key] || [] }
  })

  // Same daily bar chart, one dataset per bucket — commitments are keyed by
  // `due_date` in fixed_costs rather than `date`, so normalize that here.
  const trendCategories = cards.map(c => ({
    key: c.view.key,
    label: c.view.name.replace(' Spend', ''),
    icon: c.view.icon,
    color: c.view.color,
    expenses: c.view.key === 'daily' ? dailyExpenses
      : c.view.key === 'groceries' ? snap.groceryExpenses
      : c.view.key === 'bills' ? snap.billsExpenses
      : snap.commitmentInstances.map(ci => ({ ...ci, date: ci.due_date, title: ci.name })),
  }))

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto frost-page">
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
      {/* Header. flex-wrap + the icon group's own margin-left:auto: on a
          normal phone width this icon row (theme/search/sign-out on mobile)
          doesn't reliably fit next to the month title + nav on one line —
          measured real overflow of 20-37px past the screen edge on 375-390px
          devices, which with no global overflow-x guard drags the WHOLE page
          wider than the viewport (the "randomly zoomed" look). Wrapping the
          icons onto their own right-aligned line below is a completely
          normal mobile pattern and makes that overflow structurally
          impossible, the same fix used for the deep-dive's day-type row. */}
      <div className="flex items-center flex-wrap justify-between fade-up" style={{ marginBottom: 28, rowGap: 10, columnGap: 12 }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--n400)' }}>
            {isCurrentMonth ? (
              <>
                Good {greet}
                {weather != null && (
                  <span style={{ marginLeft: 6, opacity: 0.85 }}>· {Math.round(weather.temp)}°C</span>
                )}
              </>
            ) : (
              month < monthKey() ? 'Past month' : 'Upcoming month'
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>{monthLabel(month)}</h1>
            <MonthNav month={month} onChange={goToMonth} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" style={{ marginLeft: 'auto' }}>
          {/* md:hidden on a plain wrapper div, not on ThemeToggle itself:
              ThemeToggle sets `display: inline-flex` via inline style, and
              an inline style always wins over a class rule (Tailwind's
              utilities aren't !important) — `md:hidden` directly on the
              button was silently a no-op, which is why it showed up
              doubled on desktop. Wrapping it sidesteps the conflict
              entirely instead of fighting specificity. */}
          <div className="md:hidden">
            <ThemeToggle style={{ width: 48, height: 48 }} />
          </div>
          <Link to={isCurrentMonth ? '/transactions' : `/transactions?month=${month}`} aria-label="Search all transactions"
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n600)' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          {/* Sign out has never had a mobile home — Navbar (desktop-only)
              was the only place it lived. Same corner as the other utility
              icons, since that's where a mobile user would look for it. */}
          <button onClick={handleSignOut} aria-label="Sign out"
            className="md:hidden w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n600)', cursor: 'pointer' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Hero ring */}
      <Reveal className="mb-4">
        <div className="card card-frost p-8 flex flex-col items-center" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="nightstand-blobs" aria-hidden="true">
            <div className="blob" style={{ width: 260, height: 260, background: '#4a48c9', top: -80, left: -70 }} />
            <div className="blob" style={{ width: 220, height: 220, background: ringColor, top: 30, right: -70 }} />
            <div className="blob" style={{ width: 220, height: 220, background: '#b8862e', bottom: -90, left: 40 }} />
          </div>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <BudgetRing fraction={usedFraction} color={ringColor}>
            <span className="tabular-nums leading-none"
              style={{ fontSize: heroSize, fontWeight: 700, color: overBudget ? 'var(--danger)' : 'var(--n900)', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
              {overBudget ? `−${money0(Math.abs(cuRemaining))}` : money0(cuRemaining)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--n400)', letterSpacing: '0.07em', marginTop: '0.4rem' }}>
              {overBudget ? 'over budget' : isCurrentMonth ? 'left this month' : 'left unspent'}
            </span>
            {/* The ring keeps only the figure — editing moved to a real
                button below, where it's actually findable. */}
            <span className="tabular-nums" style={{ fontSize: '0.7rem', color: 'var(--n350)', marginTop: 4 }}>
              of {money0(main)}
            </span>
          </BudgetRing>

          <div className="flex items-center gap-2.5 mt-7">
            <StatPill value={money0(cuSpent)} label="spent" />
            <span style={{ color: 'var(--n250)' }}>·</span>
            {isCurrentMonth
              ? <StatPill value={String(daysLeft)} label={`day${daysLeft === 1 ? '' : 's'} left`} />
              : <StatPill value={String(dpm)} label={`day${dpm === 1 ? '' : 's'} total`} />}
          </div>

          <p className="text-center mt-4" style={{ fontSize: '0.78rem', color: 'var(--n400)' }}>{health.message}</p>

          <Link to={`/budget-settings?month=${month}`}
            className="btn-soft flex items-center justify-center gap-2 rounded-xl font-semibold mx-auto mt-5"
            style={{ fontSize: '0.82rem', padding: '11px 20px', width: '100%', maxWidth: 300 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Budget &amp; category caps
          </Link>

          <button onClick={() => setShowReset(true)}
            className="text-xs font-semibold mt-3"
            style={{ color: 'var(--n300)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Reset this month
          </button>
          </div>
        </div>
      </Reveal>

      {/* Four buckets */}
      <div className="flex items-center justify-between mb-3 mt-7 px-1">
        <h2 className="flex items-center gap-2" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--n500)' }}>
          <span className="flex items-center gap-1.5">
            {DOT_LEGEND.map((d, i) => (
              <span key={d.color} style={{ position: 'relative' }}
                onMouseEnter={() => setDotHover(i)}
                onMouseLeave={() => setDotHover(null)}
                onClick={e => { e.stopPropagation(); setDotHover(h => h === i ? null : i) }}>
                <span style={{
                  display: 'block', width: 10, height: 10, borderRadius: '50%', background: d.color,
                  boxShadow: 'inset 0 -1px 1.5px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)',
                  cursor: 'default',
                }} />
                {dotHover === i && (
                  <span className="pop-fade" style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginBottom: 8, zIndex: 30, whiteSpace: 'nowrap', pointerEvents: 'none',
                    background: 'var(--surface-2)', border: '1px solid var(--border-soft)',
                    borderRadius: 7, padding: '4px 8px', fontSize: '0.65rem', fontWeight: 600,
                    textTransform: 'none', letterSpacing: 'normal', color: 'var(--n700)',
                    boxShadow: 'var(--shadow-tooltip)',
                  }}>
                    {d.label}
                  </span>
                )}
              </span>
            ))}
          </span>
          Your Buckets
        </h2>
        <span className="text-xs" style={{ color: 'var(--n350)' }}>all net against ৳{money0(main).slice(1)}</span>
      </div>
      <Reveal className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map(c => (
            <BucketCard key={c.view.key} view={c.view} used={c.used} cap={c.cap} entries={c.entries}
              onOpen={() => navigate(`/${c.view.key}`)} />
          ))}
        </div>
      </Reveal>

      <div className="flex justify-center mb-4">
        <Link to={isCurrentMonth ? '/transactions' : `/transactions?month=${month}`}
          className="text-xs font-semibold" style={{ color: 'var(--n400)' }}>
          See all transactions →
        </Link>
      </div>

      {/* Daily spending trend — one dataset per bucket, switchable via the
          tabs inside the card, so no single view distorts the others */}
      <Reveal className="mb-4" delay={20}>
        <SpendingTrend categories={trendCategories} dailyLogs={dailyLogs} dayTypes={dayTypes} month={month} remaining={remaining} />
      </Reveal>

      {showReset && (
        <div className="modal-scrim" onClick={() => !resetting && setShowReset(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-extrabold mb-2" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                Reset {monthLabel(month)}?
              </h2>
              <p className="text-sm mb-5" style={{ color: 'var(--n400)' }}>
                This permanently deletes every expense, daily log, and reserved commitment for {monthLabel(month)}, plus this month's budget. This can't be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowReset(false)} disabled={resetting}
                  className="btn-soft flex-1 py-2.5 rounded-xl text-sm font-semibold">
                  Cancel
                </button>
                <button onClick={handleReset} disabled={resetting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {resetting ? 'Resetting…' : 'Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function budgetHealth({ main, remaining, overBudget, daysLeft, isCurrentMonth }) {
  if (overBudget) return { level: 'over', color: '#ef4444', message: `Over budget by ${money0(Math.abs(remaining))}` }
  // "Per day" pacing only makes sense while the month is actually live —
  // for a past or future month, just state what's left.
  if (!isCurrentMonth) return { level: 'good', color: '#22c55e', message: `${money0(remaining)} left unspent` }
  const perDay = money0(Math.abs(remaining) / Math.max(1, daysLeft))
  const remFrac = main > 0 ? remaining / main : 0
  if (remFrac > 0.5) return { level: 'good', color: '#22c55e', message: `On track — ${perDay} per day available` }
  if (remFrac >= 0.2) return { level: 'watch', color: '#f59e0b', message: `Watch your spending — ${perDay} per day left` }
  return { level: 'low', color: '#ef4444', message: `Budget running low — ${perDay} per day left` }
}

function heroFontSize(str) {
  const n = str.length
  if (n <= 5) return '2.8rem'
  if (n <= 6) return '2.2rem'
  if (n <= 7) return '1.95rem'
  if (n <= 8) return '1.7rem'
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
