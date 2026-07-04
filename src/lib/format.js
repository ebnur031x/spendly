// Shared money formatting. Always pair with `tabular-nums` in the UI so
// figures don't shift width as they count up.
const TAKA = '৳'

// ৳1,234.50
export function money(n) {
  return `${TAKA}${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ৳1,235 — no decimals, for big/at-a-glance figures
export function money0(n) {
  return `${TAKA}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
