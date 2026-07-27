import { supabase } from './supabase'
import { getCategoryMeta } from './categories'

/* ══════════════════════════════════════════════════════════════════
   Unified, read-only view across all four buckets — for browsing only.
   Does NOT feed any balance/budget math (that stays per-bucket in
   lib/budget.js / lib/bucketMath.js). Flattens three different sources
   into one shape: { id, date, title, amount, bucket, categoryLabel, source }
   ══════════════════════════════════════════════════════════════════ */

export async function loadAllTransactions(userId) {
  const [expRes, logRes, commitRes] = await Promise.all([
    supabase.from('expenses').select('id,date,title,amount,bucket,category,category_name,created_at')
      .eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('daily_logs').select('id,date,day_type_id,expenses')
      .eq('user_id', userId).order('date', { ascending: false }),
    // Commitments = every materialized instance across time (month IS NOT NULL).
    supabase.from('fixed_costs').select('id,name,amount,color,month,due_date')
      .eq('user_id', userId).not('month', 'is', null).order('month', { ascending: false }),
  ])
  const error = expRes.error || logRes.error || commitRes.error
  if (error) return { data: [], error }

  const items = []

  for (const e of expRes.data ?? []) {
    const meta = getCategoryMeta(e.category_name || e.category)
    items.push({
      id: `exp-${e.id}`, date: e.date, title: e.title, amount: Number(e.amount) || 0,
      bucket: e.bucket || 'daily', categoryLabel: e.category_name || meta.label, source: 'expense',
    })
  }

  for (const l of logRes.data ?? []) {
    const raw = Array.isArray(l.expenses) ? l.expenses : []
    raw.filter(it => it.label && Number(it.amount) > 0 && !/descr|note/i.test(it.label || ''))
      .forEach((it, i) => {
        items.push({
          id: `log-${l.id}-${i}`, date: l.date, title: it.label, amount: Number(it.amount) || 0,
          bucket: 'daily', categoryLabel: 'Log Today', source: 'log',
        })
      })
  }

  for (const c of commitRes.data ?? []) {
    items.push({
      id: `commit-${c.id}`, date: c.due_date || `${c.month}-01`, title: c.name, amount: Number(c.amount) || 0,
      bucket: 'commitments', categoryLabel: 'Commitment', source: 'commitment',
    })
  }

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return { data: items, error: null }
}
