import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATEGORIES, CATEGORY_TYPES, getCategoryMeta } from '../lib/categories'
import { dayKey, parseKey, expenseDay, addDays, monthKey, daysInMonth } from '../lib/dates'
import { insertExpenses } from '../lib/expenses'
import { bucketMeta, ensureBucketSettings, indexSettings } from '../lib/buckets'
import { suggestBillType } from '../lib/classify'
import { useBucketRedirect } from '../hooks/useBucketRedirect'
import { listDayTypes, seedDefaultDayTypesIfEmpty } from '../lib/dayTypes'
import MiniBudgetBar, { resolveCap } from '../components/MiniBudgetBar'
import BucketPicker from '../components/BucketPicker'
import BucketRedirectChips from '../components/BucketRedirectChips'
import Reveal from '../components/Reveal'
import LogTodayModal from '../components/LogTodayModal'
import DayTypesModal from '../components/DayTypesModal'

const meta = bucketMeta('daily')

// Daily items are normally small (transport, snacks, a meal out) — an entry
// above this reads more like a one-off, so the composer nudges toward Bills
// instead of silently letting it inflate the daily habit.
const LARGE_DAILY_AMOUNT = 400

/* ── helpers ─────────────────────────────────────────── */
const fmt = (n) => `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt0 = (n) => `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

