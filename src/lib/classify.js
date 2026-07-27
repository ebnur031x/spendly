/* ══════════════════════════════════════════════════════════════════
   Keyword-based bucket suggestion. Extends the bill-word guard originally
   built for the Daily composer into a general classifier: given an expense
   title, guess which bucket it really belongs to. Purely a smart default —
   callers always let the user override the suggestion.
   ══════════════════════════════════════════════════════════════════ */

// Rent, tuition, and other fixed monthly commitments — these can't just flip
// a bucket column (Commitments lives in fixed_costs with its own recurrence),
// so callers should redirect to /commitments rather than auto-assign.
const COMMITMENT_RE = /\brent\b|tuition|semester\s*fee|hostel\s*fee|hall\s*fee|\bfee\b|subscription|subscrib|netflix|spotify|\bemi\b|installment|insurance\s*premium/i

// Utility bills and irregular one-offs — the Bills catch-all. Electricity,
// water, gas, and internet (the four bills named in the original spec) match
// as bare standalone words — "gas ৳1000" should suggest Bills on its own,
// not only "gas bill". Phone/mobile still need a qualifier since those words
// alone are too likely to be an unrelated purchase (a new phone, a phone case).
const BILL_RE = /\b(electric(ity)?|water|gas|internet|wi-?fi|broadband|utility|utilities|dpdc|desco|nesco|wasa|titas|bijli|bidyut|current bill|phone bill|mobile bill|recharge)\b/i

// Home food stock — ingredients bought to cook with, not eaten in the moment.
const GROCERY_RE = /milk|yog(h)?urt|\boats?\b|\begg|\brice\b|\boil\b|\batta\b|\bflour\b|vegetable|sabji|sobji|\bchicken\b|\bfish\b|\bmeat\b|grocer|\bbazar\b|\bbazaar\b|\bonion\b|\bpotato\b|\bsugar\b|lentil|\bdal\b|\bspice\b|masala/i

// Returns 'commitments' | 'bills' | 'groceries' | null (null = no suggestion,
// stays wherever the caller defaults to — usually Daily).
export function suggestBucket(title) {
  const t = (title || '').trim()
  if (!t) return null
  if (COMMITMENT_RE.test(t)) return 'commitments'
  if (BILL_RE.test(t)) return 'bills'
  if (GROCERY_RE.test(t)) return 'groceries'
  return null
}

const BILL_TYPE_PATTERNS = [
  [/electric|bijli|bidyut|dpdc|desco|nesco/i, 'Electricity'],
  [/\bwater\b|wasa/i, 'Water'],
  [/\bgas\b|titas/i, 'Gas'],
  [/internet|wi-?fi|broadband/i, 'Internet'],
  [/phone|mobile|recharge/i, 'Phone'],
]

// Best-guess bill type label for a title, for the Bills type chips/icon.
export function suggestBillType(title) {
  const t = title || ''
  for (const [re, label] of BILL_TYPE_PATTERNS) if (re.test(t)) return label
  return 'Other'
}
