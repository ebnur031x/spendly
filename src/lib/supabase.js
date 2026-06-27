import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const REMEMBER_KEY = 'spendly.remember'

// Call before signing in to choose how long the session sticks around.
//  true  → persist in localStorage (survives browser restarts, ~30 days)
//  false → keep in sessionStorage only (clears when the browser closes)
export function setRememberMe(remember) {
  try { localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0') } catch {}
}

// Default to remembering unless the user has explicitly opted out.
function shouldRemember() {
  try { return localStorage.getItem(REMEMBER_KEY) !== '0' } catch { return true }
}

// Routes the auth session to localStorage or sessionStorage based on the
// remember-me preference, while always being able to read from either.
const hybridStorage = {
  getItem(key) {
    try { return localStorage.getItem(key) ?? sessionStorage.getItem(key) }
    catch { return null }
  },
  setItem(key, value) {
    try {
      if (shouldRemember()) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    } catch {}
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {}
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: hybridStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
