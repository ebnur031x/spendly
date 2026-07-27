import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { money, money0 } from '../lib/format'
import { dayKey, parseKey, monthKey, monthLabel, daysInMonth } from '../lib/dates'
import { bucketMeta, ensureBucketSettings, updateBucketSetting, indexSettings } from '../lib/buckets'
import { suggestBillType } from '../lib/classify'
import { useBucketRedirect } from '../hooks/useBucketRedirect'
import { insertExpenses } from '../lib/expenses'
import {
  ensureCommitmentsMaterialized, listCommitmentInstances, listCommitmentTemplates,
  addCommitment, updateCommitment, deleteCommitment, stopCommitment,
  nextCommitmentColor, COMMITMENT_COLORS,
} from '../lib/commitments'
import MiniBudgetBar, { resolveCap } from '../components/MiniBudgetBar'
import ColorSwatches from '../components/ColorSwatches'
import BucketRedirectChips from '../components/BucketRedirectChips'
import Reveal from '../components/Reveal'

const meta = bucketMeta('commitments')
const inputStyle = { backgroundColor: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }
const editBtnStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'var(--surface-2)', border: '1.5px solid var(--border-soft)',
  color: 'var(--n500)', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

export default function Commitments() {
  const { user } = useAuth()
  const { toast } = useToast()
  const month = monthKey()

  const [instances, setInstances] = useState([])
  const [templates, setTemplates] = useState([])
  const [setting, setSetting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // add form
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const { target: composerBucket, saveTarget, setTarget: setComposerBucket, reset: resetComposerBucket } = useBucketRedirect(name, 'commitments')
  const [date, setDate] = useState(dayKey(new Date()))
  const [repeats, setRepeats] = useState(true)
  const [color, setColor] = useState(COMMITMENT_COLORS[0])
  const [saving, setSaving] = useState(false)

  // edit / cap
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [showCap, setShowCap] = useState(false)
  const [capVal, setCapVal] = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function load() {
    setLoading(true)
    await ensureCommitmentsMaterialized(user.id, month)
    const [instRes, tplRes, setRes] = await Promise.all([
      listCommitmentInstances(user.id, month),
      listCommitmentTemplates(user.id),
      ensureBucketSettings(user.id),
    ])
    if (instRes.error) setError(instRes.error.message)
    setInstances(instRes.data ?? [])
    setTemplates(tplRes.data ?? [])
    setSetting(indexSettings(setRes.data ?? [])['commitments'] ?? null)
    setColor(nextCommitmentColor(tplRes.data ?? []))
    setLoading(false)
  }

  async function refresh() {
    const [instRes, tplRes] = await Promise.all([
      listCommitmentInstances(user.id, month),
      listCommitmentTemplates(user.id),
    ])
    setInstances(instRes.data ?? [])
    setTemplates(tplRes.data ?? [])
  }

  // A redirect away from Commitments (e.g. typing "milk" here) can't create a
  // commitment — it needs its own repeat/due-date shape — so it saves as a
  // plain expense in the target bucket instead, same as the other composers.
  function buildExpenseRow(targetBucket, amt) {
    const trimmed = name.trim()
    if (targetBucket === 'groceries') {
      return { user_id: user.id, title: trimmed || 'Groceries', amount: amt, category: 'variable', category_name: 'Groceries', bucket: 'groceries', date }
    }
    if (targetBucket === 'bills') {
      const billType = suggestBillType(trimmed)
      return { user_id: user.id, title: trimmed || billType, amount: amt, category: 'oneoff', category_name: billType, bucket: 'bills', date }
    }
    return { user_id: user.id, title: trimmed || 'Expense', amount: amt, category: 'variable', category_name: trimmed || 'Other', bucket: 'daily', date }
  }

  async function handleAdd(e) {
    e?.preventDefault()
    const amt = parseFloat(amount)
    if (!name.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true); setError('')

    if (saveTarget !== 'commitments') {
      const { error: err } = await insertExpenses([buildExpenseRow(saveTarget, amt)])
      setSaving(false)
      if (err) { setError(err.message); return }
      toast({ icon: bucketMeta(saveTarget).icon, message: `Added to ${bucketMeta(saveTarget).name}` })
      setName(''); setAmount('')
      resetComposerBucket()
      return
    }

    const { error: err } = await addCommitment(user.id, {
      name: name.trim(), amount: amt, color, due_date: date, repeats,
    }, month)
    setSaving(false)
    if (err) { setError(err.message); return }
    setName(''); setAmount('')
    setColor(nextCommitmentColor([...templates, { color }]))
    resetComposerBucket()
    refresh()
  }

  function openEdit(inst) {
    setEditing(inst)
    setEditName(inst.name || '')
    setEditAmount(String(inst.amount))
    setEditDate(inst.due_date || `${month}-01`)
  }

  async function saveEdit() {
    if (!editing) return
    const amt = parseFloat(editAmount)
    if (!editName.trim() || !(amt > 0)) return
    const { data, error: err } = await updateCommitment(editing.id, {
      name: editName.trim(), amount: amt, due_date: editDate,
    })
    if (err) setError(err.message)
    else if (data) setInstances(prev => prev.map(i => i.id === editing.id ? data : i))
    setEditing(null)
  }

  async function removeInstance(id) {
    const prev = instances
    setInstances(instances.filter(i => i.id !== id))
    const { error: err } = await deleteCommitment(id)
    if (err) { setError(err.message); setInstances(prev) }
  }

  async function stopRecurring(templateId) {
    await stopCommitment(templateId, month)
    refresh()
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

  const used = useMemo(() => instances.reduce((s, i) => s + Number(i.amount), 0), [instances])
  const miniBudget = setting?.mini_budget != null ? Number(setting.mini_budget) : null
  const { cap, label: capLabel } = resolveCap({ miniBudget, capPeriod: 'monthly' }, daysInMonth(month))
  const color0 = setting?.color ?? meta.color
  const canAdd = !!name.trim() && !!amount && parseFloat(amount) > 0

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up">

      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${color0}22`, fontSize: 21 }}>{setting?.icon ?? meta.icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>{meta.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--n350)' }}>{meta.tagline}</p>
        </div>
      </div>

      {/* Mini-budget */}
      <Reveal>
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>
              Reserved for {monthLabel(month)}
            </span>
            <button onClick={() => { setCapVal(miniBudget != null ? String(miniBudget) : ''); setShowCap(true) }}
              className="btn-soft text-xs px-3 py-1.5 rounded-full font-semibold">
              {miniBudget != null ? 'Edit cap' : 'Set cap'}
            </button>
          </div>
          <MiniBudgetBar used={used} cap={cap} color={color0} note={capLabel} />
        </div>
      </Reveal>

      {/* This month's entries */}
      <Reveal delay={60}>
        <div className="flex items-end justify-between mb-3 px-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--n900)' }}>This month</h2>
          <span className="text-sm tabular-nums" style={{ color: 'var(--n350)' }}>{money0(used)}</span>
        </div>

        {loading ? (
          <div className="card flex justify-center py-16">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
          </div>
        ) : instances.length === 0 ? (
          <div className="card py-14 text-center mb-4">
            <p className="text-4xl mb-3">{meta.icon}</p>
            <p className="text-sm" style={{ color: 'var(--n350)' }}>No commitments reserved this month.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--n300)' }}>Add one below — it auto-reserves each month.</p>
          </div>
        ) : (
          <div className="card overflow-hidden mb-4">
            <ul>
              {instances.map((inst, i) => (
                <li key={inst.id} className="row-hover flex items-center gap-3 px-4 sm:px-5 py-3.5"
                  style={{ borderBottom: i < instances.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: inst.color || color0, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{inst.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs" style={{ color: 'var(--n350)' }}>{inst.due_date ? fmtDate(inst.due_date) : 'This month'}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--surface-2)', color: 'var(--n400)' }}>
                        {inst.template_id ? 'monthly' : 'one-time'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n900)' }}>−{money(inst.amount)}</span>
                    <button onClick={() => openEdit(inst)} title="Edit" style={editBtnStyle}>✎</button>
                    <button onClick={() => removeInstance(inst.id)} className="btn-delete" title="Delete">×</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Reveal>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
          {error}
        </div>
      )}

      {/* Add commitment */}
      <Reveal delay={100}>
        <div className="card mb-4">
          <form onSubmit={handleAdd} className="p-6">
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--n400)', letterSpacing: '0.07em' }}>Add a commitment</p>
            <div className="flex gap-2 mb-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Rent, Tuition)"
                className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm" style={inputStyle} />
              <div className="flex items-center rounded-xl px-3" style={{ width: 130, background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-sm mr-1" style={{ color: 'var(--n350)' }}>৳</span>
                <input type="number" min="0" step="1" value={amount} onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="0"
                  className="w-full text-sm font-semibold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
              </div>
            </div>

            <BucketRedirectChips text={name} target={composerBucket} setTarget={setComposerBucket} homeBucket="commitments" />

            {saveTarget === 'commitments' && (
              <>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Due date</span>
                  <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
                    className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                    style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
                </div>

                <button type="button" onClick={() => setRepeats(v => !v)}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl mb-3 text-left"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-soft)' }}>
                  <span className="w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0"
                    style={{ background: repeats ? color0 : 'var(--border-3)', justifyContent: repeats ? 'flex-end' : 'flex-start' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm font-semibold block" style={{ color: 'var(--n800)' }}>Repeats monthly</span>
                    <span className="text-xs" style={{ color: 'var(--n350)' }}>
                      {repeats ? 'Auto-reserves a fresh entry every month' : 'One-time — this month only'}
                    </span>
                  </span>
                </button>

                <ColorSwatches colors={COMMITMENT_COLORS} value={color} onChange={setColor} className="mb-4" />
              </>
            )}

            <button type="submit" disabled={!canAdd || saving}
              className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold">
              {saving ? 'Adding…' : saveTarget === 'commitments' ? 'Add commitment' : `Add to ${bucketMeta(saveTarget).name}`}
            </button>
          </form>
        </div>
      </Reveal>

      {/* Recurring management */}
      {templates.length > 0 && (
        <Reveal delay={140}>
          <div className="card p-5">
            <h2 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--n500)', letterSpacing: '0.1em' }}>Recurring</h2>
            <ul className="flex flex-col gap-2">
              {templates.map(t => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--n800)' }}>{t.name}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--n700)' }}>{money0(t.amount)}/mo</span>
                  <button onClick={() => stopRecurring(t.id)} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--n400)', cursor: 'pointer' }}>Stop</button>
                </li>
              ))}
            </ul>
            <p className="text-xs mt-3" style={{ color: 'var(--n350)' }}>
              Stopping keeps past history but won't reserve future months. Editing this month's amount above only changes this month.
            </p>
          </div>
        </Reveal>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Edit commitment</h2>
                <button onClick={() => setEditing(null)} aria-label="Close" style={{ ...editBtnStyle, width: 36, height: 36, fontSize: 14 }}>✕</button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--n350)' }}>Changes here apply to {monthLabel(month)} only.</p>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-3" style={inputStyle} autoFocus />
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--n400)', letterSpacing: '0.06em' }}>Due date</span>
                <input type="date" value={editDate} onChange={e => e.target.value && setEditDate(e.target.value)}
                  className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
              </div>
              <div className="flex items-center rounded-2xl px-4 mb-4" style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)' }}>
                <span className="text-2xl font-bold mr-1" style={{ color: 'var(--n300)' }}>৳</span>
                <input type="number" min="0.01" step="1" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  className="w-full py-3 text-3xl font-extrabold tabular-nums"
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }} />
              </div>
              <button onClick={saveEdit} disabled={!editName.trim() || !(parseFloat(editAmount) > 0)}
                className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Cap modal */}
      {showCap && (
        <div className="modal-scrim" onClick={() => setShowCap(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>Commitments cap</h2>
                <button onClick={() => setShowCap(false)} aria-label="Close" style={{ ...editBtnStyle, width: 36, height: 36, fontSize: 14 }}>✕</button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--n350)' }}>An optional monthly ceiling to watch against. Leave blank to remove.</p>
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
  const d = parseKey(key)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
