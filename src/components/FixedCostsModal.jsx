import { useState } from 'react'
import { money0 } from '../lib/format'
import { FIXED_COLORS, createFixedCost, deleteFixedCost } from '../lib/fixedCosts'
import ColorSwatches from './ColorSwatches'

// Add / remove fixed monthly costs (name, amount, color). Edits happen live
// against Supabase; onChanged() lets the dashboard re-pull its totals.
export default function FixedCostsModal({ userId, fixedCosts, onClose, onChanged }) {
  const [items, setItems] = useState(fixedCosts)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [color, setColor] = useState(() => nextColor(fixedCosts))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = items.reduce((s, fc) => s + (Number(fc.amount) || 0), 0)
  const canAdd = name.trim() && parseFloat(amount) > 0

  async function add() {
    if (!canAdd || saving) return
    setSaving(true); setError('')
    const { data, error } = await createFixedCost(userId, {
      name: name.trim(), amount: parseFloat(amount), color,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    const next = [...items, data]
    setItems(next)
    setName(''); setAmount(''); setColor(nextColor(next))
    onChanged?.()
  }

  async function remove(id) {
    const prev = items
    setItems(items.filter(fc => fc.id !== id))
    const { error } = await deleteFixedCost(id)
    if (error) { setError(error.message); setItems(prev); return }
    onChanged?.()
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Fixed costs</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n350)' }}>Rent, subscriptions, tuition, and other monthly commitments</p>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-2)', color: 'var(--n400)', border: '1px solid var(--border-2)' }}>✕</button>
          </div>

          {/* existing */}
          {items.length > 0 && (
            <ul className="flex flex-col gap-2 mb-5">
              {items.map(fc => (
                <li key={fc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: fc.color, flexShrink: 0 }} />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--n800)' }}>{fc.name}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>{money0(fc.amount)}</span>
                  <button onClick={() => remove(fc.id)} aria-label={`Remove ${fc.name}`}
                    className="btn-delete" title="Remove">×</button>
                </li>
              ))}
              <li className="flex items-center justify-between px-3 pt-2">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n350)', letterSpacing: '0.06em' }}>Total</span>
                <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--n900)' }}>{money0(total)}</span>
              </li>
            </ul>
          )}

          {/* add new */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Add a fixed cost</p>
            <div className="flex gap-2 mb-3">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name (e.g. Rent)"
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
              />
              <div className="flex items-center rounded-xl px-3" style={{ width: 120, background: 'var(--surface)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
                <input
                  type="number" min="0" step="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && add()}
                  placeholder="0"
                  className="w-full text-sm font-semibold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                />
              </div>
            </div>
            <ColorSwatches colors={FIXED_COLORS} value={color} onChange={setColor} className="mb-3" />
            <button onClick={add} disabled={!canAdd || saving}
              className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold">
              {saving ? 'Adding…' : 'Add fixed cost'}
            </button>
          </div>

          {error && <p className="text-xs mt-3" style={{ color: 'var(--err-txt)' }}>{error}</p>}

          <button onClick={onClose} className="btn-soft w-full py-2.5 rounded-xl text-sm font-semibold mt-4">Done</button>
        </div>
      </div>
    </div>
  )
}

// First palette color not already in use, so new costs look distinct.
function nextColor(items) {
  const used = new Set(items.map(fc => fc.color))
  return FIXED_COLORS.find(c => !used.has(c)) ?? FIXED_COLORS[items.length % FIXED_COLORS.length]
}
