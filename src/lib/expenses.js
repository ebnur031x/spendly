import { supabase } from './supabase'

// Insert expense rows resiliently. `mode_id` and `category_name` are both
// "one-time setup" columns (see BUDGET_SETUP_SQL in Dashboard.jsx) that may
// not exist yet on a given user's table — if Postgres rejects the insert
// because one is missing, strip just that key and retry rather than
// blocking the core "log an expense" flow. Handles either column missing,
// both missing, or neither.
export async function insertExpenses(rows) {
  let currentRows = rows
  let remainingKeys = ['mode_id', 'category_name']
  for (let attempt = 0; attempt <= 2; attempt++) {
    const { data, error } = await supabase.from('expenses').insert(currentRows).select()
    if (!error) return { data, error: null }
    const missingKey = remainingKeys.find(k => new RegExp(k, 'i').test(error.message || ''))
    if (!missingKey) return { data: null, error }
    remainingKeys = remainingKeys.filter(k => k !== missingKey)
    currentRows = currentRows.map(({ [missingKey]: _drop, ...rest }) => rest)
  }
  return { data: null, error: new Error('Could not save expense') }
}
