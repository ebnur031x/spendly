import { supabase } from './supabase'

export function listSavings(userId) {
  return supabase.from('savings').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
}

export function createSaving(userId, { label, amount, notes }) {
  return supabase.from('savings')
    .insert({ user_id: userId, label, amount, notes: notes || null })
    .select().single()
}

export function updateSaving(id, { label, amount, notes }) {
  return supabase.from('savings')
    .update({ label, amount, notes: notes || null })
    .eq('id', id)
    .select().single()
}

export function deleteSaving(id) {
  return supabase.from('savings').delete().eq('id', id)
}
