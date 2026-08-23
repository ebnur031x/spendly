import Icon from '../components/icons'

// Icon(...) rather than JSX — this file stays plain .js; a direct call
// produces the exact same element JSX would.
const icon = (name) => Icon({ name })

export const CATEGORY_TYPES = {
  fixed:    { label: 'Fixed',    color: '#1e3a5f', badge: 'rgba(30,58,95,0.25)',   emoji: icon('bank') },
  variable: { label: 'Variable', color: '#334155', badge: 'rgba(51,65,85,0.25)',   emoji: icon('basket') },
  oneoff:   { label: 'One-off',  color: '#3b1f2b', badge: 'rgba(59,31,43,0.25)',   emoji: icon('bolt') },
}

export const CATEGORIES = [
  { name: 'Rent',          type: 'fixed',    emoji: icon('home') },
  { name: 'Gym',           type: 'fixed',    emoji: icon('gym') },
  { name: 'Subscriptions', type: 'fixed',    emoji: icon('package') },
  { name: 'Insurance',     type: 'fixed',    emoji: icon('shield') },
  { name: 'Utilities',     type: 'fixed',    emoji: icon('bolt') },
  { name: 'Food',          type: 'variable', emoji: icon('bowl') },
  { name: 'Transport',     type: 'variable', emoji: icon('bus') },
  { name: 'Shopping',      type: 'variable', emoji: icon('bag') },
  { name: 'Entertainment', type: 'variable', emoji: icon('film') },
  { name: 'Health',        type: 'variable', emoji: icon('heart') },
  { name: 'Travel',        type: 'oneoff',   emoji: icon('plane') },
  { name: 'Medical',       type: 'oneoff',   emoji: icon('medical') },
  { name: 'Gifts',         type: 'oneoff',   emoji: icon('gift') },
  { name: 'Home',          type: 'oneoff',   emoji: icon('couch') },
  { name: 'Other',         type: 'oneoff',   emoji: icon('pin') },
]

export function getCategoryMeta(name) {
  if (CATEGORY_TYPES[name]) return { name, type: name, ...CATEGORY_TYPES[name] }
  const cat = CATEGORIES.find(c => c.name === name) ?? { name, type: 'oneoff', emoji: icon('pin') }
  return { ...cat, ...CATEGORY_TYPES[cat.type] }
}
