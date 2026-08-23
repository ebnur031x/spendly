import Icon from '../components/icons'
import { supabase } from './supabase'

/* ══════════════════════════════════════════════════════════════════
   The four buckets. Every expense/commitment nets against the ONE main
   monthly budget, but each bucket has its own identity, mini-budget and
   detail screen so bills never distort the daily-spend picture.

   - daily, groceries, bills  → backed by `expenses.bucket`
   - commitments              → backed by `fixed_costs` (templates + monthly
                                 instances); see lib/commitments.js
   ══════════════════════════════════════════════════════════════════ */
export const BUCKETS = [
  {
    key: 'daily',
    name: 'Daily Spend',
    tagline: "Today's choices, today's money.",
    icon: '☕',
    color: '#22c55e',
    blurb: 'Transport, food out, small daily purchases',
  },
  {
    key: 'groceries',
    name: 'Groceries',
    tagline: 'Stock the kitchen, skip the guilt later.',
    icon: '🛒',
    color: '#3b82f6',
    blurb: 'Ingredients and food stock to cook at home',
  },
  {
    key: 'bills',
    name: 'Bills',
    tagline: 'The stuff that just happens. Log it when it lands.',
    icon: '🧾',
    color: '#f59e0b',
    blurb: 'Electricity, water, gas, internet & one-offs',
  },
  {
    key: 'commitments',
    name: 'Commitments',
    tagline: 'The knowns — rent, fees. Locked in, but yours to adjust.',
    icon: '🏦',
    color: '#a855f7',
    blurb: 'Rent, tuition — auto-reserved each month',
  },
]

export const BUCKET_KEYS = BUCKETS.map(b => b.key)

// Icon rendering has moved off the stored `icon` string (was a raw emoji
// character, still saved to bucket_settings for backward compatibility)
// onto the fixed 4-key set below, resolved to the shared <Icon> component —
// see src/components/icons.jsx. Buckets aren't user-creatable, so keying
// off `key` rather than the DB value is safe and sidesteps any migration.
export const BUCKET_ICON_NAME = {
  daily: 'coins',
  groceries: 'basket',
  bills: 'receipt',
  commitments: 'bank',
}

export const bucketMeta = (key) => {
  const b = BUCKETS.find(x => x.key === key) ?? BUCKETS[0]
  // Icon(...) rather than JSX — this file stays plain .js, and a direct
  // call produces the exact same element JSX would.
  return { ...b, icon: Icon({ name: BUCKET_ICON_NAME[b.key] }) }
}

// Palette offered when a user recolors a bucket.
export const BUCKET_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899',
  '#14b8a6', '#ef4444', '#6366f1', '#f97316', '#0ea5e9',
]

export function listBucketSettings(userId) {
  return supabase.from('bucket_settings').select('*').eq('user_id', userId)
}

// Ensure a settings row exists for each of the four buckets. Inserts only the
// missing ones (never clobbers a user's edits), so it's safe to call on every
// load. Returns the full, ordered list keyed by bucket.
export async function ensureBucketSettings(userId) {
  const { data, error } = await listBucketSettings(userId)
  if (error) return { data: [], error }
  const have = new Set((data ?? []).map(r => r.bucket))
  const missing = BUCKETS.filter(b => !have.has(b.key))
  if (missing.length > 0) {
    const rows = missing.map(b => ({
      user_id: userId,
      bucket: b.key,
      mini_budget: null,
      cap_period: 'monthly',
      icon: b.icon,
      color: b.color,
    }))
    const { data: inserted, error: insErr } = await supabase
      .from('bucket_settings').insert(rows).select()
    if (insErr) return { data: data ?? [], error: insErr }
    return { data: [...(data ?? []), ...(inserted ?? [])], error: null }
  }
  return { data, error: null }
}

export function updateBucketSetting(id, patch) {
  return supabase.from('bucket_settings').update(patch).eq('id', id).select().single()
}

// Merge stored settings onto the static meta so callers always get a complete
// object (name/tagline/blurb from code, icon/color/mini_budget from the row).
export function bucketView(key, settingsByBucket = {}) {
  const meta = bucketMeta(key)
  const s = settingsByBucket[key] ?? {}
  return {
    ...meta,
    settingsId: s.id ?? null,
    icon: s.icon ?? meta.icon,
    color: s.color ?? meta.color,
    miniBudget: s.mini_budget != null ? Number(s.mini_budget) : null,
    capPeriod: s.cap_period ?? 'monthly',
  }
}

// Index a settings list by bucket key.
export function indexSettings(rows = []) {
  const map = {}
  for (const r of rows) map[r.bucket] = r
  return map
}
