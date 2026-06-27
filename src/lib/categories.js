export const CATEGORY_TYPES = {
  fixed:    { label: 'Fixed',    color: '#818cf8', badge: 'rgba(129,140,248,0.12)', emoji: '🏦' },
  variable: { label: 'Variable', color: '#fbbf24', badge: 'rgba(251,191,36,0.12)',  emoji: '🛒' },
  oneoff:   { label: 'One-off',  color: '#f472b6', badge: 'rgba(244,114,182,0.12)', emoji: '⚡' },
}

export const CATEGORIES = [
  { name: 'Rent',          type: 'fixed',    emoji: '🏠' },
  { name: 'Gym',           type: 'fixed',    emoji: '💪' },
  { name: 'Subscriptions', type: 'fixed',    emoji: '📦' },
  { name: 'Insurance',     type: 'fixed',    emoji: '🛡️' },
  { name: 'Utilities',     type: 'fixed',    emoji: '⚡' },
  { name: 'Food',          type: 'variable', emoji: '🍜' },
  { name: 'Transport',     type: 'variable', emoji: '🚌' },
  { name: 'Shopping',      type: 'variable', emoji: '🛍️' },
  { name: 'Entertainment', type: 'variable', emoji: '🎬' },
  { name: 'Health',        type: 'variable', emoji: '❤️' },
  { name: 'Travel',        type: 'oneoff',   emoji: '✈️' },
  { name: 'Medical',       type: 'oneoff',   emoji: '🏥' },
  { name: 'Gifts',         type: 'oneoff',   emoji: '🎁' },
  { name: 'Home',          type: 'oneoff',   emoji: '🏡' },
  { name: 'Other',         type: 'oneoff',   emoji: '📌' },
]

export function getCategoryMeta(name) {
  if (CATEGORY_TYPES[name]) return { name, type: name, ...CATEGORY_TYPES[name] }
  const cat = CATEGORIES.find(c => c.name === name) ?? { name, type: 'oneoff', emoji: '📌' }
  return { ...cat, ...CATEGORY_TYPES[cat.type] }
}
