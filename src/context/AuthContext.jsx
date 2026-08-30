import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // A failed or stalled auth startup used to leave the whole landing page
    // blank forever. Session restoration is normally local and immediate, but
    // mobile connections can still interrupt it while Safari is resuming.
    let fallbackTimer

    const finishLoading = (session = null) => {
      if (!active) return
      window.clearTimeout(fallbackTimer)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    fallbackTimer = window.setTimeout(() => finishLoading(), 4000)

    supabase.auth.getSession()
      .then(({ data: { session } }) => finishLoading(session))
      .catch(() => finishLoading())

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      active = false
      window.clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
