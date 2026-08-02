import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { money0 } from '../lib/format'
import { parseKey } from '../lib/dates'
import { saveDailyLog, deleteDailyLog, defaultItemsOf, updateDayType } from '../lib/dailyDeepDive'

/* Log (or edit) one calendar date on the deep-dive spine.
   The day type is only a label for the day — what it actually cost is typed
   in line by line here, so nothing about a day type can rewrite a logged day. */

const inputStyle = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}

export default function DeepDiveDayModal({
  userId, date, log = null, dayTypes, accent, onClose, onSaved, onDeleted, onDayTypeUpdated,
}) {
  const [dayTypeId, setDayTypeId] = useState(log?.day_type_id ?? null)
  const [rows, setRows] = useState(() =>
    (log?.deepdive_daily_log_items ?? []).map(it => ({ name: it.name, amount: String(it.amount) })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savingDefaultIdx, setSavingDefaultIdx] = useState(null)

  // Freeze the page behind the sheet. Without this the long month list keeps
  // scrolling underneath — and an autofocused field inside the sheet can drag
  // the background to a completely unrelated position while it's open.
  useEffect(() => {
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [])

  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  // A day type is purely a label here — picking one never touches the items
  // you've typed, and tapping the active one clears it back to unlabelled.
  function pickType(id) {
    setDayTypeId(cur => (cur === id ? null : id))
  }

  function setRow(i, patch) { setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))) }
  function removeRow(i) { setRows(rs => rs.filter((_, j) => j !== i)) }
  function addRow() { setRows(rs => [...rs, { name: '', amount: '' }]) }
  function addQuickItem(it) { setRows(rs => [...rs, { name: it.name, amount: String(it.amount) }]) }

  const selectedType = dayTypes.find(dt => dt.id === dayTypeId)
  const quickItems = defaultItemsOf(selectedType)

  function isAlreadyDefault(row) {
    const name = row.name.trim().toLowerCase()
    return !name ? false : quickItems.some(it => it.name.trim().toLowerCase() === name)
  }

  // Save a row you're typing right now as this day type's default, so it
  // shows up as a quick-add chip (here and on the deep-dive page) the next
  // time — without having to leave this modal to set it up separately.
  async function saveRowAsDefault(i) {
    if (!selectedType || savingDefaultIdx !== null) return
    const row = rows[i]
    const name = row.name.trim()
    const amount = parseFloat(row.amount)
    if (!name || !(amount > 0) || isAlreadyDefault(row)) return
    setSavingDefaultIdx(i)
    const items = [...quickItems, { name, amount }]
    const { data, error: err } = await updateDayType(selectedType.id, { default_items: items })
    setSavingDefaultIdx(null)
    if (err) { setError(err.message); return }
    onDayTypeUpdated?.(data)
  }

  async function save() {
    if (saving) return
    setSaving(true); setError('')
    const { data, error: err } = await saveDailyLog(userId, date, dayTypeId, rows)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(data)
  }

  async function remove() {
    if (saving || !log) return
    setSaving(true); setError('')
    const { error: err } = await deleteDailyLog(log.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onDeleted(date)
  }

  const heading = parseKey(date).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // Portalled to <body>: the page's `.fade-up` entrance animation leaves
  // `<main>` with a lingering identity transform (animation-fill-mode:
  // both), and ANY transform value on an ancestor — even a no-op one —
  // makes that ancestor the containing block for position:fixed
  // descendants. Left in place, this modal would be "fixed" to <main>'s
  // box instead of the viewport, drifting with scroll and landing off-
  // screen on a long page like this one's 31-day timeline.
  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="p-6">

          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                {heading}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n350)' }}>
                {log ? 'Edit what this day cost' : 'What did this day cost?'}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-2)', color: 'var(--n400)', border: '1px solid var(--border-2)' }}>✕</button>
          </div>

          {/* day type — optional */}
          {dayTypes.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase mb-2.5" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
                Day type
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {dayTypes.map(dt => {
                  const on = dayTypeId === dt.id
                  return (
                    <button key={dt.id} type="button" onClick={() => pickType(dt.id)}
                      className="tile-press text-xs font-semibold px-3 py-2 rounded-xl"
                      style={{
                        background: on ? `${accent}1f` : 'var(--surface-2)',
                        border: `1.5px solid ${on ? accent : 'var(--border-2)'}`,
                        color: on ? accent : 'var(--n500)',
                      }}>
                      {dt.name}
                    </button>
                  )
                })}
                <button type="button" onClick={() => pickType(null)}
                  className="tile-press text-xs font-semibold px-3 py-2 rounded-xl"
                  style={{
                    background: dayTypeId === null ? 'var(--surface-2)' : 'transparent',
                    border: `1.5px solid ${dayTypeId === null ? 'var(--border-3)' : 'var(--border-2)'}`,
                    color: dayTypeId === null ? 'var(--n700)' : 'var(--n350)',
                  }}>
                  None
                </button>
              </div>
            </>
          )}

          {/* quick add — this day type's reusable "usually cost this" items,
              set up on the deep-dive page. Tapping one just appends a normal,
              still-editable row; nothing here is locked. */}
          {quickItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
                Quick add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickItems.map((it, i) => (
                  <button key={i} type="button" onClick={() => addQuickItem(it)}
                    className="tile-press text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n600)' }}>
                    + {it.name} ৳{it.amount}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* items */}
          <div className="flex flex-col gap-2 mb-4">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                <input value={r.name} onChange={e => setRow(i, { name: e.target.value })}
                  placeholder="Item name…"
                  className="text-sm flex-1 min-w-0"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n700)' }}
                  autoFocus={r.name === ''} />
                <div className="flex items-center rounded-lg px-2.5 flex-shrink-0" style={{ width: 106, ...inputStyle }}>
                  <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
                  <input type="number" min="0" step="1" value={r.amount}
                    onChange={e => setRow(i, { amount: e.target.value })} placeholder="0"
                    className="w-full text-sm font-semibold tabular-nums text-right py-1.5"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
                </div>
                {selectedType && (() => {
                  const already = isAlreadyDefault(r)
                  const canSave = !already && !!r.name.trim() && parseFloat(r.amount) > 0
                  return (
                    <button type="button" onClick={() => saveRowAsDefault(i)}
                      disabled={!canSave || savingDefaultIdx !== null}
                      title={already ? `Already a default for ${selectedType.name}` : `Save as a ${selectedType.name} default`}
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 28, height: 28, borderRadius: '50%', fontSize: 13,
                        background: already ? `${accent}1f` : 'var(--surface)',
                        border: `1.5px solid ${already ? accent : 'var(--border-2)'}`,
                        color: already ? accent : 'var(--n400)',
                        cursor: canSave ? 'pointer' : 'default',
                        opacity: canSave || already ? 1 : 0.4,
                      }}>
                      {already ? '★' : '☆'}
                    </button>
                  )
                })()}
                <button onClick={() => removeRow(i)} className="btn-delete flex-shrink-0" title="Remove">×</button>
              </div>
            ))}

            <button type="button" onClick={addRow}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full text-left"
              style={{ background: 'transparent', border: '1.5px dashed var(--border-2)', color: 'var(--n400)' }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              <span className="text-sm font-medium">Add item</span>
            </button>
          </div>

          <div className="flex items-center justify-between mb-5 px-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--n500)' }}>Day total</span>
            <span className="text-xl font-extrabold tabular-nums" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
              {money0(total)}
            </span>
          </div>

          {error && <p className="text-xs mb-3" style={{ color: 'var(--err-txt)' }}>{error}</p>}

          <button onClick={save} disabled={saving}
            className="btn-ink w-full py-3 rounded-xl text-sm font-bold">
            {saving ? 'Saving…' : log ? 'Update this day' : 'Save this day'}
          </button>

          {log && (
            <button onClick={remove} disabled={saving}
              className="w-full text-xs font-semibold mt-3 py-2 rounded-xl"
              style={{ background: 'transparent', border: 'none', color: 'var(--n350)', cursor: 'pointer' }}>
              Remove this day's log
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
