import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { listSavings, createSaving, updateSaving, deleteSaving } from '../lib/savings'

const fmt = (n) =>
  `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}

// Replaces the old 🐷 emoji with a proper line icon.
function PiggyIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 8.5V7l-2 1.1A6.8 6.8 0 0 0 12 6.2 6.8 6.8 0 0 0 5.3 13v.4L3 14.7l1.8.9v1.6A2.3 2.3 0 0 0 7.1 19.5h.6v-1.8h3.6v1.8h1a2 2 0 0 0 2-2v-1a6.7 6.7 0 0 0 2-2.8h1.2l.9-2.7h-2Z" />
      <circle cx="15.6" cy="10.4" r=".5" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Cumulative running total over time, oldest → newest, starting from ৳0 —
// a real growth curve built from each entry's created_at, not fabricated
// sample data. Always at least 2 points (a leading 0) so a single entry
// still draws a line instead of a dot.
function buildSavingsSpark(items) {
  const sorted = [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let running = 0
  const values = [0, ...sorted.map(i => { running += Number(i.amount); return running })]
  const w = 130, h = 46
  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? w / (values.length - 1) : 0
  const pts = values.map((v, i) => ({ x: i * stepX, y: h - (v / max) * (h - 6) - 2 }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1].x},${h} L 0,${h} Z`
  return { line, area, w, h, end: pts[pts.length - 1] }
}

export default function Savings() {
  const { user } = useAuth()
  const { deleteWithUndo } = useUndoableDelete()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // composer
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const amountRef = useRef(null)

  // edit
  const [editing, setEditing] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data, error: err } = await listSavings(user.id)
    if (err) setError(err.message)
    else setItems(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e?.preventDefault()
    const amt = parseFloat(amount)
    if (!label.trim() || isNaN(amt) || amt < 0) return
    setSaving(true); setError('')
    const { data, error: err } = await createSaving(user.id, {
      label: label.trim(),
      amount: amt,
      notes: notes.trim(),
    })
    if (err) setError(err.message)
    else {
      setItems(prev => [...prev, data])
      setLabel(''); setAmount(''); setNotes('')
    }
    setSaving(false)
  }

  function openEdit(item) {
    setEditing(item.id)
    setEditLabel(item.label)
    setEditAmount(String(item.amount))
    setEditNotes(item.notes ?? '')
  }

  async function handleSaveEdit() {
    if (!editing || savingEdit) return
    const amt = parseFloat(editAmount)
    if (!editLabel.trim() || isNaN(amt) || amt < 0) return
    setSavingEdit(true)
    const { data, error: err } = await updateSaving(editing, {
      label: editLabel.trim(),
      amount: amt,
      notes: editNotes.trim(),
    })
    if (err) setError(err.message)
    else if (data) setItems(prev => prev.map(i => i.id === editing ? data : i))
    setSavingEdit(false)
    setEditing(null)
  }

  function handleDelete(item) {
    const snapshot = items
    deleteWithUndo({
      message: `Deleted "${item.label}"`,
      remove: () => setItems(prev => prev.filter(i => i.id !== item.id)),
      commit: async () => {
        const { error: err } = await deleteSaving(item.id)
        if (err) { setError(err.message); fetchItems() }
      },
      restore: () => setItems(snapshot),
    })
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)
  const canAdd = !!label.trim() && !!amount && parseFloat(amount) >= 0

  const now = new Date()
  const thisMonthDelta = items.reduce((s, i) => {
    const d = new Date(i.created_at)
    const inThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    return inThisMonth ? s + Number(i.amount) : s
  }, 0)
  const spark = items.length > 0 ? buildSavingsSpark(items) : null

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.04em' }}>
            Savings <span className="serif-accent">stash</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--n350)' }}>
            Track where your savings come from
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>Total saved</p>
          <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
            {loading ? '…' : fmt(total)}
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="card mb-5">
        <form onSubmit={handleAdd} className="p-6">
          <p className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>New savings entry</p>

          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Source (e.g. Monthly savings, Phone sale…)"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-3"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && amountRef.current?.focus()}
          />

          <div className="flex gap-3 mb-3">
            <div className="flex items-center flex-1 rounded-2xl px-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
              <span className="text-xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
              <input
                ref={amountRef}
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full py-2.5 text-2xl font-extrabold tabular-nums"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)', letterSpacing: '-0.02em' }}
              />
            </div>
            <button
              type="submit"
              disabled={!canAdd || saving}
              className="btn-ink rounded-2xl font-semibold flex-shrink-0"
              style={{ padding: '0 22px', fontSize: 15, opacity: !canAdd || saving ? 0.45 : 1 }}
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>

          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
            style={inputStyle}
          />
        </form>
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="card flex justify-center py-16">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="glyph-teal" style={{ margin: '0 auto 14px' }}>
            <PiggyIcon />
          </div>
          <p className="text-sm" style={{ color: 'var(--n350)' }}>No savings tracked yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>Add your first entry above ↑</p>
        </div>
      ) : (
        <>
          {/* Total, with a real cumulative-growth sparkline built from
              each entry's own date — not sample data. */}
          <div className="card px-5 py-4 mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>Total savings</p>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                {fmt(total)}
              </p>
              {thisMonthDelta > 0 && (
                <p className="text-xs font-semibold mt-1" style={{ color: 'var(--success)' }}>
                  ↑ {fmt(thisMonthDelta)} this month
                </p>
              )}
            </div>
            {spark && (
              <svg width={spark.w} height={spark.h} viewBox={`0 0 ${spark.w} ${spark.h}`} style={{ flexShrink: 0 }}>
                <defs>
                  <linearGradient id="savings-spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0891b2" stopOpacity=".38" />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={spark.area} fill="url(#savings-spark-fill)" />
                <path d={spark.line} fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={spark.end.x} cy={spark.end.y} r="3.5" fill="var(--surface)" stroke="#0891b2" strokeWidth="2" />
              </svg>
            )}
          </div>

          <div className="card overflow-hidden mb-4">
            <ul>
              {items.map((item, i) => (
                <li key={item.id}
                  style={{ borderBottom: i < items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>

                  {editing === item.id ? (
                    /* inline edit */
                    <div className="px-4 sm:px-5 py-4 flex flex-col gap-2.5">
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        placeholder="Source name"
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm"
                        style={inputStyle}
                        autoFocus
                      />
                      <div className="flex items-center rounded-xl px-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                        <span className="text-lg font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                        <input
                          type="number" min="0" step="1"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          placeholder="0"
                          className="w-full py-2.5 text-xl font-extrabold tabular-nums"
                          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                        />
                      </div>
                      <input
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="Note (optional)"
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm"
                        style={inputStyle}
                      />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveEdit} disabled={savingEdit}
                          className="btn-ink flex-1 py-2.5 rounded-xl text-sm font-semibold">
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(null)}
                          className="btn-soft flex-1 py-2.5 rounded-xl text-sm font-semibold">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* normal row */
                    <div className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5">
                      <div className="glyph-teal">
                        <PiggyIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--n900)' }}>{item.label}</p>
                        {item.notes && (
                          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--n350)' }}>{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--n900)' }}>{fmt(item.amount)}</span>
                        <button onClick={() => openEdit(item)} title="Edit"
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'var(--surface-2)', border: '1.5px solid var(--border-soft)',
                            color: 'var(--n500)', fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>✎</button>
                        <button onClick={() => handleDelete(item)} className="btn-delete" title="Delete">×</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  )
}
