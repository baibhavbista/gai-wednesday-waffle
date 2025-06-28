import { useState, useEffect } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useWaffleStore } from '../store/useWaffleStore'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  })
  
  const setCurrentUser = useWaffleStore((state) => state.setCurrentUser)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        session,
        user: session?.user ?? null,
        loading: false,
      })
      
      // Update Zustand store with user info
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Unknown',
          avatar: session.user.user_metadata?.avatar_url || '',
          email: session.user.email || '',
        })
      } else {
        setCurrentUser(null)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({
        session,
        user: session?.user ?? null,
        loading: false,
      })
      
      // Update Zustand store with user info
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Unknown',
          avatar: session.user.user_metadata?.avatar_url || '',
          email: session.user.email || '',
        })
      } else {
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setCurrentUser])

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true }))
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setAuthState(prev => ({ ...prev, loading: false }))
    return { error }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    setAuthState(prev => ({ ...prev, loading: true }))
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    })
    setAuthState(prev => ({ ...prev, loading: false }))
    return { data, error }
  }

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))
    const { error } = await supabase.auth.signOut()
    setAuthState(prev => ({ ...prev, loading: false }))
    return { error }
  }

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
  }
} 