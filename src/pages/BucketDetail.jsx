import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Icon from '../components/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { money, money0 } from '../lib/format'
import { dayKey, parseKey, monthKey, daysInMonth } from '../lib/dates'
import { insertExpenses } from '../lib/expenses'
import { bucketMeta, ensureBucketSettings, updateBucketSetting, indexSettings } from '../lib/buckets'
import { suggestBillType } from '../lib/classify'
import { useBucketRedirect } from '../hooks/useBucketRedirect'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import MiniBudgetBar, { resolveCap } from '../components/MiniBudgetBar'
import BucketPicker from '../components/BucketPicker'
import BucketRedirectChips from '../components/BucketRedirectChips'
import Reveal from '../components/Reveal'

/* Detail screen for the two event-logged buckets: Groceries and Bills.
   (Daily Spend has its own richer page; Commitments has its own too.) */

// Per-bucket composer config. Groceries store a valid `category='variable'`
// and Bills `category='oneoff'` purely to satisfy the CHECK constraint — the
// real classification is the `bucket` column; `category_name` holds the label.
const CONFIG = {
  groceries: {
    category: 'variable',
    defaultName: 'Groceries',
    namePlaceholder: 'What did you buy?',
    types: null,
  },
  bills: {
    category: 'oneoff',
    defaultName: 'Bill',
    namePlaceholder: 'What was it?',
    types: [
      { label: 'Electricity', emoji: <Icon name="bolt" size={15} /> },
      { label: 'Water', emoji: <Icon name="droplet" size={15} /> },
      { label: 'Gas', emoji: <Icon name="flame" size={15} /> },
      { label: 'Internet', emoji: <Icon name="globe" size={15} /> },
      { label: 'Phone', emoji: <Icon name="phone" size={15} /> },
      { label: 'One-off', emoji: <Icon name="sparkle" size={15} /> },
      { label: 'Other', emoji: <Icon name="receipt" size={15} /> },
    ],
  },
}

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}
const editBtnStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'var(--surface-2)', border: '1.5px solid var(--border-soft)',
  color: 'var(--n500)', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

