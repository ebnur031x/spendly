import { useState } from 'react'
import { money0 } from '../lib/format'
import { dayKey } from '../lib/dates'
import { isTextField } from '../lib/dayTypes'
import { createDailyLog, updateDailyLog } from '../lib/dailyLogs'
import BucketMismatchWarning from './BucketMismatchWarning'

// Two-step "log a whole day":
//   1. pick a day type (big tap targets: color + icon + name)
//   2. edit the type's expense fields (pre-filled with defaults) → save
// Launch straight to step 2 by passing initialType.
// Pass initialLog to edit an existing daily_log row (pre-fills all field values).
export default function LogTodayModal({ userId, dayTypes, initialType = null, initialLog = null, onClose, onSaved }) {
  const [type, setType] = useState(initialType)
  const [values, setValues] = useState(() => {
    if (initialLog && initialType) return initValuesFromLog(initialType, initialLog)
    if (initialType) return initValues(initialType)
    return {}
  })
  // per-entry label overrides (key = original field label, value = custom label)
  const [localLabels, setLocalLabels] = useState(() => {
    if (initialLog && initialType) return initLocalLabels(initialType, initialLog)
    return {}
  })
  const [editingLabelIdx, setEditingLabelIdx] = useState(null) // index of field whose label is being edited
  // ad-hoc items added on the fly (not in the day type template)
  const [extras, setExtras] = useState(() => {
    if (initialLog && initialType) return initExtras(initialType, initialLog)
    return []
  })
  const [date, setDate] = useState(initialLog?.date ?? dayKey(new Date()))
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const step = type ? 2 : 1

  function pick(dt) {
    setType(dt)
    setValues(initValues(dt))
    setLocalLabels({})
    setExtras([])
    setEditingLabelIdx(null)
  }

  function setLabel(orig, val) { setLocalLabels(m => ({ ...m, [orig]: val })) }
  function addExtra() { setExtras(e => [...e, { label: '', amount: '' }]) }
  function setExtra(i, patch) { setExtras(e => e.map((x, j) => j === i ? { ...x, ...patch } : x)) }
  function removeExtra(i) { setExtras(e => e.filter((_, j) => j !== i)) }

  const numericFields = (type?.expense_fields || []).filter(f => !isTextField(f))
  const textFields = (type?.expense_fields || []).filter(isTextField)
  const extraTotal = extras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const total = numericFields.reduce((s, f) => s + (parseFloat(values[f.label]) || 0), 0) + extraTotal

  async function save() {
    if (!type || saving) return
    setSaving(true); setError('')

    const entries = [
      ...numericFields
        .map(f => ({ label: localLabels[f.label]?.trim() || f.label, amount: parseFloat(values[f.label]) || 0 }))
        .filter(e => e.amount > 0),
      ...extras
        .filter(e => e.label.trim() && parseFloat(e.amount) > 0)
        .map(e => ({ label: e.label.trim(), amount: parseFloat(e.amount) })),
    ]

    const textNote = textFields
      .map(f => (values[f.label] || '').trim())
      .filter(Boolean)
      .join(' · ')
    const finalNotes = [textNote, notes.trim()].filter(Boolean).join(' — ') || null

    const payload = { date, day_type_id: type.id, expenses: entries, total_spent: total, notes: finalNotes }
    const { error } = initialLog
      ? await updateDailyLog(initialLog.id, payload)
      : await createDailyLog(userId, payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved?.()
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 min-w-0">
              {step === 2 && !initialType && (
                <button onClick={() => setType(null)} aria-label="Back"
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--n500)', border: '1px solid var(--border-2)' }}>←</button>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold truncate" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                  {step === 1 ? 'Log a day' : type.name}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--n350)' }}>
                  {step === 1 ? 'What kind of day was it?' : initialLog ? 'Edit the amounts and save' : 'Confirm the amounts and save'}
                </p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-2)', color: 'var(--n400)', border: '1px solid var(--border-2)' }}>✕</button>
          </div>

          {step === 1 ? (
            dayTypes.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--n350)' }}>
                No day types yet. Add one from the dashboard first.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {dayTypes.map(dt => (
                  <button key={dt.id} onClick={() => pick(dt)}
                    className="tile-press flex items-center gap-3 p-4 rounded-2xl text-left"
                    style={{ background: 'var(--surface-2)', border: `1.5px solid var(--border-soft)` }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border-3)' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-soft)' }}>
                    <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${dt.color}29, ${dt.color}0d)`,
                        boxShadow: `inset 0 0 0 1px ${dt.color}40`,
                        fontSize: 20,
                      }}>{dayTypeIcon(dt)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: 'var(--n900)' }}>{dt.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--n350)' }}>
                        {dt.expense_fields?.length || 0} field{(dt.expense_fields?.length || 0) === 1 ? '' : 's'}
                        {dt.sub_budget ? ` · ${money0(dt.sub_budget)} budget` : ''}
                      </p>
                    </div>
                    <span className="ml-auto text-lg flex-shrink-0" style={{ color: 'var(--n300)' }}>→</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {/* date */}
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Date</span>
                <input type="date" value={date} max={dayKey(new Date())}
                  onChange={e => e.target.value && setDate(e.target.value)}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
              </div>

              {/* fields */}
              <div className="flex flex-col gap-2 mb-3">
                {type.expense_fields.map((f, i) => {
                  const text = isTextField(f)
                  const displayLabel = localLabels[f.label] ?? f.label
                  const isEditingThisLabel = editingLabelIdx === i
                  return (
                    <div key={i}>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>

                      {/* label area */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {isEditingThisLabel ? (
                          <input
                            value={displayLabel}
                            onChange={e => setLabel(f.label, e.target.value)}
                            onBlur={() => setEditingLabelIdx(null)}
                            onKeyDown={e => (e.key === 'Enter' || e.key === 'Escape') && setEditingLabelIdx(null)}
                            className="text-sm flex-1 min-w-0 rounded-md px-1.5 py-0.5"
                            style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)', color: 'var(--n900)', outline: 'none' }}
                            autoFocus
                          />
                        ) : (
                          <>
                            <span className="text-sm truncate" style={{ color: 'var(--n700)' }}>{displayLabel}</span>
                            {f.optional && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--n300)' }}>opt</span>}
                            <button
                              type="button"
                              onClick={() => setEditingLabelIdx(i)}
                              title="Rename"
                              style={{
                                flexShrink: 0, width: 20, height: 20, borderRadius: 5,
                                background: 'var(--surface)', border: '1px solid var(--border-2)',
                                color: 'var(--n400)', fontSize: 10, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >✎</button>
                          </>
                        )}
                      </div>

                      {/* amount input */}
                      {text ? (
                        <input
                          value={values[f.label] ?? ''}
                          onChange={e => setValues(v => ({ ...v, [f.label]: e.target.value }))}
                          placeholder="—"
                          className="w-28 text-sm text-right rounded-lg px-2 py-1.5 flex-shrink-0"
                          style={{ background: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
                        />
                      ) : (
                        <div className="flex items-center rounded-lg px-2.5 flex-shrink-0" style={{ width: 108, background: 'var(--surface)', border: '1.5px solid var(--border-2)' }}>
                          <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
                          <input
                            type="number" min="0" step="1"
                            value={values[f.label] ?? ''}
                            onChange={e => setValues(v => ({ ...v, [f.label]: e.target.value }))}
                            placeholder="0"
                            className="w-full text-sm font-semibold tabular-nums text-right py-1.5"
                            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                          />
                        </div>
                      )}
                    </div>
                    {!isEditingThisLabel && <BucketMismatchWarning text={displayLabel} currentBucket="daily" />}
                    </div>
                  )
                })}

                {/* ad-hoc extras */}
                {extras.map((ex, i) => (
                  <div key={`ex-${i}`}>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-2)' }}>
                    <input
                      value={ex.label}
                      onChange={e => setExtra(i, { label: e.target.value })}
                      placeholder="Item name…"
                      className="text-sm flex-1 min-w-0"
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n700)' }}
                      autoFocus={ex.label === ''}
                    />
                    <div className="flex items-center rounded-lg px-2.5 flex-shrink-0" style={{ width: 108, background: 'var(--surface)', border: '1.5px solid var(--border-2)' }}>
                      <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
                      <input
                        type="number" min="0" step="1"
                        value={ex.amount}
                        onChange={e => setExtra(i, { amount: e.target.value })}
                        placeholder="0"
                        className="w-full text-sm font-semibold tabular-nums text-right py-1.5"
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                      />
                    </div>
                    <button
                      onClick={() => removeExtra(i)}
                      className="btn-delete flex-shrink-0"
                      title="Remove"
                    >×</button>
                  </div>
                  <BucketMismatchWarning text={ex.label} currentBucket="daily" />
                  </div>
                ))}

                {/* Add item row */}
                <button
                  type="button"
                  onClick={addExtra}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full text-left"
                  style={{ background: 'transparent', border: '1.5px dashed var(--border-2)', color: 'var(--n400)' }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  <span className="text-sm font-medium">Add item</span>
                </button>
              </div>

              {/* notes */}
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-4"
                style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
              />

              {/* total + save */}
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--n500)' }}>Day total</span>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                  {money0(total)}
                </span>
              </div>

              {error && <p className="text-xs mb-3" style={{ color: 'var(--err-txt)' }}>{error}</p>}

              <button onClick={save} disabled={saving}
                className="btn-ink w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: type.color, color: '#fff' }}>
                {saving ? 'Saving…' : initialLog ? `Update ${type.name}` : `Log ${type.name}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function initValues(type) {
  const vals = {}
  for (const f of type.expense_fields || []) {
    if (isTextField(f)) vals[f.label] = ''
    else vals[f.label] = f.default_amount ? String(f.default_amount) : ''
  }
  return vals
}

function initValuesFromLog(type, log) {
  const vals = {}
  for (const f of type.expense_fields || []) {
    if (isTextField(f)) {
      vals[f.label] = ''
    } else {
      // match by position OR label (log may have a renamed label stored)
      const saved = (log.expenses || []).find(e => e.label === f.label)
      vals[f.label] = saved && saved.amount > 0 ? String(saved.amount) : ''
    }
  }
  return vals
}

// Returns any per-entry label overrides stored in the log
// (no-op for now — labels are stored as-used, so we can't back-map them)
function initLocalLabels(_type, _log) {
  return {}
}

// Returns log entries that don't match any template field (ad-hoc extras)
function initExtras(type, log) {
  const templateLabels = new Set((type.expense_fields || []).map(f => f.label))
  return (log.expenses || [])
    .filter(e => !templateLabels.has(e.label) && e.label && Number(e.amount) > 0)
    .map(e => ({ label: e.label, amount: String(e.amount) }))
}

// Day types store a color + name but no icon, so derive a friendly glyph
// from the slug/name with a sensible fallback.
const ICON_BY_SLUG = { uni: '🎓', normal: '🏠', occasional: '✨', date: '💕', work: '💼', weekend: '🎉' }
function dayTypeIcon(dt) {
  const slug = (dt.slug || '').toLowerCase()
  if (ICON_BY_SLUG[slug]) return ICON_BY_SLUG[slug]
  const name = (dt.name || '').toLowerCase()
  const hit = Object.keys(ICON_BY_SLUG).find(k => name.includes(k))
  return hit ? ICON_BY_SLUG[hit] : '📅'
}
