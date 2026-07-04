import { supabase } from './supabase'
import { monthRange } from './dates'

// A day log records a whole day of spending under one day type. `expenses`
// is a JSONB array of { label, amount }; total_spent is their sum.
export function createDailyLog(userId, { date, day_type_id, expenses, total_spent, notes }) {
  return supabase.from('daily_logs')
    .insert({
      user_id: userId,
      date,
      day_type_id: day_type_id || null,
      expenses,
      total_spent,
      notes: notes || null,
    })
    .select().single()
}

export function listDailyLogsForMonth(userId, month) {
  const { start, end } = monthRange(month)
  return supabase.from('daily_logs').select('*')
    .eq('user_id', userId).gte('date', start).lt('date', end)
    .order('date', { ascending: false })
}

export function deleteDailyLog(id) {
  return supabase.from('daily_logs').delete().eq('id', id)
}
