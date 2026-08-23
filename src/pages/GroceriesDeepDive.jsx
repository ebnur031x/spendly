import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import MonthTitle from '../components/MonthTitle'
import { money, money0 } from '../lib/format'
import { monthKey, dayKey, daysInMonth } from '../lib/dates'
import { isMissingSchema } from '../lib/schema'
import { bucketMeta, ensureBucketSettings, updateBucketSetting, indexSettings } from '../lib/buckets'
import {
  listLogItems, addLogItem, updateLogItem, deleteLogItem, groupItemsByWeek,
} from '../lib/groceryDeepDive'
import Reveal from '../components/Reveal'
import SetupScreen from '../components/SetupScreen'
import MonthNav from '../components/MonthNav'

/* ══════════════════════════════════════════════════════════════════
   Groceries deep-dive — a standalone tracker reached from the Groceries
   bucket screen. Deliberately flat, on request: no item pool, no trip
   wrapper — log a name, a price, a date, done. Weekly and monthly totals
   fall out of grouping that one list. Doesn't read/write expenses/budgets.
   It DOES write bucket_settings.mini_budget for 'groceries', but only
   when the user explicitly taps "Set as my Groceries budget" — never
   automatically. See BucketDetail.jsx: the Groceries cap editor there is
   read-only, so this stays the one writer (same fix used for the Daily
   Spend deep-dive's cap — two editors on one field silently fight).

   Month scoping is strict: listLogItems bounds by the real calendar month
   (day 1 through the last day), never by "today", so an early-month entry
   is never dropped and the next month always starts empty. MonthNav still
   lets you browse back to see a past month's log in full.
   ══════════════════════════════════════════════════════════════════ */

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}
const editBtnStyle = {
  width: 26, height: 26, borderRadius: '50%',
  background: 'var(--surface)', border: '1.5px solid var(--border-soft)',
  color: 'var(--n500)', fontSize: 11, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const MONTH_RE = /^\d{4}-\d{2}$/

export default function GroceriesDeepDive() {
  const { user } = useAuth()
  const { deleteWithUndo } = useUndoableDelete()
  const groceries = bucketMeta('groceries')

  const [searchParams, setSearchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKey()
  function goToMonth(m) {
    if (m === monthKey()) setSearchParams({})
    else setSearchParams({ month: m })
  }

  const [loading, setLoading] = useState(true)
  const [missingSchema, setMissingSchema] = useState(false)
  const [error, setError] = useState('')

  const [entries, setEntries] = useState([])
  const [setting, setSetting] = useState(null) // bucket_settings row for 'groceries'
  const [savingBudget, setSavingBudget] = useState(false)

  // composer
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(dayKey(new Date()))
  const [saving, setSaving] = useState(false)

  // Editing an item includes its date, so a saved item can be moved to a
  // different day without deleting and re-adding it.
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')

  useEffect(() => { loadSettings() /* eslint-disable-next-line */ }, [])
  useEffect(() => { loadEntries() /* eslint-disable-next-line */ }, [month])

  async function loadSettings() {
    const { data, error: err } = await ensureBucketSettings(user.id)
    if (isMissingSchema(err)) { setMissingSchema(true); return }
    if (err) setError(err.message)
    setSetting(indexSettings(data ?? [])['groceries'] ?? null)
  }

  async function loadEntries() {
    setLoading(true)
    const { data, error: err } = await listLogItems(user.id, month)
    if (isMissingSchema(err)) { setMissingSchema(true); setLoading(false); return }
    if (err) setError(err.message)
    setEntries(data ?? [])
    setLoading(false)
  }

  /* ── Composer ── */

  const canAdd = !!name.trim() && parseFloat(amount) > 0 && !!date && !saving

  async function handleAdd(e) {
    e?.preventDefault()
    if (!canAdd) return
    setSaving(true); setError('')
    const { data, error: err } = await addLogItem(user.id, { date, name: name.trim(), amount: parseFloat(amount) })
    setSaving(false)
    if (err) { setError(err.message); return }
    // Adding a past date (browsing an earlier month) shouldn't insert into
    // today's list out of order — resort by date, newest first, on add.
    setEntries(prev => [data, ...prev].sort((a, b) =>
      b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)))
    setName(''); setAmount('')
  }

  /* ── Inline edit ── */

  function openEdit(entry) {
    setEditingId(entry.id)
    setEditName(entry.name)
    setEditAmount(String(entry.amount))
    setEditDate(entry.date)
  }

  async function saveEdit() {
    const amt = parseFloat(editAmount)
    if (!editName.trim() || !(amt > 0) || !editDate) return
    const { data, error: err } = await updateLogItem(editingId, { name: editName.trim(), amount: amt, date: editDate })
    if (err) { setError(err.message); return }
    setEditingId(null)
    // A date edit can move an entry out of the currently-viewed month.
    if (!data.date.startsWith(month)) {
      setEntries(prev => prev.filter(en => en.id !== data.id))
    } else {
      setEntries(prev => [...prev.filter(en => en.id !== data.id), data]
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)))
    }
  }

  function handleDelete(id) {
    const item = entries.find(en => en.id === id)
    if (!item) return
    const snapshot = entries
    deleteWithUndo({
      message: `Deleted "${item.name}"`,
      remove: () => setEntries(prev => prev.filter(en => en.id !== id)),
      commit: async () => {
        const { error: err } = await deleteLogItem(id)
        if (err) { setError(err.message); setEntries(snapshot) }
      },
      restore: () => setEntries(snapshot),
    })
  }

  /* ── Totals ── */

  const monthTotal = useMemo(() => entries.reduce((s, en) => s + Number(en.amount), 0), [entries])
  const weeks = useMemo(() => groupItemsByWeek(entries), [entries])
  const isCurrentMonth = month === monthKey()

  /* ── Projected this month ──
     "This month" is just the actual total so far — a week into the month
     that's misleadingly low. The user's point: grocery weeks tend to look
     similar (item mix shifts, the price range doesn't), so a weekly
     average extrapolated across the month is the genuinely useful number
     for budgeting, not the partial actual. Only shown for the month
     currently in progress — a past month's "This month" is already the
     real, final total, so projecting it would just be a confusing echo. */
  const weeklyAvg = weeks.length > 0 ? monthTotal / weeks.length : 0
  const weeksInMonth = daysInMonth(month) / 7
  const projectedMonth = Math.round(weeklyAvg * weeksInMonth)
  const showProjection = isCurrentMonth && weeks.length > 0

  // What "Set as my Groceries budget" targets: the projection while the
  // month's still in progress (that's the actual point of projecting it),
  // the real final total once the month is over and nothing projects.
  const budgetTarget = showProjection ? projectedMonth : monthTotal

  /* ── Set as my Groceries budget — manual, never automatic. There's no
     "fully allocated" style signal here the way Daily has, so auto-syncing
     on every add would make the budget drift with each purchase instead
     of staying a target. ── */
  const capInSync = !!setting && Number(setting.mini_budget) === budgetTarget

  async function handleSetBudget() {
    if (!setting || savingBudget || capInSync) return
    setSavingBudget(true); setError('')
    const { data, error: err } = await updateBucketSetting(setting.id, {
      mini_budget: budgetTarget,
      cap_period: 'monthly',
    })
    setSavingBudget(false)
    if (err) { setError(err.message); return }
    setSetting(data)
  }

  if (missingSchema) return <SetupScreen onRetry={() => { loadSettings(); loadEntries() }} />

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--n900)' }} />
      </main>
    )
  }

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up frost-page">
      <Link to="/groceries" className="text-xs font-semibold inline-block mb-4" style={{ color: 'var(--n400)' }}>
        ← Groceries
      </Link>

      <div className="flex items-start gap-3 mb-1">
        <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${groceries.color}22`, fontSize: 21, color: groceries.color }}>{groceries.icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
            Groceries deep-dive
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--n350)' }}>
            What you bought, what it cost — weekly and monthly.
          </p>
        </div>
      </div>

      <p className="text-xs mt-3 mb-6 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', color: 'var(--n400)' }}>
        A standalone tracker. It won't change your Groceries totals elsewhere in the app unless you set it as your budget below.
      </p>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
          {error}
        </div>
      )}

      <Reveal>
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>{monthLabel(month)}</p>
            <MonthNav month={month} onChange={goToMonth} />
          </div>

          {/* monthly total, + a projection while the month's still open */}
          <div className={`flex items-baseline justify-between ${showProjection ? 'mb-1' : 'mb-5'}`}>
            <span className="text-sm font-semibold" style={{ color: 'var(--n500)' }}>This month</span>
            <span className="text-3xl font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
              {money0(monthTotal)}
            </span>
          </div>

          {showProjection && (
            <div className="flex items-baseline justify-between mb-5 pb-4" style={{ borderBottom: '1px solid var(--border-2)' }}>
              <div>
                <span className="text-xs font-semibold" style={{ color: groceries.color }}>Projected for the month</span>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--n350)' }}>
                  based on ~{money0(weeklyAvg)}/week so far
                </p>
              </div>
              <span className="text-xl font-extrabold tabular-nums" style={{ color: groceries.color, letterSpacing: '-0.02em' }}>
                ~{money0(projectedMonth)}
              </span>
            </div>
          )}

          {/* composer */}
          <form onSubmit={handleAdd} className="flex items-center gap-2 mb-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken"
              className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm" style={inputStyle} />
            <div className="flex items-center rounded-xl px-3 flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', width: 100 }}>
              <span className="text-sm mr-1" style={{ color: 'var(--n300)' }}>৳</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" className="w-full py-2 text-sm font-semibold tabular-nums"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
            </div>
            <button type="submit" disabled={!canAdd}
              className="btn-ink rounded-xl font-semibold flex-shrink-0"
              style={{ padding: '0 18px', height: 44, fontSize: 14, opacity: !canAdd ? 0.45 : 1 }}>
              Add
            </button>
          </form>
          <div className="flex items-center justify-between mb-5 px-1">
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Date</span>
            <input type="date" value={date} max={dayKey(new Date())}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
          </div>

          {/* set as the real Groceries budget — manual, never automatic.
              Targets the projection while the month's in progress (that's
              the point of projecting it), the real total once it's over. */}
          {entries.length > 0 && (
            capInSync ? (
              <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                style={{ background: `${groceries.color}14`, border: `1px solid ${groceries.color}44` }}>
                <span aria-hidden style={{ color: groceries.color, fontSize: 13 }}>✓</span>
                <p className="text-xs font-semibold" style={{ color: groceries.color }}>
                  {money0(budgetTarget)} is your current Groceries budget.
                </p>
              </div>
            ) : (
              <button type="button" onClick={handleSetBudget} disabled={savingBudget}
                className="btn-soft w-full py-2.5 rounded-xl text-sm font-semibold">
                {savingBudget ? 'Saving…' : `Set ${money0(budgetTarget)}${showProjection ? ' (projected)' : ''} as my Groceries budget →`}
              </button>
            )
          )}
        </div>
      </Reveal>

      {/* weekly-grouped log */}
      <Reveal delay={60}>
        {entries.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-4xl mb-3">{groceries.icon}</p>
            <p className="text-sm" style={{ color: 'var(--n350)' }}>Nothing logged yet this month.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>Add your first item above ↑</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-xs -mb-1 px-1" style={{ color: 'var(--n350)' }}>
              Tap the pencil on any item to edit it or move the same item to a different date.
            </p>
            {weeks.map(week => (
              <div key={week.key}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
                    {week.label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--n400)' }}>{money0(week.total)}</span>
                </div>
                <div className="card overflow-hidden">
                  <ul>
                    {week.items.map((entry, i) => (
                      <li key={entry.id} className={`row-hover flex items-center gap-2 px-4 sm:px-5 py-3 ${editingId === entry.id ? 'flex-wrap' : ''}`}
                        style={{ borderBottom: i < week.items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                        {editingId === entry.id ? (
                          <>
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveEdit()}
                              className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-sm" style={inputStyle} autoFocus />
                            <input type="date" value={editDate} max={dayKey(new Date())}
                              onChange={e => e.target.value && setEditDate(e.target.value)}
                              className="text-xs font-semibold rounded-full px-2.5 py-1.5 cursor-pointer flex-shrink-0"
                              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
                            <div className="flex items-center rounded-lg px-2 flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', width: 90 }}>
                              <span className="text-xs mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                              <input type="number" min="0.01" step="0.01" value={editAmount}
                                onChange={e => setEditAmount(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                className="w-full py-1 text-sm font-semibold tabular-nums"
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
                            </div>
                            <button onClick={saveEdit} title="Save" style={editBtnStyle}>✓</button>
                            <button onClick={() => setEditingId(null)} title="Cancel" style={editBtnStyle}>✕</button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{entry.name}</p>
                              <p className="text-xs" style={{ color: 'var(--n350)' }}>
                                {parseDayLabel(entry.date)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)' }}>{money(entry.amount)}</span>
                            <button onClick={() => openEdit(entry)} title="Edit item or move its date" aria-label={`Edit ${entry.name} or move its date`} style={editBtnStyle}>✎</button>
                            <button onClick={() => handleDelete(entry.id)} className="btn-delete" title="Delete">×</button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </Reveal>
    </main>
  )
}

function parseDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