export default function BucketDetail({ bucketKey }) {
  const key = CONFIG[bucketKey] ? bucketKey : 'bills'
  const meta = bucketMeta(key)
  const cfg = CONFIG[key]
  const { user } = useAuth()
  const { toast } = useToast()
  const { deleteWithUndo } = useUndoableDelete()
  const month = monthKey()

  const [rows, setRows] = useState([])
  const [setting, setSetting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // composer
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const { target: composerBucket, saveTarget, setTarget: setComposerBucket, reset: resetComposerBucket } = useBucketRedirect(name, key)
  const [type, setType] = useState(cfg.types ? cfg.types[0].label : null)
  const [date, setDate] = useState(dayKey(new Date()))
  const [saving, setSaving] = useState(false)
  const amountRef = useRef(null)

  // edit / cap / bulk-move modals
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editBucket, setEditBucket] = useState(key)
  const [showCap, setShowCap] = useState(false)
  const [capVal, setCapVal] = useState('')
  const [movingGroup, setMovingGroup] = useState(null)
  const [selectedMoveIds, setSelectedMoveIds] = useState([])
  const [moveDate, setMoveDate] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [key])

  async function load() {
    setLoading(true)
    const [expRes, setRes] = await Promise.all([
      supabase.from('expenses').select('*')
        .eq('user_id', user.id).eq('bucket', key)
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
      ensureBucketSettings(user.id),
    ])
    if (expRes.error) setError(expRes.error.message)
    setRows(expRes.data ?? [])
    setSetting(indexSettings(setRes.data ?? [])[key] ?? null)
    setLoading(false)
  }

  function buildRow(targetBucket, amt) {
    const trimmed = name.trim()
    if (targetBucket === 'daily') {
      return {
        user_id: user.id, title: trimmed, amount: amt,
        category: 'variable', category_name: trimmed,
        bucket: 'daily', date,
      }
    }
    if (targetBucket === 'groceries') {
      return {
        user_id: user.id, title: trimmed, amount: amt,
        category: 'variable', category_name: 'Groceries',
        bucket: 'groceries', date,
      }
    }
    const billType = (key === 'bills' && cfg.types) ? type : suggestBillType(trimmed)
    return {
      user_id: user.id, title: trimmed || billType, amount: amt,
      category: 'oneoff', category_name: billType,
      bucket: 'bills', date,
    }
  }

  async function handleAdd(e) {
    e?.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || !name.trim()) return
    setSaving(true); setError('')
    const row = buildRow(saveTarget, amt)
    const { data, error: err } = await insertExpenses([row])
    if (err) { setError(err.message); setSaving(false); return }
    if (saveTarget === key) {
      setRows(prev => [data[0], ...prev])
    } else {
      toast({ icon: bucketMeta(saveTarget).icon, message: `Added to ${bucketMeta(saveTarget).name}` })
    }
    setAmount(''); setName('')
    resetComposerBucket()
    setSaving(false)
  }

  function openEdit(r) {
    setEditing(r)
    setEditName(r.title || '')
    setEditAmount(String(r.amount))
    setEditDate(r.date || dayKey(new Date()))
    setEditBucket(r.bucket || key)
  }

  async function saveEdit() {
    if (!editing) return
    const amt = parseFloat(editAmount)
    if (!(amt > 0)) return
    const { data, error: err } = await supabase.from('expenses')
      .update({ title: editName.trim() || cfg.defaultName, amount: amt, date: editDate, bucket: editBucket })
      .eq('id', editing.id).select().single()
    if (err) setError(err.message)
    // Moving an entry to another bucket drops it from this bucket's list.
    else if (data) setRows(prev => editBucket === key
      ? prev.map(r => r.id === editing.id ? data : r)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''))
      : prev.filter(r => r.id !== editing.id))
    setEditing(null)
  }

  function handleDelete(id) {
    const item = rows.find(r => r.id === id)
    if (!item) return
    const snapshot = rows
    deleteWithUndo({
      message: `Deleted "${item.title}"`,
      remove: () => setRows(prev => prev.filter(r => r.id !== id)),
      commit: async () => {
        const { error: err } = await supabase.from('expenses').delete().eq('id', id)
        if (err) { setError(err.message); setRows(snapshot) }
      },
      restore: () => setRows(snapshot),
    })
  }

  function openBulkMove(group) {
    setMovingGroup(group)
    setSelectedMoveIds(group.items.map(item => item.id))
    setMoveDate(group.date)
  }

  function toggleMoveItem(id) {
    setSelectedMoveIds(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id])
  }

  const destinationItems = useMemo(() => {
    if (!moveDate || !movingGroup || moveDate === movingGroup.date) return []
    return rows.filter(row => row.date === moveDate && !selectedMoveIds.includes(row.id))
  }, [moveDate, movingGroup, rows, selectedMoveIds])

  async function saveBulkMove() {
    if (!movingGroup || !moveDate || moveDate === movingGroup.date || selectedMoveIds.length === 0 || moving) return
    setMoving(true); setError('')
    const { data, error: err } = await supabase.from('expenses')
      .update({ date: moveDate }).in('id', selectedMoveIds).select()
    setMoving(false)
    if (err) { setError(err.message); return }
    const byId = new Map((data ?? []).map(row => [row.id, row]))
    setRows(prev => prev.map(row => byId.get(row.id) ?? row)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '')))
    setMovingGroup(null)
    toast({ icon: '✓', message: `Moved ${selectedMoveIds.length} grocery item${selectedMoveIds.length === 1 ? '' : 's'} to ${fmtDate(moveDate)}` })
  }

  async function saveCap() {
    const val = capVal.trim() === '' ? null : parseFloat(capVal)
    if (val != null && !(val >= 0)) return
    setShowCap(false)
    if (setting?.id) {
      const { data } = await updateBucketSetting(setting.id, { mini_budget: val })
      if (data) setSetting(data)
    }
  }

  /* derived */
  const monthUsed = useMemo(() =>
    rows.filter(r => (r.date || '').startsWith(month))
      .reduce((s, r) => s + Number(r.amount), 0), [rows, month])

  const totalAll = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows])

  const groups = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const d = r.date || 'no-date'
      if (!map.has(d)) map.set(d, [])
      map.get(d).push(r)
    }
    return [...map.entries()].map(([d, items]) => ({ date: d, items }))
  }, [rows])

  const miniBudget = setting?.mini_budget != null ? Number(setting.mini_budget) : null
  const capPeriod = setting?.cap_period ?? 'monthly'
  const { cap, label: capLabel } = resolveCap({ miniBudget, capPeriod }, daysInMonth(month))
  const color = setting?.color ?? meta.color
  const needsNote = !cfg.types || type === 'Other' || type === 'One-off'
  const canAdd = !!amount && parseFloat(amount) > 0 && (!needsNote || !!name.trim())

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up frost-page">

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}22`, fontSize: 21, color }}>{meta.icon}</span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>{meta.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--n350)' }}>{meta.tagline}</p>
          </div>
        </div>
      </div>

      {/* Groceries-only: a lighter deep-dive for item prices + trip
          history. Bills has no equivalent — this is intentionally scoped
          to groceries alone, not lifted into the shared config above. */}
      {key === 'groceries' && (
        <Reveal>
          <Link to="/groceries/deep-dive" className="card p-4 mb-4 row-hover flex items-center gap-3"
            style={{ textDecoration: 'none' }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}22`, fontSize: 17, color }}><Icon name="calculator" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: 'var(--n900)' }}>Groceries deep-dive</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n350)' }}>Log what you buy — weekly &amp; monthly totals</p>
            </div>
            <span style={{ color: 'var(--n300)' }}>›</span>
          </Link>
        </Reveal>
      )}

      {/* Mini-budget card */}
      <Reveal>
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
              This month
            </span>
            {key === 'groceries' ? (
              // Read-only here: the deep-dive is the one writer of this cap
              // (same fix as Daily Spend's — two editors on one field
              // silently fight each other).
              <Link to="/groceries/deep-dive" className="btn-soft text-xs px-3 py-1.5 rounded-full font-semibold" style={{ textDecoration: 'none' }}>
                {miniBudget != null ? 'Deep dive ›' : 'Set it up ›'}
              </Link>
            ) : (
              <button onClick={() => { setCapVal(miniBudget != null ? String(miniBudget) : ''); setShowCap(true) }}
                className="btn-soft text-xs px-3 py-1.5 rounded-full font-semibold">
                {miniBudget != null ? 'Edit cap' : 'Set cap'}
              </button>
            )}
          </div>
          <MiniBudgetBar used={monthUsed} cap={cap} color={color} note={capLabel} />
        </div>
      </Reveal>

      {/* Composer */}
      <Reveal delay={60}>
        <div className="card mb-4">
          <form onSubmit={handleAdd} className="p-6">
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
              Add to {meta.name.toLowerCase()}
            </p>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center flex-1 rounded-2xl px-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                <input ref={amountRef} type="number" min="0.01" step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)} placeholder="0"
                  className="w-full py-3 text-3xl font-extrabold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)', letterSpacing: '-0.02em' }} />
              </div>
              <button type="submit" disabled={!canAdd || saving}
                className="btn-ink rounded-2xl font-semibold flex-shrink-0"
                style={{ padding: '0 24px', height: 58, fontSize: 15, opacity: !canAdd || saving ? 0.45 : 1 }}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>

            {cfg.types && (
              <div className="flex flex-wrap gap-2 mb-4">
                {cfg.types.map(t => {
                  const on = type === t.label
                  return (
                    <button key={t.label} type="button" onClick={() => {
                      setType(t.label)
                      if (t.label !== 'Other' && t.label !== 'One-off') setName('')
                    }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                      style={{
                        background: on ? `${color}20` : 'var(--surface-2)',
                        color: on ? color : 'var(--n600)',
                        border: '1.5px solid ' + (on ? `${color}66` : 'var(--border-soft)'),
                      }}>
                      <span style={{ fontSize: 15 }}>{t.emoji}</span>{t.label}
                    </button>
                  )
                })}
              </div>
            )}

            {needsNote && (
              <input value={name} onChange={e => setName(e.target.value)} placeholder={cfg.namePlaceholder}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-4" style={inputStyle} />
            )}

            <BucketRedirectChips text={name} target={composerBucket} setTarget={setComposerBucket} homeBucket={key} />

            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Date</span>
              <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
                className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
            </div>
          </form>
        </div>
      </Reveal>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
          {error}
        </div>
      )}

      {/* History */}
      <Reveal delay={120}>
        <div className="flex items-end justify-between mb-3 px-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--n900)' }}>History</h2>
          <span className="text-sm tabular-nums" style={{ color: 'var(--n350)' }}>{money0(totalAll)} all time</span>
        </div>
        {rows.length > 0 && (
          <p className="text-xs -mt-1 mb-3 px-1" style={{ color: 'var(--n350)' }}>
            Tap the pencil on an expense to edit it or move it to another date.
          </p>
        )}

        {loading ? (
          <div className="card flex justify-center py-16">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-4xl mb-3">{meta.icon}</p>
            <p className="text-sm" style={{ color: 'var(--n350)' }}>Nothing in {meta.name.toLowerCase()} yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>Add your first entry above ↑</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(group => {
              const subtotal = group.items.reduce((s, r) => s + Number(r.amount), 0)
              return (
                <div key={group.date}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>
                      {fmtDate(group.date)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--n400)' }}>{money0(subtotal)}</span>
                      {key === 'groceries' && (
                        <button type="button" onClick={() => openBulkMove(group)}
                          className="btn-soft rounded-full px-2.5 py-1 text-[11px] font-semibold">
                          Move items
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="card overflow-hidden">
                    <ul>
                      {group.items.map((r, i) => (
                        <li key={r.id} className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5"
                          style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                          <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${color}1a` }}>{typeEmoji(key, r.category_name) ?? meta.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{r.title}</p>
                            {r.category_name && r.category_name !== r.title && (
                              <span className="text-xs font-medium" style={{ color }}>{r.category_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>−{money(r.amount)}</span>
                            <button onClick={() => openEdit(r)} title="Edit" style={editBtnStyle}>✎</button>
                            <button onClick={() => handleDelete(r.id)} className="btn-delete" title="Delete">×</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Reveal>

      {/* Edit modal */}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Edit entry</h2>
                <button onClick={() => setEditing(null)} aria-label="Close" style={{ ...editBtnStyle, width: 36, height: 36, fontSize: 14 }}>✕</button>
              </div>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Description"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-3" style={inputStyle} autoFocus />
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Date</span>
                <input type="date" value={editDate} onChange={e => e.target.value && setEditDate(e.target.value)}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
              </div>
              <div className="flex items-center rounded-2xl px-4 mb-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                <input type="number" min="0.01" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  className="w-full py-3 text-3xl font-extrabold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
              </div>
              <div className="mb-4">
                <BucketPicker value={editBucket} onChange={setEditBucket} />
              </div>
              <button onClick={saveEdit} disabled={!(parseFloat(editAmount) > 0)}
                className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk move is intentionally available only for groceries: it lets a
          whole shopping day's entries be reassigned without recreating them. */}
      {movingGroup && createPortal(
        <div className="modal-scrim modal-scrim-centered" onClick={() => !moving && setMovingGroup(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Move grocery items</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--n350)' }}>Choose items from {fmtDate(movingGroup.date)}, then pick their new date.</p>
                </div>
                <button onClick={() => setMovingGroup(null)} disabled={moving} aria-label="Close" style={{ ...editBtnStyle, width: 36, height: 36, fontSize: 14 }}>×</button>
              </div>

              <div className="mt-5 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-soft)' }}>
                {movingGroup.items.map((item, index) => {
                  const selected = selectedMoveIds.includes(item.id)
                  return (
                    <label key={item.id} className="flex items-center gap-3 px-3.5 py-3 cursor-pointer"
                      style={{ borderBottom: index < movingGroup.items.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                      <input type="checkbox" checked={selected} onChange={() => toggleMoveItem(item.id)} disabled={moving}
                        className="w-4 h-4 accent-[var(--ink)]" />
                      <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{item.title}</span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n600)' }}>{money(item.amount)}</span>
                    </label>
                  )
                })}
              </div>

              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Move selected to</span>
                <input type="date" value={moveDate} onChange={e => e.target.value && setMoveDate(e.target.value)} disabled={moving}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
              </div>

              {destinationItems.length > 0 && (
                <div className="rounded-xl px-3.5 py-3 mb-4" style={{ background: 'var(--warn-bg, #fff7e6)', border: '1px solid var(--warn-border, #f0c36a)', color: 'var(--n700)' }}>
                  <p className="text-sm font-semibold">{destinationItems.length} grocery item{destinationItems.length === 1 ? '' : 's'} already {destinationItems.length === 1 ? 'is' : 'are'} on {fmtDate(moveDate)}.</p>
                  <p className="text-xs mt-1">You can cancel and remove those first, or move these items there anyway.</p>
                </div>
              )}

              <button onClick={saveBulkMove} disabled={moving || selectedMoveIds.length === 0 || moveDate === movingGroup.date}
                className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ opacity: moving || selectedMoveIds.length === 0 || moveDate === movingGroup.date ? 0.45 : 1 }}>
                {moving ? 'Moving…' : destinationItems.length > 0 ? `Move ${selectedMoveIds.length} item${selectedMoveIds.length === 1 ? '' : 's'} anyway` : `Move ${selectedMoveIds.length} item${selectedMoveIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Mini-budget cap modal */}
      {showCap && (
        <div className="modal-scrim" onClick={() => setShowCap(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>{meta.name} cap</h2>
                <button onClick={() => setShowCap(false)} aria-label="Close" style={{ ...editBtnStyle, width: 36, height: 36, fontSize: 14 }}>✕</button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--n350)' }}>A monthly cap for this bucket. Leave blank to remove it.</p>
              <div className="flex items-center rounded-xl px-4 py-3 mb-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-base mr-2" style={{ color: 'var(--n350)' }}>৳</span>
                <input type="number" min="0" step="1" value={capVal} onChange={e => setCapVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveCap()} placeholder="No cap" autoFocus
                  className="flex-1 text-base font-semibold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
              </div>
              <button onClick={saveCap} className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function fmtDate(key) {
  if (!key || key === 'no-date') return 'Undated'
  const d = parseKey(key)
  const today = dayKey(new Date())
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const wd = d.toLocaleDateString('en-US', { weekday: 'long' })
  return key === today ? `Today · ${md}` : `${md} · ${wd}`
}

const BILL_ICON = {
  Electricity: 'bolt', Water: 'droplet', Gas: 'flame', Internet: 'globe',
  Phone: 'phone', 'One-off': 'sparkle', Other: 'receipt',
}
function typeEmoji(bucket, name) {
  if (bucket === 'bills' && BILL_ICON[name]) return <Icon name={BILL_ICON[name]} size={15} />
  return null
}
