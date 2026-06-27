import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCategoryMeta } from '../lib/categories'

export default function QuickLogModal({ templates, onClose, onSaved }) {
  const { user } = useAuth()
  const [selected, setSelected] = useState(null)
  const [items, setItems] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function pickTemplate(template) {
    setSelected(template)
    setItems(template.items.map(item => ({ ...item, amount: String(item.amount) })))
    setError('')
  }

  function updateAmount(index, value) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, amount: value } : item))
  }

  async function saveAll() {
    const valid = items.filter(item => item.amount && !isNaN(parseFloat(item.amount)) && parseFloat(item.amount) > 0)
    if (valid.length === 0) { setError('Enter an amount for at least one item'); return }
    setSaving(true)
    setError('')
    const rows = valid.map(item => ({
      user_id: user.id,
      title: item.title,
      amount: parseFloat(item.amount),
      category: getCategoryMeta(item.category).type, // DB constraint: must be fixed|variable|oneoff
      date: date || null,
    }))
    const { error: e } = await supabase.from('expenses').insert(rows)
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved()
    onClose()
  }

  const totalAmt = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const fmt = (n) => `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overlay-in"
      style={{ backgroundColor: 'var(--scrim)', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl pop-in"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {!selected ? (
          /* Step 1 — pick a template */
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Log today</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--n350)' }}>Pick a template to log it all at once</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: 'var(--surface-2)', color: 'var(--n400)' }}
              >
                ✕
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">⚡</p>
                <p className="text-sm" style={{ color: 'var(--n350)' }}>
                  No templates yet — create one from the Templates page.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map(t => {
                  const total = t.items.reduce((s, i) => s + Number(i.amount), 0)
                  return (
                    <button
                      key={t.id}
                      onClick={() => pickTemplate(t)}
                      className="text-left rounded-2xl px-4 py-3.5 transition-all"
                      style={{ backgroundColor: 'var(--elevated)', border: '1.5px solid var(--border-soft)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.backgroundColor = 'var(--surface)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.backgroundColor = 'var(--elevated)' }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{ color: 'var(--n900)' }}>{t.name}</p>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n400)' }}>{fmt(total)}</span>
                      </div>
                      <p className="text-xs mt-1 truncate" style={{ color: 'var(--n300)' }}>
                        {t.items.map(i => i.title).join(' · ')}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Step 2 — review & edit amounts */
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <div>
                <button onClick={() => setSelected(null)} className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--ink)' }}>
                  ← Back
                </button>
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>{selected.name}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm mt-6 flex-shrink-0"
                style={{ backgroundColor: 'var(--surface-2)', color: 'var(--n400)' }}
              >
                ✕
              </button>
            </div>

            {/* Date picker */}
            <div className="mt-4 mb-5">
              <label className="text-xs uppercase font-semibold mb-1.5 block" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
              />
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2 mb-5">
              {items.map((item, i) => {
                const meta = getCategoryMeta(item.category)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ backgroundColor: 'var(--elevated)', border: '1px solid var(--border-soft)' }}
                  >
                    <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-base"
                      style={{ backgroundColor: `${meta.color}1a` }}>
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--n800)' }}>{item.title}</p>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: meta.color }}>{meta.label}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-sm" style={{ color: 'var(--n300)' }}>৳</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.amount}
                        onChange={e => updateAmount(i, e.target.value)}
                        className="w-24 text-right rounded-xl px-2.5 py-1.5 text-sm font-semibold tabular-nums"
                        style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl mb-4" style={{ backgroundColor: 'var(--ink)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--on-ink)', opacity: 0.65 }}>Total</span>
              <span className="text-base font-extrabold tabular-nums" style={{ color: 'var(--on-ink)' }}>−{fmt(totalAmt)}</span>
            </div>

            {error && (
              <div className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
                {error}
              </div>
            )}

            <button onClick={saveAll} disabled={saving} className="btn-ink w-full py-3 rounded-full text-sm font-semibold">
              {saving ? 'Saving…' : `Save ${items.length} expense${items.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
