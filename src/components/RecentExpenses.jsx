import { Link } from 'react-router-dom'
import { money } from '../lib/format'
import { getCategoryMeta } from '../lib/categories'
import { expenseDay } from '../lib/dates'

// Last 10 rows from the expenses table — title, amount, date, category tag.
export default function RecentExpenses({ expenses }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold" style={{ color: 'var(--n900)' }}>Recent expenses</h2>
        <Link to="/expenses" className="link-ink text-xs">View all →</Link>
      </div>

      {expenses.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
            <Icon name="receipt" size={16} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--n500)' }}>No expenses logged yet</p>
            <Link to="/expenses" className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>Log one →</Link>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col">
          {expenses.map((e, i) => {
            const meta = getCategoryMeta(e.category)
            const tag = e.category_name || meta.label
            return (
              <li key={e.id} className="row-hover flex items-center gap-3 px-2 -mx-2 py-2.5 rounded-xl"
                style={{ borderTop: i > 0 ? '1px solid var(--hairline)' : 'none' }}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                  style={{ background: `${meta.color}1a` }}>
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--n800)' }}>{e.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                      style={{ background: `${meta.color}1a`, color: meta.color }}>{tag}</span>
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--n350)' }}>{formatDay(e)}</span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--n900)' }}>
                  −{money(e.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function formatDay(e) {
  const key = expenseDay(e)
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
