'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User as SupabaseAuthUser } from '@supabase/supabase-js'
import type { User } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { toAbsoluteUrl } from '@/lib/site-url'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signInWithOAuth: (provider: 'google' | 'facebook' | 'github') => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateUserProfile: (updates: Partial<User>) => void
  isAdmin: boolean
  isModerator: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithOAuth: async () => ({ error: null }),
  signOut: async () => {},
  updateUserProfile: () => {},
  isAdmin: false,
  isModerator: false,
})

function buildFallbackUser(authUser: SupabaseAuthUser): User {
  const email = authUser.email || ''
  const metadataName =
    authUser.user_metadata?.name ||
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.user_name

  return {
    id: authUser.id,
    email,
    name: metadataName || email.split('@')[0] || 'User',
    role: 'client',
    avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
    created_at: authUser.created_at || new Date().toISOString(),
  }
}

async function syncUserProfile(
  authUser: SupabaseAuthUser,
  setUser: Dispatch<SetStateAction<User | null>>,
  setLoading: Dispatch<SetStateAction<boolean>>
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    if (error) {
      console.error('Database error fetching user:', error)
      setUser(buildFallbackUser(authUser))
      return
    }

    if (!data) {
      console.warn('User profile not found in public.users table. This usually means the SQL trigger was not active when you signed up.')
      setUser(buildFallbackUser(authUser))
    } else {
      setUser(data)
    }
  } catch (error) {
    console.error('Unexpected error fetching user:', error)
    setUser(buildFallbackUser(authUser))
  } finally {
    setLoading(false)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUserProfile(session.user, setUser, setLoading)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await syncUserProfile(session.user, setUser, setLoading)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: toAbsoluteUrl('/auth/callback'),
      },
    })
    return { error: error?.message || null }
  }

  async function signInWithOAuth(provider: 'google' | 'facebook' | 'github') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: toAbsoluteUrl('/auth/callback'),
      },
    })
    return { error: error?.message || null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  function updateUserProfile(updates: Partial<User>) {
    setUser(prev => (prev ? { ...prev, ...updates } : prev))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithOAuth,
        signOut,
        updateUserProfile,
        isAdmin: user?.role === 'admin',
        isModerator: user?.role === 'admin' || user?.role === 'moderator',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
