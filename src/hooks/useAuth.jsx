import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchPerfil(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(session?.user ?? null)
      if (session?.user) fetchPerfil(session.user.id)
      else { setPerfil(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchPerfil(userId) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', userId).single()
    setPerfil(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password, nombre) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre } }
    })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function enviarRecuperacion(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error }
  }

  async function cambiarPassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecovery(false)
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user, perfil, loading, recovery,
      signIn, signUp, signOut,
      enviarRecuperacion, cambiarPassword
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
