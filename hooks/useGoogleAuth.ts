import { useState } from 'react'
import { Platform } from 'react-native'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../lib/supabase'

// This is required for the OAuth flow to work properly in Expo
WebBrowser.maybeCompleteAuthSession()

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false)

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      
      // Create the redirect URI for OAuth callback
      let redirectTo: string
      
      if (Platform.OS === 'web') {
        // For web, use the current origin + callback path
        redirectTo = `${window.location.origin}/auth/callback`
      } else {
        // For mobile, use deep link scheme
        redirectTo = makeRedirectUri({
          scheme: 'wednesday-waffle',
          path: '/auth/callback'
        })
      }

      console.log('OAuth Redirect URI:', redirectTo)
      console.log('Platform:', Platform.OS)

      // Start the OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('OAuth Error:', error)
        throw error
      }

      // The OAuth flow will redirect to our app via deep linking
      // Supabase will handle the session creation automatically
      console.log('OAuth initiated successfully')
      
      return { data, error: null }
    } catch (error) {
      console.error('Google Auth Error:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  return {
    signInWithGoogle,
    loading,
  }
}