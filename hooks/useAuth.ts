import { useState, useEffect } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useWaffleStore } from '../store/useWaffleStore'
import { ProfileService, type Profile } from '../lib/profile-service'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    profileLoading: false,
  })
  
  const setCurrentUser = useWaffleStore((state) => state.setCurrentUser)

  useEffect(() => {
    // Helper function to handle user session and profile
    async function handleUserSession(session: Session | null) {
      if (session?.user) {
        console.log('🔍 User authenticated, fetching/creating profile...')
        
        // Set auth state with loading profile
        setAuthState(prev => ({
          ...prev,
          session,
          user: session.user,
          loading: false,
          profileLoading: true,
        }))

        // Get or create profile
        const { data: profile, error } = await ProfileService.getOrCreateProfile(session.user)
        
        if (profile) {
          console.log('✅ Profile ready:', profile)
          
          // Update auth state with profile
          setAuthState(prev => ({
            ...prev,
            profile,
            profileLoading: false,
          }))

          // Update Zustand store with complete user info
          setCurrentUser({
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar_url || '',
            email: session.user.email || '',
          })
        } else {
          console.error('❌ Failed to create/fetch profile:', error)
          setAuthState(prev => ({
            ...prev,
            profileLoading: false,
          }))
        }
      } else {
        // No session - clear everything
        setAuthState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          profileLoading: false,
        })
        setCurrentUser(null)
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setCurrentUser])

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true }))
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setAuthState(prev => ({ ...prev, loading: false }))
    }
    // Success case will be handled by onAuthStateChange
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
    if (error || !data.session) {
      setAuthState(prev => ({ ...prev, loading: false }))
    }
    // Success case will be handled by onAuthStateChange
    return { data, error }
  }

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))
    const { error } = await supabase.auth.signOut()
    // onAuthStateChange will handle clearing the state
    return { error }
  }

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    // Helper methods
    isAuthenticated: !!authState.session,
    hasProfile: !!authState.profile,
    isReady: !authState.loading && !authState.profileLoading,
  }
} 