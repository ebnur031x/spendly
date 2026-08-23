// One small, consistent line-icon set replacing the app's emoji (bucket
// icons, spend categories, bill types, quick-add presets). Same stroke
// recipe everywhere — 1.8 weight, rounded caps/joins, 24x24 — so a
// "professional product" reads as one system instead of a grab-bag of
// platform emoji that render differently per device anyway.
const PATHS = {
  // buckets
  coins: <><ellipse cx="12" cy="7.5" rx="7" ry="3" /><path d="M5 7.5v9c0 1.66 3.13 3 7 3s7-1.34 7-3v-9" /><path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" /></>,
  basket: <><path d="M4 10h16l-1.5 9a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 10Z" /><path d="M8 10 6 4" /><path d="M16 10l2-6" /><path d="M9 14v3" /><path d="M15 14v3" /></>,
  receipt: <><path d="M6 3h12v17l-2.5-1.5L13 20l-2.5-1.5L8 20l-2-1.5V3Z" /><path d="M9 8h6" /><path d="M9 12h6" /></>,
  // Equal-height columns (not the shorter classical inner pair) so the
  // "bank/temple" shape survives shrinking to icon size — short inner
  // columns visually vanished at ~18-21px, leaving what read as a house.
  bank: <><path d="M3 9 12 3 21 9" /><path d="M3 9h18" /><path d="M3 21h18" /><path d="M7 11v8" /><path d="M12 11v8" /><path d="M17 11v8" /></>,

  // categories / general
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  couch: <><path d="M5 12a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3H5v-3Z" /><path d="M5 15v4M19 15v4M6 10V8.5A2.5 2.5 0 0 1 8.5 6h7A2.5 2.5 0 0 1 18 8.5V10" /></>,
  gym: <><rect x="5.5" y="9" width="3" height="6" rx="1" /><rect x="15.5" y="9" width="3" height="6" rx="1" /><path d="M3.5 12h1M19.5 12h1" /><path d="M8.5 12h7" /></>,
  package: <><path d="M21 8.5 12 3.5 3 8.5l9 5 9-5Z" /><path d="M3 8.5v7l9 5 9-5v-7" /><path d="M12 13.5v7" /></>,
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  bus: <><rect x="3" y="6" width="18" height="11" rx="2" /><path d="M3 12h18" /><circle cx="7.5" cy="19" r="1.4" /><circle cx="16.5" cy="19" r="1.4" /></>,
  bag: <><path d="M6.5 7h11l1 13H5.5l1-13Z" /><path d="M9 7V5.5a3 3 0 0 1 6 0V7" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
  heart: <path d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6.4 5.5 5.5 0 0 1 21.5 11c-2.5 4.6-9.5 9-9.5 9Z" />,
  plane: <><path d="M21.5 2.5 10.5 13.5" /><path d="M21.5 2.5 14.7 21.5l-3.7-8.4-8.4-3.7Z" /></>,
  medical: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="1.5" /><path d="M3 8h18M12 8v13" /><path d="M12 8c-2.2 0-3.5-1.4-3.5-3A2.3 2.3 0 0 1 12 8Zm0 0c2.2 0 3.5-1.4 3.5-3A2.3 2.3 0 0 0 12 8Z" /></>,
  pin: <><path d="M12 21s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
  droplet: <path d="M12 2.5s6.2 7 6.2 11.7a6.2 6.2 0 1 1-12.4 0C5.8 9.5 12 2.5 12 2.5Z" />,
  flame: <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-1-1.5-1-3 2 1 3 3 3 5a5 5 0 0 1-10 0c0-4.5 3.2-6.3 5-11Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.4 4 5.7 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.7-4-9s1.4-6.6 4-9Z" /></>,
  phone: <><rect x="7.5" y="2" width="9" height="20" rx="2" /><path d="M11 18h2" /></>,
  sparkle: <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z" />,
  sunrise: <><path d="M3 18h18" /><path d="M6.5 18a5.5 5.5 0 0 1 11 0" /><path d="M12 9V6M6 11 4.5 9.5M18 11l1.5-1.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  sunset: <><path d="M3 18h18" /><path d="M6.5 18a5.5 5.5 0 0 1 11 0" /><path d="M12 6v3M6 9l1.5 1.5M18 9l-1.5 1.5" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  bowl: <><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M7.5 11a4.5 4.5 0 0 1 9 0" /><path d="M12 5.5V3.5" /></>,
  cookie: <><circle cx="12" cy="12" r="9" /><circle cx="9" cy="9.5" r=".9" fill="currentColor" stroke="none" /><circle cx="14.5" cy="9" r=".9" fill="currentColor" stroke="none" /><circle cx="15" cy="13.5" r=".9" fill="currentColor" stroke="none" /><circle cx="9.5" cy="14.5" r=".9" fill="currentColor" stroke="none" /></>,
  coffee: <><path d="M4.5 8h13v6a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5V8Z" /><path d="M17.5 9.2H19a2.3 2.3 0 0 1 0 4.6h-1.5" /><path d="M8 3c0 1-1 1-1 2M12.5 3c0 1-1 1-1 2" /></>,
  utensils: <><path d="M6 2v7a2 2 0 0 0 4 0V2M8 2v20M6 2v5M10 2v5M18 2c-2.2 0-3.5 2.2-3.5 5.5S15.8 12 18 12M18 2v20" /></>,
  cigarette: <><rect x="2" y="10.5" width="15" height="3.5" rx="1" /><path d="M12.5 10.5v3.5" /><path d="M19 8.5c0 1-1 1.3-1 2.5s1 1.5 1 2.5" /><path d="M21.5 8.5c0 1-1 1.3-1 2.5s1 1.5 1 2.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4M16 3v4" /></>,
  check: <path d="M4 12.5 9.5 18 20 6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  school: <><path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" /><path d="M6.5 10.7V16c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-5.3" /><path d="M21.5 8.5v5" /></>,
  briefcase: <><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M2.5 12.5h19" /></>,
  confetti: <><path d="M3.5 20.5 9 7l8 8-13.5 5.5Z" /><path d="M14 3.5v2M19 6l1.5-1.5M18.5 11h2M16.5 7.5 18 6" /></>,
  calculator: <><rect x="4.5" y="2.5" width="15" height="19" rx="2" /><path d="M8 6.5h8" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" /></>,
}

// Default size is 1em on purpose: every call site that used to hold a
// plain emoji character controlled its size via the surrounding
// font-size (fontSize: 15, text-4xl, etc.) — an em-sized icon inherits
// that same context for free, so none of those wrapper styles need to
// change just because the character became an SVG.
export default function Icon({ name, size = '1em', strokeWidth = 1.8, style, ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...rest}
    >
      {d}
    </svg>
  )
}
