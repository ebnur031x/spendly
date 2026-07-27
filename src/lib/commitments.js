import { supabase } from './supabase'
import { monthKey, daysInMonth } from './dates'

/* ══════════════════════════════════════════════════════════════════
   Commitments — predictable, known-in-advance costs (rent, tuition).

   Powered by the existing `fixed_costs` table:
     • template  → month IS NULL      (the standing definition, "Rent ৳8000")
     • instance  → month = 'YYYY-MM'  (the materialized entry for that month)

   Each month the app auto-reserves by materializing one instance per active
   template. The instance is a plain, fully-editable/deletable row — the
   template only provides the default. Deleting this month's instance does NOT
   respawn it (guarded by the template's last_generated_month); next month
   generates fresh. The budget counts instances for the current month only —
   templates are never summed directly.
   ══════════════════════════════════════════════════════════════════ */

const COLORS = [
  '#a855f7', '#6366f1', '#ec4899', '#f59e0b', '#3b82f6',
  '#22c55e', '#ef4444', '#14b8a6', '#f97316', '#0ea5e9',
]
export const COMMITMENT_COLORS = COLORS

// Active standing templates (the recurring definitions).
export function listCommitmentTemplates(userId) {
  return supabase.from('fixed_costs').select('*')
    .eq('user_id', userId).is('month', null).eq('active', true)
    .order('created_at', { ascending: true })
}

// The materialized entries for a given month (what actually reserves budget).
export function listCommitmentInstances(userId, month = monthKey()) {
  return supabase.from('fixed_costs').select('*')
    .eq('user_id', userId).eq('month', month)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
}

// The date an instance falls on this month, from the template's day-of-month.
function instanceDate(month, templateDueDate) {
  if (!templateDueDate) return null
  const day = Number(String(templateDueDate).slice(8, 10)) || 1
  const clamped = Math.min(day, daysInMonth(month))
  return `${month}-${String(clamped).padStart(2, '0')}`
}

// Collapse concurrent invocations into a single run. React StrictMode
// double-invokes mount effects in dev, and a fast Dashboard→Commitments hop
// can overlap in prod — without this both runs read "no instances yet" before
// either writes, and each materializes a full set (doubling the reservation).
const inFlight = new Map()

// Auto-reserve for `month`: ensure exactly one instance per active template.
// Idempotent and self-healing — safe to call on every load.
export function ensureCommitmentsMaterialized(userId, month = monthKey()) {
  const key = `${userId}:${month}`
  if (inFlight.has(key)) return inFlight.get(key)
  const run = materialize(userId, month).finally(() => inFlight.delete(key))
  inFlight.set(key, run)
  return run
}

async function materialize(userId, month) {
  const [tplRes, instRes] = await Promise.all([
    listCommitmentTemplates(userId),
    listCommitmentInstances(userId, month),
  ])
  if (tplRes.error) return { error: tplRes.error, created: 0, deduped: 0 }

  const templates = tplRes.data ?? []
  let instances = instRes.data ?? []

  // Self-heal: if an earlier racy run left more than one instance for the same
  // template this month, keep the first and delete the rest. (One-time entries
  // carry no template_id and are never treated as duplicates.)
  const keptByTemplate = new Set()
  const dupeIds = []
  for (const inst of instances) {
    if (!inst.template_id) continue
    if (keptByTemplate.has(inst.template_id)) dupeIds.push(inst.id)
    else keptByTemplate.add(inst.template_id)
  }
  let deduped = 0
  if (dupeIds.length > 0) {
    const { error: delErr } = await supabase.from('fixed_costs').delete().in('id', dupeIds)
    if (!delErr) { instances = instances.filter(i => !dupeIds.includes(i.id)); deduped = dupeIds.length }
  }

  const haveTemplateIds = new Set(instances.map(i => i.template_id).filter(Boolean))
  const toCreate = templates.filter(
    t => t.last_generated_month !== month && !haveTemplateIds.has(t.id),
  )
  if (toCreate.length === 0) return { error: null, created: 0, deduped }

  const rows = toCreate.map(t => ({
    user_id: userId,
    name: t.name,
    amount: t.amount,
    color: t.color,
    month,
    template_id: t.id,
    due_date: instanceDate(month, t.due_date),
    recurrence: 'none',
    active: true,
  }))
  const { error: insErr } = await supabase.from('fixed_costs').insert(rows)
  if (insErr) return { error: insErr, created: 0, deduped }

  // Mark each template as generated for this month so a later delete of the
  // instance doesn't cause it to reappear.
  await Promise.all(
    toCreate.map(t =>
      supabase.from('fixed_costs').update({ last_generated_month: month }).eq('id', t.id),
    ),
  )
  return { error: null, created: rows.length, deduped }
}

// Add a commitment. `repeats` → creates a standing template AND this month's
// instance. Otherwise → a one-time instance for this month only.
export async function addCommitment(userId, { name, amount, color, due_date, repeats = true }, month = monthKey()) {
  if (!repeats) {
    return supabase.from('fixed_costs').insert({
      user_id: userId, name, amount, color,
      month, template_id: null, due_date, recurrence: 'none', active: true,
    }).select().single()
  }

  const { data: template, error: tplErr } = await supabase.from('fixed_costs').insert({
    user_id: userId, name, amount, color,
    month: null, recurrence: 'monthly', active: true, due_date,
    last_generated_month: month,
  }).select().single()
  if (tplErr) return { data: null, error: tplErr }

  const { data: instance, error: instErr } = await supabase.from('fixed_costs').insert({
    user_id: userId, name, amount, color,
    month, template_id: template.id, recurrence: 'none', active: true,
    due_date: instanceDate(month, due_date),
  }).select().single()
  return { data: { template, instance }, error: instErr }
}

// Edit a single row (a template's standing values, or one month's instance).
export function updateCommitment(id, patch) {
  return supabase.from('fixed_costs').update(patch).eq('id', id).select().single()
}

// Delete one row. For an instance this removes only that month's entry.
export function deleteCommitment(id) {
  return supabase.from('fixed_costs').delete().eq('id', id)
}

// Stop a recurring commitment without wiping its history: deactivate the
// template and drop the current month's instance so it stops reserving now.
export async function stopCommitment(templateId, month = monthKey()) {
  await supabase.from('fixed_costs').update({ active: false }).eq('id', templateId)
  return supabase.from('fixed_costs').delete()
    .eq('template_id', templateId).eq('month', month)
}

export function nextCommitmentColor(existing = []) {
  const used = new Set(existing.map(c => c.color))
  return COLORS.find(c => !used.has(c)) ?? COLORS[existing.length % COLORS.length]
}
