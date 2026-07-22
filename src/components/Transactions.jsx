import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { money0 } from '../lib/format'
import { getCategoryMeta } from '../lib/categories'
import CategoryPill from './CategoryPill'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'uni', label: 'Uni' },
  { id: 'normal', label: 'Normal' },
  { id: 'occasional', label: 'Occasional' },
  { id: 'fixed', label: 'Fixed' },
]

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2L12 4.5L4.5 12H2V9.5L9.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4H12M4.5 4V2.5H9.5V4M3.5 4L4.5 11.5H9.5L10.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ActionIcon({ onClick, title, danger, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none',
        border: 'none',
        padding: '3px',
        borderRadius: 5,
        cursor: 'pointer',
        color: hov ? (danger ? '#f87171' : '#e2e8f0') : '#8b949e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.1s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export default function Transactions({ monthExpenses, dailyLogs, fixedCosts, dayTypes, onRefresh }) {
  const [tab, setTab] = useState('all')
  const [hoveredKey, setHoveredKey] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [busy, setBusy] = useState(false)

  // On touch devices there's no hover, so always show the action icons.
  const isTouchDevice = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches, [])

  function getItems() {
    let logs = dailyLogs
    if (tab !== 'all') {
      const typeId = dayTypes.find(dt => dt.slug === tab)?.id
      logs = typeId ? dailyLogs.filter(l => l.day_type_id === typeId) : []
    }

    const items = []

    for (const log of logs) {
      const dt = dayTypes.find(d => d.id === log.day_type_id)
      const rawExps = Array.isArray(log.expenses) ? log.expenses : []
      const exps = rawExps.filter(e => e.label && Number(e.amount) > 0)
      if (exps.length > 0) {
        exps.forEach((exp, i) => {
          // rawIdx is the index inside log.expenses (may differ from i when
          // optional zero-amount fields precede this one in the JSONB array).
          const rawIdx = rawExps.indexOf(exp)
          items.push({
            key: `log-${log.id}-r${rawIdx}`,
            name: exp.label,
            amount: exp.amount,
            date: log.date || '',
            tagLabel: dt?.name,
            tagColor: dt?.color,
            tagSlug: dt?.slug,
            indent: true,
            type: 'log',
            logId: log.id,
            rawExpIndex: rawIdx,
            logRawExps: rawExps,
          })
        })
      } else {
        items.push({
          key: `log-${log.id}`,
          name: dt?.name ?? 'Day log',
          amount: log.total_spent,
          date: log.date || '',
          tagLabel: dt?.name,
          tagColor: dt?.color,
          tagSlug: dt?.slug,
          type: 'log-whole',
          logId: log.id,
        })
      }
    }

    if (tab === 'all') {
      for (const e of monthExpenses) {
        const meta = getCategoryMeta(e.category)
        items.push({
          key: `exp-${e.id}`,
          name: e.title,
          amount: e.amount,
          date: e.date || '',
          tagLabel: e.category_name || meta.label,
          tagColor: meta.color,
          type: 'expense',
          expId: e.id,
        })
      }
    }

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return items
  }

  function groupByDate(items) {
    const groups = []
    const map = new Map()
    for (const item of items) {
      const d = item.date || 'no-date'
      if (!map.has(d)) {
        const g = { date: d, items: [] }
        map.set(d, g)
        groups.push(g)
      }
      map.get(d).items.push(item)
    }
    return groups
  }

  function fmtDate(key) {
    if (!key || key === 'no-date') return 'Unknown date'
    const [y, m, d] = key.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const md = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const wd = dt.toLocaleDateString('en-US', { weekday: 'long' })
    return `${md} · ${wd}`
  }

  const groupTotal = (group) => group.items.reduce((s, it) => s + (Number(it.amount) || 0), 0)

  async function handleDelete() {
    if (!confirm || busy) return
    const item = confirm
    setBusy(true)
    if (item.type === 'log') {
      // Remove this expense from the JSONB array.
      const newExps = item.logRawExps.filter((_, i) => i !== item.rawExpIndex)
      const remaining = newExps.filter(e => e.label && Number(e.amount) > 0)
      if (remaining.length === 0) {
        // No meaningful expenses left — delete the whole log row.
        await supabase.from('daily_logs').delete().eq('id', item.logId)
      } else {
        const newTotal = newExps.reduce((s, e) => s + (Number(e.amount) || 0), 0)
        await supabase.from('daily_logs')
          .update({ expenses: newExps, total_spent: newTotal })
          .eq('id', item.logId)
      }
    } else if (item.type === 'log-whole') {
      await supabase.from('daily_logs').delete().eq('id', item.logId)
    } else if (item.type === 'expense') {
      await supabase.from('expenses').delete().eq('id', item.expId)
    }
    setBusy(false)
    setConfirm(null)
    onRefresh?.()
  }

  function openEdit(item) {
    setEditing(item)
    setEditName(item.name)
    setEditAmount(String(item.amount))
  }

  async function handleSaveEdit() {
    if (!editing || busy) return
    const newAmt = parseFloat(editAmount)
    if (!(newAmt > 0)) return
    if (editing.type !== 'log-whole' && !editName.trim()) return
    setBusy(true)
    if (editing.type === 'log') {
      const newExps = editing.logRawExps.map((e, i) =>
        i === editing.rawExpIndex
          ? { ...e, label: editName.trim(), amount: newAmt }
          : e
      )
      const newTotal = newExps.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      await supabase.from('daily_logs')
        .update({ expenses: newExps, total_spent: newTotal })
        .eq('id', editing.logId)
    } else if (editing.type === 'log-whole') {
      await supabase.from('daily_logs')
        .update({ total_spent: newAmt })
        .eq('id', editing.logId)
    } else if (editing.type === 'expense') {
      await supabase.from('expenses')
        .update({ title: editName.trim(), amount: newAmt })
        .eq('id', editing.expId)
    }
    setBusy(false)
    setEditing(null)
    onRefresh?.()
  }

  const iconsVisible = (key) => isTouchDevice || hoveredKey === key
  const canSave = editing &&
    (editing.type === 'log-whole' || editName.trim()) &&
    parseFloat(editAmount) > 0

  const isFixed = tab === 'fixed'
  const items = isFixed ? [] : getItems()
  const groups = isFixed ? [] : groupByDate(items)

  return (
    <div className="card p-6">
      {/* Delete confirm modal */}
      {confirm && (
        <div className="modal-scrim" onClick={() => !busy && setConfirm(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-base font-bold mb-1.5" style={{ color: 'var(--n900)' }}>Delete this entry?</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--n400)' }}>
                {confirm.name} &mdash; {money0(confirm.amount)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  disabled={busy}
                  className="btn-soft flex-1 py-2.5 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: '#7f1d1d', color: '#fca5a5',
                    border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="modal-scrim" onClick={() => !busy && setEditing(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-extrabold" style={{ color: 'var(--n900)', letterSpacing: '-0.02em' }}>
                  Edit entry
                </h2>
                <button
                  onClick={() => setEditing(null)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--n400)', border: '1px solid var(--border-2)' }}
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-3 mb-4">
                {editing.type !== 'log-whole' && (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Name"
                    autoFocus
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1.5px solid var(--border-2)',
                      color: 'var(--n900)',
                      outline: 'none',
                    }}
                  />
                )}
                <div
                  className="flex items-center rounded-xl px-4"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', height: 46 }}
                >
                  <span className="text-base mr-2" style={{ color: 'var(--n350)' }}>৳</span>
                  <input
                    type="number" min="1" step="1"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                    placeholder="0"
                    autoFocus={editing.type === 'log-whole'}
                    className="flex-1 text-sm font-semibold tabular-nums"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--n900)' }}
                  />
                </div>
              </div>
              <button
                onClick={handleSaveEdit}
                disabled={!canSave || busy}
                className="btn-ink w-full py-2.5 rounded-xl text-sm font-semibold"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <h2 style={{
        fontSize: '0.7rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--n500)', marginBottom: '0.9rem',
      }}>
        Transactions
      </h2>

      {/* Tab pills */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex', gap: 4, overflowX: 'auto',
          WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap',
          marginBottom: '1.1rem',
        }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0,
              fontSize: '0.8rem',
              fontWeight: 500,
              padding: '0.3rem 0.8rem',
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              background: tab === t.id ? 'var(--border-2)' : 'transparent',
              color: tab === t.id ? 'var(--n900)' : 'var(--n400)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Fixed tab — no edit/delete (managed via Fixed costs card) */}
      {isFixed && (
        fixedCosts.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--n350)', fontStyle: 'italic', padding: '0.75rem 0' }}>
            No fixed costs added yet
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {fixedCosts.map((fc, i) => (
              <li
                key={fc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.6rem 0',
                  borderTop: i > 0 ? '1px solid var(--hairline)' : 'none',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: fc.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--n700)' }}>{fc.name}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--n900)', fontVariantNumeric: 'tabular-nums' }}>
                  −{money0(fc.amount)}
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Date-grouped tabs */}
      {!isFixed && (
        groups.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--n350)', fontStyle: 'italic', padding: '0.75rem 0' }}>
            Nothing logged yet
          </p>
        ) : (
          <div>
            {groups.map((group, gi) => (
              <div key={group.date}>
                {gi > 0 && (
                  <div style={{ height: 1, background: '#21262d', margin: '0.6rem 0 0.7rem' }} />
                )}
                {/* Date header */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: '0.4rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--n350)', letterSpacing: '0.02em' }}>
                    {fmtDate(group.date)}
                  </p>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--n400)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {money0(groupTotal(group))}
                  </span>
                </div>
                {group.items.map(item => (
                  <div
                    key={item.key}
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '0.45rem 0',
                      paddingLeft: item.indent ? 14 : 0,
                    }}
                  >
                    {item.tagLabel && (
                      <CategoryPill
                        label={item.tagLabel}
                        color={item.tagColor}
                        slug={item.tagSlug}
                        maxWidth={120}
                      />
                    )}
                    <span style={{
                      flex: 1, fontSize: '0.875rem', fontWeight: 500,
                      color: 'var(--n800)', minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.name}
                    </span>
                    <span style={{
                      fontSize: '0.875rem', fontWeight: 600,
                      color: 'var(--n900)', flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      −{money0(item.amount)}
                    </span>
                    {/* Edit / delete icons — hover-revealed on desktop, always shown on touch */}
                    <span
                      style={{
                        display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center',
                        opacity: iconsVisible(item.key) ? 1 : 0,
                        transition: 'opacity 0.12s',
                        pointerEvents: iconsVisible(item.key) ? 'auto' : 'none',
                      }}
                    >
                      <ActionIcon onClick={() => openEdit(item)} title="Edit">
                        <IconEdit />
                      </ActionIcon>
                      <ActionIcon onClick={() => setConfirm(item)} title="Delete" danger>
                        <IconTrash />
                      </ActionIcon>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
