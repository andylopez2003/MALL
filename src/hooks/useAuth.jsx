import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'

const AuthContext = createContext(null)

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), 8000)
    }),
  ])
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      try {
        setAuthError('')
        const { data, error } = await withTimeout(supabase.auth.getSession(), 'No se pudo verificar la sesion.')
        if (error) throw error
        if (mounted) setSession(data.session)
        if (!data.session && mounted) setLoading(false)
      } catch (err) {
        if (mounted) {
          setSession(null)
          setProfile(null)
          setAuthError(err.message)
          setLoading(false)
        }
      }
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthError('')
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (session === undefined) return

      if (!session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      if (profile?.id === session.user.id && profile?.rol === 'admin') {
        setLoading(false)
        return
      }

      try {
        setAuthError('')
        if (profile?.id !== session.user.id) {
          setProfile(null)
          setLoading(true)
        }
        const { data, error } = await withTimeout(
          supabase.from('usuarios').select('*').eq('id', session.user.id).maybeSingle(),
          'No se pudo cargar el perfil de administrador.',
        )
        if (error) throw error
        if (!data || data.rol !== 'admin') throw new Error('Este usuario no tiene permisos de administrador.')
        if (mounted) setProfile(data)
      } catch (err) {
        if (mounted) {
          setProfile(null)
          setAuthError(err.message)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [session?.user?.id, profile?.id, profile?.rol])

  async function login(email, password) {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const value = useMemo(() => ({
    session,
    profile,
    user: profile?.rol === 'admin' ? session?.user : null,
    loading,
    authError,
    login,
    logout,
  }), [session, profile, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