function expenseHour(e) { return e.created_at ? new Date(e.created_at).getHours() : 12 }
function expenseTime(e) {
  if (!e.created_at) return ''
  return new Date(e.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const PRESETS = [
  { label: 'Breakfast', emoji: '🍳', category: 'Food' },
  { label: 'Lunch', emoji: '🍱', category: 'Food' },
  { label: 'Dinner', emoji: '🍛', category: 'Food' },
  { label: 'Snack', emoji: '🍫', category: 'Food' },
  { label: 'Tea / Coffee', emoji: '☕', category: 'Food' },
  { label: 'Cigarette', emoji: '🚬', category: 'Other' },
  { label: 'Transport', emoji: '🚌', category: 'Transport' },
  { label: 'Gym', emoji: '💪', category: 'Gym' },
]

const PARTS = [
  { key: 'morning', label: 'Morning', emoji: '🌅' },
  { key: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { key: 'evening', label: 'Evening', emoji: '🌆' },
  { key: 'night', label: 'Night', emoji: '🌙' },
]
function partOfDay(h) {
  if (h >= 5 && h <= 11) return 'morning'
  if (h >= 12 && h <= 16) return 'afternoon'
  if (h >= 17 && h <= 20) return 'evening'
  return 'night'
}

const inputStyle = { backgroundColor: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }
const editBtnStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'var(--surface-2)', border: '1.5px solid var(--border-soft)',
  color: 'var(--n500)', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

/* ── page ────────────────────────────────────────────── */
export default function DailySpend() {
  const { user } = useAuth()
  const { toast } = useToast()
  const month = monthKey()
  const [expenses, setExpenses] = useState([])
  const [dailyLogs, setDailyLogs] = useState([])
  const [dayTypes, setDayTypes] = useState([])
  const [setting, setSetting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pendingDeletes = useRef(new Map())

  const todayKey = dayKey(new Date())
  const [selectedDay, setSelectedDay] = useState(todayKey)

  // composer
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [place, setPlace] = useState('')
  const [showCats, setShowCats] = useState(false)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef(null)
  const { target: composerBucket, saveTarget, setTarget: setComposerBucket, reset: resetComposerBucket } = useBucketRedirect(title, 'daily')

  // edit modal (regular expenses)
  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editCategory, setEditCategory] = useState('Food')
  const [editBucket, setEditBucket] = useState('daily')
  const [editShowCats, setEditShowCats] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // day-log flows
  const [logToEdit, setLogToEdit] = useState(null)
  const [newLog, setNewLog] = useState(false)
  const [showDayTypes, setShowDayTypes] = useState(false)

  useEffect(() => { fetchData() /* eslint-disable-next-line */ }, [])

  async function fetchData() {
    setLoading(true)
    const [expRes, logRes, setRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', user.id).eq('bucket', 'daily')
        .order('created_at', { ascending: false }),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      ensureBucketSettings(user.id),
    ])
    if (expRes.error) setError(expRes.error.message)
    setExpenses(expRes.data ?? [])
    setDailyLogs(logRes.data ?? [])
    setSetting(indexSettings(setRes.data ?? [])['daily'] ?? null)
    const { data: dts } = await seedDefaultDayTypesIfEmpty(user.id)
    setDayTypes(dts ?? [])
    setLoading(false)
  }

  async function refreshDayTypes() {
    const { data } = await listDayTypes(user.id)
    setDayTypes(data ?? [])
  }

  function applyPreset(p) {
    setTitle(p.label); setCategory(p.category)
    if (p.category !== 'Food') setPlace('')
    setShowCats(false)
    amountRef.current?.focus()
  }

  async function handleSave(e) {
    e?.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || !title.trim()) return
    setSaving(true); setError('')

    // `saveTarget` from useBucketRedirect is a pure derived value (recomputed
    // fresh every render from `title`), so there's no race between typing
    // fast and submitting fast — it's always current.
    const targetBucket = saveTarget

    let row
    if (targetBucket === 'daily') {
      let finalTitle = title.trim()
      if (category === 'Food' && place) finalTitle += ` (${place})`
      row = {
        user_id: user.id, title: finalTitle, amount: amt,
        category: getCategoryMeta(category).type, category_name: category,
        bucket: 'daily', date: selectedDay,
      }
    } else if (targetBucket === 'groceries') {
      row = {
        user_id: user.id, title: title.trim(), amount: amt,
        category: 'variable', category_name: 'Groceries',
        bucket: 'groceries', date: selectedDay,
      }
    } else {
      row = {
        user_id: user.id, title: title.trim(), amount: amt,
        category: 'oneoff', category_name: suggestBillType(title),
        bucket: 'bills', date: selectedDay,
      }
    }

    const { data, error: err } = await insertExpenses([row])
    if (err) { setError(err.message); setSaving(false); return }
    if (targetBucket === 'daily') {
      setExpenses(prev => [data[0], ...prev])
    } else {
      toast({ icon: bucketMeta(targetBucket).icon, message: `Added to ${bucketMeta(targetBucket).name}` })
    }
    setTitle(''); setAmount(''); setPlace('')
    resetComposerBucket()
    setSaving(false)
  }

  function handleDelete(id) {
    const item = expenses.find(e => e.id === id)
    if (!item) return
    setExpenses(prev => prev.filter(e => e.id !== id))
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id)
      const { error: err } = await supabase.from('expenses').delete().eq('id', id)
      if (err) { setError(err.message); fetchData() }
    }, 4200)
    pendingDeletes.current.set(id, { item, timer })
    toast({
      icon: '🗑️', message: `Deleted "${item.title}"`, actionLabel: 'Undo',
      onAction: () => {
        const pending = pendingDeletes.current.get(id)
        if (!pending) return
        clearTimeout(pending.timer)
        pendingDeletes.current.delete(id)
        setExpenses(prev => [pending.item, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      },
    })
  }

  async function handleDeleteLogItem(log, itemIndex) {
    if (itemIndex === -1) {
      const { error: err } = await supabase.from('daily_logs').delete().eq('id', log.id)
      if (err) setError(err.message)
      else setDailyLogs(prev => prev.filter(l => l.id !== log.id))
    } else {
      const newExps = (log.expenses || []).filter((_, i) => i !== itemIndex)
      const hasRemaining = newExps.some(e => e.label && Number(e.amount) > 0)
      if (!hasRemaining) {
        const { error: err } = await supabase.from('daily_logs').delete().eq('id', log.id)
        if (err) setError(err.message)
        else setDailyLogs(prev => prev.filter(l => l.id !== log.id))
      } else {
        const newTotal = newExps.reduce((s, e) => s + (Number(e.amount) || 0), 0)
        const { error: err } = await supabase.from('daily_logs')
          .update({ expenses: newExps, total_spent: newTotal }).eq('id', log.id)
        if (err) setError(err.message)
        else setDailyLogs(prev => prev.map(l => l.id === log.id ? { ...l, expenses: newExps, total_spent: newTotal } : l))
      }
    }
  }

  function openEdit(exp) {
    setEditing({ id: exp.id })
    setEditTitle(exp.title || '')
    setEditAmount(String(exp.amount))
    setEditDate(expenseDay(exp) || todayKey)
    setEditCategory(exp.category_name || 'Food')
    setEditBucket(exp.bucket || 'daily')
    setEditShowCats(false)
  }

  async function handleSaveEdit() {
    if (!editing || savingEdit) return
    const newAmt = parseFloat(editAmount)
    if (!(newAmt > 0)) return
    setSavingEdit(true)
    const cat = getCategoryMeta(editCategory)
    const { data, error: err } = await supabase.from('expenses')
      .update({ title: editTitle.trim() || cat.label, amount: newAmt, date: editDate, category: cat.type, category_name: editCategory, bucket: editBucket })
      .eq('id', editing.id).select().single()
    if (err) setError(err.message)
    // Moving an entry out of Daily drops it from the day-by-day log.
    else if (data) setExpenses(prev => editBucket === 'daily'
      ? prev.map(e => e.id === editing.id ? data : e)
      : prev.filter(e => e.id !== editing.id))
    setSavingEdit(false)
    setEditing(null)
  }

  /* derived */
  const daysWithExpense = useMemo(() => {
    const s = new Set(expenses.map(expenseDay).filter(Boolean))
    dailyLogs.forEach(l => l.date && s.add(l.date))
    return s
  }, [expenses, dailyLogs])

  const stripDays = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0)
    let start = addDays(base, -13); let end = addDays(base, 7)
    const selDate = parseKey(selectedDay)
    if (selDate < start) start = selDate
    if (selDate > end) end = selDate
    const days = []
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push({ key: dayKey(d), date: new Date(d) })
    return days
  }, [selectedDay])

  const dayExpenses = useMemo(() =>
    expenses.filter(e => expenseDay(e) === selectedDay).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [expenses, selectedDay])
  const dayLogs = useMemo(() => dailyLogs.filter(l => l.date === selectedDay), [dailyLogs, selectedDay])

  const dayTotal = useMemo(() => {
    const e = dayExpenses.reduce((s, x) => s + Number(x.amount), 0)
    const l = dayLogs.reduce((s, x) => s + (Number(x.total_spent) || 0), 0)
    return e + l
  }, [dayExpenses, dayLogs])

  const dayByCat = useMemo(() => {
    const m = {}
    dayExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + Number(e.amount) })
    dayLogs.forEach(l => { if (Number(l.total_spent) > 0) m['variable'] = (m['variable'] || 0) + Number(l.total_spent) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [dayExpenses, dayLogs])

  const grouped = PARTS
    .map(p => ({ ...p, items: dayExpenses.filter(e => partOfDay(expenseHour(e)) === p.key) }))
    .filter(g => g.items.length)

  const monthUsed = useMemo(() => {
    const e = expenses.filter(x => (expenseDay(x) || '').startsWith(month)).reduce((s, x) => s + Number(x.amount), 0)
    const l = dailyLogs.filter(x => (x.date || '').startsWith(month)).reduce((s, x) => s + (Number(x.total_spent) || 0), 0)
    return e + l
  }, [expenses, dailyLogs, month])

  const todayUsed = useMemo(() => {
    const e = expenses.filter(x => expenseDay(x) === todayKey).reduce((s, x) => s + Number(x.amount), 0)
    const l = dailyLogs.filter(x => x.date === todayKey).reduce((s, x) => s + (Number(x.total_spent) || 0), 0)
    return e + l
  }, [expenses, dailyLogs, todayKey])

  const sel = parseKey(selectedDay)
  const isToday = selectedDay === todayKey
  const isFuture = selectedDay > todayKey
  const dayWeekday = sel.toLocaleDateString(undefined, { weekday: 'long' })
  const dayRest = sel.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

  const stripRef = useRef(null)
  const selRef = useRef(null)
  useEffect(() => {
    const c = stripRef.current, el = selRef.current
    if (c && el) c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2
  }, [loading, selectedDay])

  const canSave = !!amount && parseFloat(amount) > 0 && !!title.trim()
  const isLargeAmount = saveTarget === 'daily' && parseFloat(amount) > LARGE_DAILY_AMOUNT
  const hasAnything = dayExpenses.length > 0 || dayLogs.length > 0

  const miniBudget = setting?.mini_budget != null ? Number(setting.mini_budget) : null
  const capPeriod = setting?.cap_period ?? 'monthly'
  const { cap, label: capLabel } = resolveCap({ miniBudget, capPeriod }, daysInMonth(month))
  const color = setting?.color ?? meta.color
  const dailyCapNote = capPeriod === 'daily' && miniBudget != null
    ? `Today ${fmt0(todayUsed)} of ${fmt0(miniBudget)}` : capLabel

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up">
      <div>
        {/* Header */}
        <div className="flex items-end justify-between mb-5 gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}22`, fontSize: 21 }}>{setting?.icon ?? meta.icon}</span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
                Daily <span className="serif-accent">spend</span>
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--n350)' }}>{meta.tagline}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>This month</p>
            <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
              {loading ? '…' : fmt0(monthUsed)}
            </p>
          </div>
        </div>

        {/* Daily Spend cap — read-only. The deep dive owns this number now:
            it writes bucket_settings.mini_budget when a month is fully
            allocated, so a second editor here would silently fight it. */}
        <Reveal>
          <div className="card p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>Daily Spend cap</span>
              <Link to="/budget-settings/daily-deep-dive"
                className="btn-soft text-xs px-3 py-1.5 rounded-full font-semibold" style={{ textDecoration: 'none' }}>
                {miniBudget != null ? 'Deep dive ›' : 'Set it up ›'}
              </Link>
            </div>
            <MiniBudgetBar used={monthUsed} cap={cap} color={color}
              note={miniBudget != null ? dailyCapNote : 'Set from the deep dive'} />
          </div>
        </Reveal>

        {/* Log a day / manage */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setNewLog(true)}
            className="btn-ink flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <span style={{ fontSize: 15 }}>＋</span> Log a day
          </button>
          <button onClick={() => setShowDayTypes(true)} className="btn-soft px-4 py-2.5 rounded-xl text-sm font-semibold">Day types</button>
        </div>

        {/* Day strip */}
        <Reveal delay={20}>
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3 px-1 gap-2">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
                {sel.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input type="date" value={selectedDay} onChange={e => e.target.value && setSelectedDay(e.target.value)}
                  aria-label="Pick any date" className="text-xs font-semibold rounded-full px-2.5 py-1 cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n600)' }} />
                {!isToday && (
                  <button onClick={() => setSelectedDay(todayKey)} className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--accent)' }}>Today →</button>
                )}
              </div>
            </div>
            <div ref={stripRef} className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {stripDays.map(({ key, date }) => {
                const active = key === selectedDay
                const today = key === todayKey
                const future = key > todayKey
                const has = daysWithExpense.has(key)
                return (
                  <button key={key} ref={active ? selRef : null} onClick={() => setSelectedDay(key)}
                    className="day-pill flex flex-col items-center justify-center flex-shrink-0 rounded-2xl"
                    style={{
                      width: 52, height: 64,
                      background: active ? 'var(--ink)' : 'var(--surface-2)',
                      border: today && !active ? '1.5px solid var(--accent)' : future && !active ? '1.5px dashed var(--border-3)' : '1.5px solid transparent',
                      color: active ? 'var(--on-ink)' : 'var(--n500)',
                      opacity: future && !active ? 0.72 : 1,
                    }}>
                    <span className="text-[10px] font-semibold uppercase" style={{ opacity: active ? 0.7 : 1, letterSpacing: '0.04em' }}>
                      {date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}
                    </span>
                    <span className="text-lg font-extrabold tabular-nums leading-tight" style={{ color: active ? 'var(--on-ink)' : 'var(--n900)' }}>
                      {date.getDate()}
                    </span>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', marginTop: 2, background: has ? (active ? 'var(--on-ink)' : 'var(--accent)') : 'transparent' }} />
                  </button>
                )
              })}
            </div>
          </div>
        </Reveal>

        {/* Composer */}
        <Reveal delay={70}>
          <div className="card mb-4">
            <form onSubmit={handleSave} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>New expense</span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: isFuture ? 'rgba(124,58,237,0.12)' : 'var(--surface-2)', color: isFuture ? 'var(--accent)' : 'var(--n500)' }}>
                  {isToday ? 'Today' : dayWeekday} · {sel.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{isFuture ? ' · upcoming' : ''}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center flex-1 rounded-2xl px-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                  <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                  <input ref={amountRef} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                    className="w-full py-3 text-3xl font-extrabold tabular-nums"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)', letterSpacing: '-0.02em' }} />
                </div>
                <button type="submit" disabled={!canSave || saving} className="btn-ink rounded-2xl font-semibold flex-shrink-0"
                  style={{ padding: '0 24px', height: 58, fontSize: 15, opacity: !canSave || saving ? 0.45 : 1 }}>
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>

              {isLargeAmount && (
                <div className="flex items-center justify-between gap-2 mb-4 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
                  <span className="text-xs" style={{ color: 'var(--warn)' }}>
                    ⚠ That's a large amount for Daily Spend — consider logging it as a one-off in Bills instead.
                  </span>
                  <Link to="/bills" className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--warn)' }}>
                    Go to Bills →
                  </Link>
                </div>
              )}

              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What was it?"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-4" style={inputStyle} />

              <BucketRedirectChips text={title} target={composerBucket} setTarget={setComposerBucket} homeBucket="daily" />

              {saveTarget === 'daily' && (
                <>
                  <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Quick add</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {PRESETS.map(p => {
                      const active = title === p.label && category === p.category
                      return (
                        <button key={p.label} type="button" onClick={() => applyPreset(p)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                          style={{ background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--on-ink)' : 'var(--n700)', border: '1.5px solid ' + (active ? 'var(--ink)' : 'var(--border-soft)') }}>
                          <span style={{ fontSize: 15 }}>{p.emoji}</span>{p.label}
                        </button>
                      )
                    })}
                  </div>

                  {category === 'Food' && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-medium" style={{ color: 'var(--n400)' }}>Where?</span>
                      {[{ v: 'home', label: 'Home', emoji: '🏠' }, { v: 'out', label: 'Outside', emoji: '🛵' }].map(o => {
                        const on = place === o.v
                        return (
                          <button key={o.v} type="button" onClick={() => setPlace(on ? '' : o.v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                            style={{ background: on ? 'rgba(34,197,94,0.14)' : 'var(--surface-2)', color: on ? '#16a34a' : 'var(--n500)', border: '1.5px solid ' + (on ? 'rgba(34,197,94,0.4)' : 'var(--border-soft)') }}>
                            <span>{o.emoji}</span>{o.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--n400)' }}>Category</span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: `${getCategoryMeta(category).color}1f`, color: getCategoryMeta(category).color }}>
                        {getCategoryMeta(category).emoji} {getCategoryMeta(category).label}
                      </span>
                    </div>
                    <button type="button" onClick={() => setShowCats(v => !v)} className="text-xs font-semibold" style={{ color: 'var(--n500)' }}>
                      {showCats ? 'Done' : 'Change ⌄'}
                    </button>
                  </div>

                  {showCats && (
                    <div className="mt-3 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.filter(c => c.type === 'variable').map(c => {
                          const on = category === c.name
                          return (
                            <button key={c.name} type="button" onClick={() => { setCategory(c.name); if (c.name !== 'Food') setPlace('') }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                              style={{ border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border)'), background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--on-ink)' : 'var(--n550)' }}>
                              <span style={{ fontSize: 13 }}>{c.emoji}</span>{c.name}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[11px] mt-3" style={{ color: 'var(--n350)' }}>
                        Bills, rent and one-offs each have their own bucket — this composer is daily spend only.
                      </p>
                    </div>
                  )}
                </>
              )}
            </form>
          </div>
        </Reveal>

        {error && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>{error}</div>
        )}

        {/* Day summary */}
        <Reveal delay={140}>
          <div className="flex items-end justify-between mb-3 px-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--n900)' }}>{isToday ? 'Today' : dayWeekday}</h2>
              <span className="text-sm" style={{ color: 'var(--n350)' }}>{dayRest}</span>
            </div>
            <span className="text-lg font-extrabold tabular-nums" style={{ color: dayTotal > 0 ? 'var(--n900)' : 'var(--n300)' }}>{fmt(dayTotal)}</span>
          </div>

          {dayTotal > 0 && (
            <div className="mb-5 px-1">
              <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                {dayByCat.map(([cat, amt]) => {
                  const cm = getCategoryMeta(cat)
                  return <div key={cat} style={{ width: `${(amt / dayTotal) * 100}%`, background: cm.color }} title={`${cm.label} ${fmt(amt)}`} />
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                {dayByCat.map(([cat, amt]) => {
                  const cm = getCategoryMeta(cat)
                  return (
                    <span key={cat} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--n500)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cm.color }} />
                      {cm.label}<span className="font-semibold tabular-nums" style={{ color: 'var(--n700)' }}>{fmt0(amt)}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="card flex justify-center py-16">
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
            </div>
          ) : !hasAnything ? (
            <div className="card py-16 text-center">
              <p className="text-4xl mb-3">{isFuture ? '📅' : '🗓️'}</p>
              <p className="text-sm" style={{ color: 'var(--n350)' }}>{isFuture ? 'Nothing planned for this day yet.' : `Nothing logged for ${isToday ? 'today' : 'this day'} yet.`}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>{isFuture ? 'Add an upcoming expense above ↑' : 'Add your first expense above ↑'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {grouped.map(group => {
                const subtotal = group.items.reduce((s, e) => s + Number(e.amount), 0)
                return (
                  <div key={group.key}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
                        <span style={{ fontSize: 13 }}>{group.emoji}</span>{group.label}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--n400)' }}>{fmt0(subtotal)}</span>
                    </div>
                    <div className="card overflow-hidden">
                      <ul>
                        {group.items.map((exp, i) => {
                          const cm = getCategoryMeta(exp.category_name || exp.category)
                          return (
                            <li key={exp.id} className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5"
                              style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg" style={{ backgroundColor: `${cm.color}1a` }}>{cm.emoji}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{exp.title}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs font-medium" style={{ color: cm.color }}>{cm.label}</span>
                                  <span className="text-xs tabular-nums" style={{ color: 'var(--n250)' }}>· {expenseTime(exp)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>−{fmt(exp.amount)}</span>
                                <button onClick={() => openEdit(exp)} title="Edit" style={editBtnStyle}>✎</button>
                                <button onClick={() => handleDelete(exp.id)} className="btn-delete" title="Delete">×</button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )
              })}

              {dayLogs.map(log => {
                const dt = dayTypes.find(d => d.id === log.day_type_id)
                const items = (log.expenses || [])
                  .map((item, rawIdx) => ({ ...item, rawIdx }))
                  .filter(item => item.label && Number(item.amount) > 0 && !/descr|note/i.test(item.label || ''))
                return (
                  <div key={log.id}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: dt?.color || 'var(--accent)', letterSpacing: '0.06em' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dt?.color || 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                        {dt?.name || 'Day Log'}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--n400)' }}>{fmt0(log.total_spent)}</span>
                    </div>
                    <div className="card overflow-hidden">
                      <ul>
                        {items.length > 0 ? items.map((item, i) => (
                          <li key={item.rawIdx} className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5"
                            style={{ borderBottom: i < items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${dt?.color || '#6366f1'}1a` }}>
                              <span style={{ fontSize: 16 }}>📋</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{item.label}</p>
                              <span className="text-xs font-medium" style={{ color: dt?.color || 'var(--n400)' }}>{dt?.name || 'Day log'}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>−{fmt(item.amount)}</span>
                              <button onClick={() => setLogToEdit(log)} title="Edit" style={editBtnStyle}>✎</button>
                              <button onClick={() => handleDeleteLogItem(log, item.rawIdx)} className="btn-delete" title="Delete">×</button>
                            </div>
                          </li>
                        )) : (
                          <li className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5">
                            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${dt?.color || '#6366f1'}1a` }}>
                              <span style={{ fontSize: 16 }}>📋</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: 'var(--n800)' }}>{dt?.name || 'Day log'}</p>
                              <span className="text-xs" style={{ color: 'var(--n400)' }}>Total spend for the day</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>−{fmt(log.total_spent)}</span>
                              <button onClick={() => setLogToEdit(log)} title="Edit" style={editBtnStyle}>✎</button>
                              <button onClick={() => handleDeleteLogItem(log, -1)} className="btn-delete" title="Delete">×</button>
                            </div>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Reveal>
      </div>

      {/* New day log */}
      {newLog && (
        <LogTodayModal userId={user.id} dayTypes={dayTypes} initialType={null}
          onClose={() => setNewLog(false)} onSaved={() => { setNewLog(false); fetchData() }} />
      )}

      {/* Day log edit */}
      {logToEdit && (
        <LogTodayModal userId={user.id} dayTypes={dayTypes}
          initialType={dayTypes.find(d => d.id === logToEdit.day_type_id) ?? null}
          initialLog={logToEdit} onClose={() => setLogToEdit(null)}
          onSaved={() => { setLogToEdit(null); fetchData() }} />
      )}

      {/* Manage day types */}
      {showDayTypes && (
        <DayTypesModal userId={user.id} dayTypes={dayTypes}
          onClose={() => setShowDayTypes(false)} onChanged={refreshDayTypes} />
      )}

      {/* Edit expense modal */}
      {editing && (
        <div className="modal-scrim" onClick={() => !savingEdit && setEditing(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--n900)', letterSpacing: '-0.02em' }}>Edit expense</h2>
                <button onClick={() => setEditing(null)} style={{ ...editBtnStyle, width: 36, height: 36, fontSize: 14 }}>✕</button>
              </div>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Description"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-3" style={inputStyle} autoFocus />
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Date</span>
                <input type="date" value={editDate} onChange={e => e.target.value && setEditDate(e.target.value)}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
              </div>
              <div className="flex items-center rounded-2xl px-4 mb-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                <input type="number" min="0.01" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="0"
                  className="w-full py-3 text-3xl font-extrabold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)', letterSpacing: '-0.02em' }} />
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--n400)' }}>Category</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${getCategoryMeta(editCategory).color}1f`, color: getCategoryMeta(editCategory).color }}>
                      {getCategoryMeta(editCategory).emoji} {getCategoryMeta(editCategory).label}
                    </span>
                  </div>
                  <button type="button" onClick={() => setEditShowCats(v => !v)} className="text-xs font-semibold" style={{ color: 'var(--n500)' }}>
                    {editShowCats ? 'Done' : 'Change ⌄'}
                  </button>
                </div>
                {editShowCats && (
                  <div className="mt-3 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
                    {[{ key: 'variable', label: 'Everyday' }, { key: 'fixed', label: 'Fixed' }, { key: 'oneoff', label: 'One-off' }].map(({ key, label }) => (
                      <div key={key} className="mb-3 last:mb-0">
                        <p className="text-[11px] font-medium mb-1.5" style={{ color: CATEGORY_TYPES[key].color }}>{label}</p>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.filter(c => c.type === key).map(c => {
                            const on = editCategory === c.name
                            return (
                              <button key={c.name} type="button" onClick={() => setEditCategory(c.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                                style={{ border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border)'), background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--on-ink)' : 'var(--n550)' }}>
                                <span style={{ fontSize: 13 }}>{c.emoji}</span>{c.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mb-4">
                <BucketPicker value={editBucket} onChange={setEditBucket} />
              </div>
              <button onClick={handleSaveEdit} disabled={savingEdit || !(parseFloat(editAmount) > 0)}
                className="btn-ink w-full font-semibold rounded-xl" style={{ padding: '12px', fontSize: 15, opacity: savingEdit || !(parseFloat(editAmount) > 0) ? 0.45 : 1 }}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
