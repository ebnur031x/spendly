import { supabase } from './supabase'
import { monthKey, daysInMonth } from './dates'

/* ══════════════════════════════════════════════════════════════════
   Commitments — predictable, known-in-advance costs (rent, tuition).

   Powered by the existing `fixed_costs` table:
     • template  → month IS NULL      (the standing definition, "Rent ৳8000")
     • instance  → month = 'YYYY-MM'  (the materialized entry for that month)

   Materializing a template into a given month's instance is a deliberate,
   user-triggered action (tapping "Add" on a suggestion) — NOT automatic.
   A month starts with zero instances even if templates exist, so "spent"
   never includes a commitment you haven't actually reserved yet. The
   instance is a plain, fully-editable/deletable row once created — the
   template only provides the default. The budget counts instances for the
   current month only — templates are never summed directly.
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

// Active templates that don't yet have an instance for `month` — offered as
// "Add" suggestions rather than silently materialized. Nothing here has been
// written to `fixed_costs`, so none of it counts toward "spent" yet.
export async function listSuggestedCommitments(userId, month = monthKey()) {
  const [tplRes, instRes] = await Promise.all([
    listCommitmentTemplates(userId),
    listCommitmentInstances(userId, month),
  ])
  if (tplRes.error) return { data: [], error: tplRes.error }
  if (instRes.error) return { data: [], error: instRes.error }

  const templates = tplRes.data ?? []
  const materializedTemplateIds = new Set(
    (instRes.data ?? []).map(i => i.template_id).filter(Boolean),
  )
  const suggested = templates.filter(t => !materializedTemplateIds.has(t.id))
  return { data: suggested, error: null }
}

// User tapped "Add" on a suggested template: materialize it into this
// month's instance. Guards against a double-tap creating two rows for the
// same template+month.
export async function addCommitmentInstance(userId, template, month = monthKey()) {
  const { data: existing } = await supabase.from('fixed_costs').select('*')
    .eq('user_id', userId).eq('template_id', template.id).eq('month', month).maybeSingle()
  if (existing) return { data: existing, error: null }

  const { data, error } = await supabase.from('fixed_costs').insert({
    user_id: userId,
    name: template.name,
    amount: template.amount,
    color: template.color,
    month,
    template_id: template.id,
    due_date: instanceDate(month, template.due_date),
    recurrence: 'none',
    active: true,
  }).select().single()
  if (error) return { data: null, error }

  await supabase.from('fixed_costs').update({ last_generated_month: month }).eq('id', template.id)
  return { data, error: null }
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
