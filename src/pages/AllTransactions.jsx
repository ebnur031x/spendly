import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { money, money0 } from '../lib/format'
import { dayKey, parseKey, addDays, startOfWeek, monthKey, monthRange, monthName, shiftMonth } from '../lib/dates'
import { loadAllTransactions } from '../lib/transactions'
import { BUCKETS, bucketMeta } from '../lib/buckets'
import Reveal from '../components/Reveal'
import Icon from '../components/icons'

const PRESETS = [
  { key: '7d', label: '7 days' },
  { key: '5d', label: '5 days' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: '14d', label: 'Biweekly' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
]

const MONTH_RE = /^\d{4}-\d{2}$/

// `month` is the month being browsed (?month=), not necessarily the real
// current one — arriving here from an August dashboard used to show July
// because this hardcoded monthKey().
function presetRange(key, month = monthKey()) {
  const today = dayKey(new Date())
  switch (key) {
    case '7d': return { start: dayKey(addDays(new Date(), -6)), end: today }
    case '5d': return { start: dayKey(addDays(new Date(), -4)), end: today }
    case '14d': return { start: dayKey(addDays(new Date(), -13)), end: today }
    case 'week': { const s = startOfWeek(new Date()); return { start: dayKey(s), end: dayKey(addDays(s, 6)) } }
    case 'month': {
      const { start } = monthRange(month)
      const [y, m] = month.split('-').map(Number)
      return { start, end: dayKey(new Date(y, m, 0)) }
    }
    case 'lastMonth': {
      const lastMonth = shiftMonth(month, -1)
      const { start } = monthRange(lastMonth)
      const [y, m] = lastMonth.split('-').map(Number)
      return { start, end: dayKey(new Date(y, m, 0)) }
    }
    default: return { start: null, end: null } // 'all' / 'custom' (custom uses its own inputs)
  }
}

// Every search word must appear somewhere in title or category — a light,
// order-independent "fuzzy" match rather than a strict substring/exact match.
function matchesSearch(item, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = `${item.title} ${item.categoryLabel}`.toLowerCase()
  return words.every(w => hay.includes(w))
}

export default function AllTransactions() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Same ?month= contract as Dashboard / Budget Settings / the deep dive.
  const [searchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKey()

  const [bucketFilter, setBucketFilter] = useState('all')
  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState(dayKey(addDays(new Date(), -30)))
  const [customTo, setCustomTo] = useState(dayKey(new Date()))
  const [search, setSearch] = useState('')

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await loadAllTransactions(user.id)
    if (err) setError(err.message)
    setItems(data)
    setLoading(false)
  }

  const range = useMemo(
    () => preset === 'custom' ? { start: customFrom, end: customTo } : presetRange(preset, month),
    [preset, customFrom, customTo, month],
  )

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (bucketFilter !== 'all' && it.bucket !== bucketFilter) return false
      if (range.start && (it.date || '') < range.start) return false
      if (range.end && (it.date || '') > range.end) return false
      if (!matchesSearch(it, search)) return false
      return true
    })
  }, [items, bucketFilter, range, search])

  const total = useMemo(() => filtered.reduce((s, it) => s + it.amount, 0), [filtered])

  const groups = useMemo(() => {
    const map = new Map()
    for (const it of filtered) {
      const d = it.date || 'no-date'
      if (!map.has(d)) map.set(d, [])
      map.get(d).push(it)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <main className="min-h-screen px-5 sm:px-8 pt-6 sm:pt-10 pb-28 md:pb-10 max-w-2xl mx-auto fade-up frost-page">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.03em' }}>
          All <span className="serif-accent">transactions</span>
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--n350)' }}>
          Every bucket, one list — for browsing only. Your balance is still tracked per bucket.
        </p>
      </div>

      {/* Search */}
      <Reveal>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or category…"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm mb-4"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border-2)', color: 'var(--n900)' }}
        />
      </Reveal>

      {/* Bucket filter */}
      <Reveal delay={20}>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 mb-3">
          <FilterChip label="All" active={bucketFilter === 'all'} onClick={() => setBucketFilter('all')} />
          {BUCKETS.map(b => (
            <FilterChip key={b.key} label={b.name} icon={bucketMeta(b.key).icon} color={b.color}
              active={bucketFilter === b.key} onClick={() => setBucketFilter(b.key)} />
          ))}
        </div>
      </Reveal>

      {/* Date range */}
      <Reveal delay={30}>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 mb-2">
          {PRESETS.map(p => (
            <FilterChip key={p.key}
              label={
                p.key === 'month' && month !== monthKey() ? monthName(month)
                  : p.key === 'lastMonth' && month !== monthKey() ? monthName(shiftMonth(month, -1))
                    : p.label
              }
              active={preset === p.key} onClick={() => setPreset(p.key)} />
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 mb-4">
            <input type="date" value={customFrom} onChange={e => e.target.value && setCustomFrom(e.target.value)}
              className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
            <span className="text-xs" style={{ color: 'var(--n350)' }}>to</span>
            <input type="date" value={customTo} onChange={e => e.target.value && setCustomTo(e.target.value)}
              className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer"
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--n700)' }} />
          </div>
        )}
      </Reveal>

      {/* Summary */}
      <Reveal delay={40}>
        <div className="card px-5 py-4 flex items-center justify-between mb-4">
          <span className="data-mono text-xs" style={{ color: 'var(--n400)' }}>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
          <span className="money-serif text-xl" style={{ color: 'var(--n900)' }}>
            {money0(total)}
          </span>
        </div>
      </Reveal>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>{error}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="card flex justify-center py-16">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-4xl mb-3" style={{ color: 'var(--n300)' }}><Icon name="search" strokeWidth={1.5} /></p>
          <p className="text-sm" style={{ color: 'var(--n350)' }}>Nothing matches these filters.</p>
        </div>
      ) : (
        <Reveal delay={60}>
          <div className="flex flex-col gap-5">
            {groups.map(([date, dayItems]) => {
              const subtotal = dayItems.reduce((s, it) => s + it.amount, 0)
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="eyebrow" style={{ color: 'var(--n400)' }}>{fmtDate(date)}</span>
                    <span className="data-mono text-xs font-semibold" style={{ color: 'var(--n400)' }}>{money0(subtotal)}</span>
                  </div>
                  <div className="card overflow-hidden">
                    <ul>
                      {dayItems.map((it, i) => {
                        const m = bucketMeta(it.bucket)
                        return (
                          <li key={it.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5"
                            style={{ borderBottom: i < dayItems.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg"
                              style={{ backgroundColor: `${m.color}1a` }}>{m.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{it.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-medium" style={{ color: m.color }}>{m.name}</span>
                                {it.categoryLabel && it.categoryLabel !== m.name && (
                                  <span className="text-xs" style={{ color: 'var(--n300)' }}>· {it.categoryLabel}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)' }}>−{money(it.amount)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      )}
    </main>
  )
}

function FilterChip({ label, icon, color, active, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
      style={{
        background: active ? (color ? `${color}20` : 'var(--ink)') : 'var(--surface-2)',
        color: active ? (color ?? 'var(--on-ink)') : 'var(--n500)',
        border: '1.5px solid ' + (active ? (color ? `${color}66` : 'var(--ink)') : 'var(--border-soft)'),
      }}>
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{label}
    </button>
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
