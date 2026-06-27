import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES, CATEGORY_TYPES, getCategoryMeta } from '../lib/categories'

/* ── helpers ─────────────────────────────────────────── */

const fmt = (n) =>
  `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt0 = (n) =>
  `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
// the day an expense belongs to: explicit date, else the day it was logged
function expenseDay(e) {
  if (e.date) return e.date
  if (e.created_at) return dayKey(new Date(e.created_at))
  return null
}
function expenseHour(e) {
  return e.created_at ? new Date(e.created_at).getHours() : 12
}
function expenseTime(e) {
  if (!e.created_at) return ''
  return new Date(e.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// daily quick-add presets — only the things a student logs every day
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

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}

/* ── page ────────────────────────────────────────────── */

export default function Expenses() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const todayKey = dayKey(new Date())
  const [selectedDay, setSelectedDay] = useState(todayKey)

  // composer
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [place, setPlace] = useState('') // home | out (food only)
  const [showCats, setShowCats] = useState(false)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef(null)

  useEffect(() => { fetchExpenses() }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setExpenses(data ?? [])
    setLoading(false)
  }

  function applyPreset(p) {
    setTitle(p.label)
    setCategory(p.category)
    if (p.category !== 'Food') setPlace('')
    setShowCats(false)
    amountRef.current?.focus()
  }

  async function handleSave(e) {
    e?.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return
    setSaving(true)
    setError('')

    let finalTitle = title.trim() || getCategoryMeta(category).label
    if (category === 'Food' && place) finalTitle += ` (${place})`

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        title: finalTitle,
        amount: amt,
        category: getCategoryMeta(category).type, // DB constraint: must be fixed|variable|oneoff
        date: selectedDay,
      })
      .select()
      .single()

    if (error) setError(error.message)
    else {
      setExpenses(prev => [data, ...prev])
      setTitle(''); setAmount(''); setPlace('')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { setError(error.message); fetchExpenses() }
  }

  /* derived */
  const daysWithExpense = useMemo(
    () => new Set(expenses.map(expenseDay).filter(Boolean)),
    [expenses],
  )

  const stripDays = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0)
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() - (13 - i))
      return { key: dayKey(d), date: d }
    })
  }, [])

  const dayExpenses = useMemo(
    () => expenses
      .filter(e => expenseDay(e) === selectedDay)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [expenses, selectedDay],
  )
  const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const dayByCat = useMemo(() => {
    const m = {}
    dayExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + Number(e.amount) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [dayExpenses])

  const grouped = PARTS
    .map(p => ({ ...p, items: dayExpenses.filter(e => partOfDay(expenseHour(e)) === p.key) }))
    .filter(g => g.items.length)

  const monthTotal = useMemo(() => {
    const mk = todayKey.slice(0, 7)
    return expenses
      .filter(e => (expenseDay(e) || '').startsWith(mk))
      .reduce((s, e) => s + Number(e.amount), 0)
  }, [expenses, todayKey])

  const sel = parseKey(selectedDay)
  const isToday = selectedDay === todayKey
  const dayWeekday = sel.toLocaleDateString(undefined, { weekday: 'long' })
  const dayRest = sel.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

  // keep the strip scrolled to today on load
  const stripRef = useRef(null)
  useEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = stripRef.current.scrollWidth
  }, [loading])

  const canSave = !!amount && parseFloat(amount) > 0

  return (
    <main className="min-h-screen px-4 sm:px-8 py-10 max-w-3xl mx-auto fade-up" style={{ position: 'relative' }}>
      {/* soft ambient lift */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 360, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.04em' }}>
              Daily <span className="serif-accent">log</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--n350)' }}>
              Track every taka, part by part
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>This month</p>
            <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
              {loading ? '…' : fmt0(monthTotal)}
            </p>
          </div>
        </div>

        {/* Day strip */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
              {sel.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            {!isToday && (
              <button
                onClick={() => setSelectedDay(todayKey)}
                className="text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                Jump to today →
              </button>
            )}
          </div>
          <div ref={stripRef} className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {stripDays.map(({ key, date }) => {
              const active = key === selectedDay
              const today = key === todayKey
              const has = daysWithExpense.has(key)
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className="day-pill flex flex-col items-center justify-center flex-shrink-0 rounded-2xl"
                  style={{
                    width: 52, height: 64,
                    background: active ? 'var(--ink)' : 'var(--surface-2)',
                    border: today && !active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                    color: active ? 'var(--on-ink)' : 'var(--n500)',
                  }}
                >
                  <span className="text-[10px] font-semibold uppercase" style={{ opacity: active ? 0.7 : 1, letterSpacing: '0.04em' }}>
                    {date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}
                  </span>
                  <span className="text-lg font-extrabold tabular-nums leading-tight" style={{ color: active ? 'var(--on-ink)' : 'var(--n900)' }}>
                    {date.getDate()}
                  </span>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', marginTop: 2,
                    background: has ? (active ? 'var(--on-ink)' : 'var(--accent)') : 'transparent',
                  }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Composer */}
        <div className="card mb-4" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* top accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #7c3aed, #3b82f6, #22c55e)' }} />

          <form onSubmit={handleSave} className="p-6 pt-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
                New expense
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface-2)', color: 'var(--n500)' }}>
                {isToday ? 'Today' : dayWeekday} · {sel.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* amount hero + save */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center flex-1 rounded-2xl px-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                <input
                  ref={amountRef}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full py-3 text-3xl font-extrabold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)', letterSpacing: '-0.02em' }}
                />
              </div>
              <button
                type="submit"
                disabled={!canSave || saving}
                className="btn-ink rounded-2xl font-semibold flex-shrink-0"
                style={{ padding: '0 24px', height: 58, fontSize: 15, opacity: !canSave || saving ? 0.45 : 1 }}
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>

            {/* description */}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What was it? (optional)"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-4"
              style={inputStyle}
            />

            {/* quick presets */}
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Quick add</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map(p => {
                const active = title === p.label && category === p.category
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: active ? 'var(--ink)' : 'var(--surface-2)',
                      color: active ? 'var(--on-ink)' : 'var(--n700)',
                      border: '1.5px solid ' + (active ? 'var(--ink)' : 'var(--border-soft)'),
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{p.emoji}</span>
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* food: home / out */}
            {category === 'Food' && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium" style={{ color: 'var(--n400)' }}>Where?</span>
                {[
                  { v: 'home', label: 'Home', emoji: '🏠' },
                  { v: 'out', label: 'Outside', emoji: '🛵' },
                ].map(o => {
                  const on = place === o.v
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPlace(on ? '' : o.v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: on ? 'rgba(34,197,94,0.14)' : 'var(--surface-2)',
                        color: on ? '#16a34a' : 'var(--n500)',
                        border: '1.5px solid ' + (on ? 'rgba(34,197,94,0.4)' : 'var(--border-soft)'),
                      }}
                    >
                      <span>{o.emoji}</span>{o.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* category — compact, expandable */}
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
                {[
                  { key: 'variable', label: 'Everyday' },
                  { key: 'fixed', label: 'Fixed' },
                  { key: 'oneoff', label: 'One-off' },
                ].map(({ key, label }) => (
                  <div key={key} className="mb-3 last:mb-0">
                    <p className="text-[11px] font-medium mb-1.5" style={{ color: CATEGORY_TYPES[key].color }}>{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.filter(c => c.type === key).map(c => {
                        const on = category === c.name
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => { setCategory(c.name); if (c.name !== 'Food') setPlace('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                            style={{
                              border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--border)'),
                              background: on ? 'var(--ink)' : 'var(--surface)',
                              color: on ? 'var(--on-ink)' : 'var(--n550)',
                            }}
                          >
                            <span style={{ fontSize: 13 }}>{c.emoji}</span>{c.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {error && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
            {error}
          </div>
        )}

        {/* Day summary */}
        <div className="flex items-end justify-between mb-3 px-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--n900)' }}>
              {isToday ? 'Today' : dayWeekday}
            </h2>
            <span className="text-sm" style={{ color: 'var(--n350)' }}>{dayRest}</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-extrabold tabular-nums" style={{ color: dayTotal > 0 ? 'var(--n900)' : 'var(--n300)' }}>
              {fmt(dayTotal)}
            </span>
          </div>
        </div>

        {/* category segment bar for the day */}
        {dayTotal > 0 && (
          <div className="mb-5 px-1">
            <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
              {dayByCat.map(([cat, amt]) => {
                const meta = getCategoryMeta(cat)
                return <div key={cat} style={{ width: `${(amt / dayTotal) * 100}%`, background: meta.color }} title={`${meta.label} ${fmt(amt)}`} />
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
              {dayByCat.map(([cat, amt]) => {
                const meta = getCategoryMeta(cat)
                return (
                  <span key={cat} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--n500)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
                    {meta.label}
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--n700)' }}>{fmt0(amt)}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Day list grouped by part of day */}
        {loading ? (
          <div className="card flex justify-center py-16">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
          </div>
        ) : dayExpenses.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-4xl mb-3">🗓️</p>
            <p className="text-sm" style={{ color: 'var(--n350)' }}>
              Nothing logged for {isToday ? 'today' : 'this day'} yet.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>Add your first expense above ↑</p>
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
                        const meta = getCategoryMeta(exp.category)
                        return (
                          <li
                            key={exp.id}
                            className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5"
                            style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--hairline)' : 'none' }}
                          >
                            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg"
                              style={{ backgroundColor: `${meta.color}1a` }}>
                              {meta.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{exp.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="text-xs tabular-nums" style={{ color: 'var(--n250)' }}>· {expenseTime(exp)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>−{fmt(exp.amount)}</span>
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
          </div>
        )}
      </div>
    </main>
  )
}
