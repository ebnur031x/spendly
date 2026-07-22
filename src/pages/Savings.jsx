import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { listSavings, createSaving, updateSaving, deleteSaving } from '../lib/savings'

const fmt = (n) =>
  `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}

export default function Savings() {
  const { user } = useAuth()
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

  async function handleDelete(id) {
    setItems(prev => prev.filter(i => i.id !== id))
    const { error: err } = await deleteSaving(id)
    if (err) { setError(err.message); fetchItems() }
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)
  const canAdd = !!label.trim() && !!amount && parseFloat(amount) >= 0

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
          <p className="text-4xl mb-3">🐷</p>
          <p className="text-sm" style={{ color: 'var(--n350)' }}>No savings tracked yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>Add your first entry above ↑</p>
        </div>
      ) : (
        <>
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
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg"
                        style={{ backgroundColor: 'var(--surface-2)' }}>
                        🐷
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
                        <button onClick={() => handleDelete(item.id)} className="btn-delete" title="Delete">×</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Total footer */}
          <div className="card px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--n500)' }}>Total savings</span>
            <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
              {fmt(total)}
            </span>
          </div>
        </>
      )}
    </main>
  )
}
