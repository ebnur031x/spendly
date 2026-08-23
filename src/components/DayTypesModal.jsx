import { useState } from 'react'
import { createPortal } from 'react-dom'
import { money0 } from '../lib/format'
import { DAY_TYPE_COLORS, createDayType, updateDayType, deleteDayType } from '../lib/dayTypes'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import ColorSwatches from './ColorSwatches'

// Manage day types: list existing, add/edit (name, color, optional
// sub-budget, and the expense fields), or delete. Edits go straight to
// Supabase; onChanged() refreshes the dashboard.
export default function DayTypesModal({ userId, dayTypes, onClose, onChanged }) {
  const [items, setItems] = useState(dayTypes)
  const [editing, setEditing] = useState(null) // null | 'new' | dayType
  const { deleteWithUndo } = useUndoableDelete()

  function afterSave(row, isNew) {
    setItems(prev => (isNew ? [...prev, row] : prev.map(d => (d.id === row.id ? row : d))))
    setEditing(null)
    onChanged?.()
  }

  function remove(id) {
    const item = items.find(d => d.id === id)
    if (!item) return
    const snapshot = items
    deleteWithUndo({
      message: `Deleted "${item.name}"`,
      remove: () => setItems(prev => prev.filter(d => d.id !== id)),
      commit: async () => {
        const { error } = await deleteDayType(id)
        if (error) setItems(snapshot)
        else onChanged?.()
      },
      restore: () => setItems(snapshot),
    })
  }

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Day types</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n350)' }}>Templates for logging a whole day at once</p>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-2)', color: 'var(--n400)', border: '1px solid var(--border-2)' }}>✕</button>
          </div>

          {editing ? (
            <DayTypeEditor
              userId={userId}
              dayType={editing === 'new' ? null : editing}
              onCancel={() => setEditing(null)}
              onSaved={afterSave}
            />
          ) : (
            <>
              <ul className="flex flex-col gap-2 mb-4">
                {items.map(dt => (
                  <li key={dt.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', background: dt.color,
                      boxShadow: `0 0 0 3px ${dt.color}22`, flexShrink: 0,
                    }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--n900)' }}>{dt.name}</p>
                      <p className="text-xs" style={{ color: 'var(--n350)' }}>
                        {dt.expense_fields?.length || 0} fields{dt.sub_budget ? ` · ${money0(dt.sub_budget)} budget` : ''}
                      </p>
                    </div>
                    <button onClick={() => setEditing(dt)} className="btn-soft text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0">Edit</button>
                    <button onClick={() => remove(dt.id)} aria-label={`Delete ${dt.name}`} className="btn-delete" title="Delete">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-sm text-center py-6" style={{ color: 'var(--n350)' }}>No day types yet.</li>
                )}
              </ul>
              <button onClick={() => setEditing('new')} className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold">+ New day type</button>
              <button onClick={onClose} className="btn-soft w-full py-2.5 rounded-xl text-sm font-semibold mt-3">Done</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DayTypeEditor({ userId, dayType, onCancel, onSaved }) {
  const isNew = !dayType
  const [name, setName] = useState(dayType?.name ?? '')
  const [color, setColor] = useState(dayType?.color ?? DAY_TYPE_COLORS[0])
  const [subBudget, setSubBudget] = useState(dayType?.sub_budget != null ? String(dayType.sub_budget) : '')
  const [fields, setFields] = useState(() =>
    (dayType?.expense_fields ?? [{ label: '', default_amount: 0, optional: false }]).map(f => ({
      label: f.label ?? '',
      default_amount: f.default_amount ? String(f.default_amount) : '',
      optional: !!f.optional,
    })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(i, patch) { setFields(fs => fs.map((f, j) => (j === i ? { ...f, ...patch } : f))) }
  function addField() { setFields(fs => [...fs, { label: '', default_amount: '', optional: false }]) }
  function removeField(i) { setFields(fs => fs.filter((_, j) => j !== i)) }

  async function save() {
    const cleanName = name.trim()
    if (!cleanName) { setError('Give the day type a name.'); return }
    const expense_fields = fields
      .filter(f => f.label.trim())
      .map(f => ({
        label: f.label.trim(),
        default_amount: parseFloat(f.default_amount) || 0,
        ...(f.optional ? { optional: true } : {}),
      }))
    const sub = subBudget.trim() === '' ? null : parseFloat(subBudget)
    const payload = {
      name: cleanName,
      slug: dayType?.slug ?? slugify(cleanName),
      color,
      sub_budget: Number.isFinite(sub) ? sub : null,
      expense_fields,
    }

    setSaving(true); setError('')
    const { data, error } = isNew
      ? await createDayType(userId, payload)
      : await updateDayType(dayType.id, payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(data, isNew)
  }

  return (
    <div>
      <label className="block eyebrow mb-1.5" style={{ color: 'var(--n400)' }}>Name</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gym Day"
        className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-4"
        style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }} />

      <label className="block eyebrow mb-2" style={{ color: 'var(--n400)' }}>Color</label>
      <ColorSwatches colors={DAY_TYPE_COLORS} value={color} onChange={setColor} className="mb-4" />

      <label className="block eyebrow mb-1.5" style={{ color: 'var(--n400)' }}>
        Sub-budget <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </label>
      <div className="flex items-center rounded-xl px-3 mb-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
        <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
        <input type="number" min="0" step="1" value={subBudget} onChange={e => setSubBudget(e.target.value)} placeholder="No cap"
          className="w-full text-sm font-semibold tabular-nums py-2.5"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
      </div>

      <label className="block eyebrow mb-2" style={{ color: 'var(--n400)' }}>Expense fields</label>
      <div className="flex flex-col gap-2 mb-2">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={f.label} onChange={e => setField(i, { label: e.target.value })} placeholder="Label"
              className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }} />
            <div className="flex items-center rounded-lg px-2" style={{ width: 92, background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
              <span className="text-xs mr-1" style={{ color: 'var(--n350)' }}>৳</span>
              <input type="number" min="0" step="1" value={f.default_amount} onChange={e => setField(i, { default_amount: e.target.value })} placeholder="0"
                className="w-full text-sm tabular-nums py-2"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
            </div>
            <button type="button" onClick={() => setField(i, { optional: !f.optional })}
              title="Optional field"
              className="text-[11px] font-bold px-2 py-2 rounded-lg flex-shrink-0"
              style={{
                background: f.optional ? 'var(--ink)' : 'var(--surface-2)',
                color: f.optional ? 'var(--on-ink)' : 'var(--n400)',
                border: '1.5px solid ' + (f.optional ? 'var(--ink)' : 'var(--border-2)'),
              }}>OPT</button>
            <button type="button" onClick={() => removeField(i)} aria-label="Remove field" className="btn-delete flex-shrink-0" title="Remove">×</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addField} className="text-xs font-semibold mb-5" style={{ color: 'var(--ink)' }}>+ Add field</button>

      {error && <p className="text-xs mb-3" style={{ color: 'var(--err-txt)' }}>{error}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-ink flex-1 py-2.5 rounded-xl text-sm font-semibold">
          {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
        </button>
        <button onClick={onCancel} className="btn-soft flex-1 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
      </div>
    </div>
  )
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'day'
}
