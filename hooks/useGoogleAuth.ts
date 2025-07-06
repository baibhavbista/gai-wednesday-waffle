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
        // For mobile, create the redirect URL
        // In development: exp://localhost:8081/--/auth/callback
        // In production: wednesday-waffle://auth/callback
        if (__DEV__) {
          // Use Expo development URL for easier testing
          redirectTo = makeRedirectUri({
            path: 'auth/callback',
          })
        } else {
          // Use custom scheme for production
          redirectTo = 'wednesday-waffle://auth/callback'
        }
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
          skipBrowserRedirect: Platform.OS !== 'web', // Only skip on mobile
        },
      })

      if (error) {
        console.error('OAuth Error:', error)
        throw error
      }

      // Open the OAuth URL in a browser
      if (data?.url) {
        console.log('Opening OAuth URL:', data.url)
        
        if (Platform.OS === 'web') {
          // For web, use window.location
          window.location.href = data.url
        } else {
          // For mobile, use WebBrowser with dismissButtonStyle
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectTo,
            {
              dismissButtonStyle: 'close', // Shows close button instead of cancel
              showInRecents: false, // Don't show in app switcher
            }
          )
          
          console.log('WebBrowser result:', result)
          
          if (result.type === 'success') {
            // Extract tokens from the result URL
            const url = result.url
            console.log('Success URL:', url)
            
            // Check if Supabase has already handled the session
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session) {
              console.log('Session already established by Supabase:', session.user.email)
            } else {
              // Try to parse tokens from the URL if session not auto-created
              const urlParts = url.split('#')
              if (urlParts.length > 1) {
                const hashParams = new URLSearchParams(urlParts[1])
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')
                
                if (accessToken && refreshToken) {
                  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  })
                  
                  if (sessionError) {
                    console.error('Failed to set session:', sessionError)
                    throw sessionError
                  }
                  
                  if (sessionData.session) {
                    console.log('Session established successfully:', sessionData.session.user.email)
                  }
                }
              }
            }
          } else if (result.type === 'cancel') {
            console.log('User cancelled OAuth flow')
            throw new Error('Authentication was cancelled')
          } else if (result.type === 'dismiss') {
            console.log('User dismissed OAuth flow')
            throw new Error('Authentication was dismissed')
          }
        }
      }
      
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