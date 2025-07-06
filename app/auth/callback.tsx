import React, { useEffect } from 'react'
import { View, Text, ActivityIndicator, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const params = useLocalSearchParams()

  if (__DEV__) {
    console.log('🎯 AuthCallback component rendered!')
    console.log('Router params:', params)
  }

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        if (__DEV__) {
          console.log('🔥 OAUTH CALLBACK HANDLER STARTED')
          console.log('OAuth callback received with params:', params)
          console.log('Platform:', Platform.OS)
        }
        
        // Handle web OAuth tokens from URL hash
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          if (__DEV__) console.log('🌐 Processing web OAuth tokens...')
          const hash = window.location.hash
          
          if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1))
            const accessToken = hashParams.get('access_token')
            const refreshToken = hashParams.get('refresh_token')
            const expiresAt = hashParams.get('expires_at')
            
                         if (__DEV__) {
               console.log('🔑 OAuth tokens found:', {
                 hasAccessToken: !!accessToken,
                 hasRefreshToken: !!refreshToken,
                 expiresAt,
               })
             }
             
             if (accessToken && refreshToken) {
               if (__DEV__) console.log('🚀 Setting Supabase session with OAuth tokens...')
              
              // Set the session with the OAuth tokens
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
              
              if (error) {
                console.error('❌ Error setting session:', error)
                router.replace('/')
                return
              }
              
                             if (data.session) {
                 if (__DEV__) {
                   console.log('✅ OAuth successful! User authenticated:', data.session.user.email)
                   console.log('🏠 Redirecting to main app...')
                 }
                 
                 // Clear the hash from URL
                 window.history.replaceState(null, '', window.location.pathname)
                 
                 // Redirect to main app
                 router.replace('/(tabs)')
                 return
              } else {
                console.error('❌ Session creation failed - no session data')
              }
            } else {
              console.error('❌ Missing required OAuth tokens in URL hash')
            }
          } else {
            console.error('❌ No hash found in URL')
          }
        }
        
        // Handle mobile deep links
        if (Platform.OS !== 'web') {
          if (__DEV__) console.log('📱 Processing mobile OAuth callback...')
          
          // Extract tokens from query params (mobile deep links)
          const accessToken = params.access_token as string
          const refreshToken = params.refresh_token as string
          
          if (accessToken && refreshToken) {
            if (__DEV__) console.log('🔑 Mobile OAuth tokens found in params')
            
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            
            if (error) {
              console.error('❌ Error setting mobile session:', error)
              router.replace('/')
              return
            }
            
            if (data.session) {
              if (__DEV__) console.log('✅ Mobile OAuth successful!')
              router.replace('/(tabs)')
              return
            }
          }
        }
        
        // Final fallback: Check if session already exists
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('OAuth callback error:', error)
          router.replace('/')
          return
        }

        if (session) {
          console.log('Session found, user authenticated:', session.user.email)
          router.replace('/(tabs)')
        } else {
          console.log('No session found, redirecting to auth')
          router.replace('/')
        }
      } catch (error) {
        console.error('OAuth callback error:', error)
        router.replace('/')
      }
    }

    // Add a small delay to ensure the component is mounted
    const timeoutId = setTimeout(handleAuthCallback, 100)
    return () => clearTimeout(timeoutId)
  }, [params, router])

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#000' 
    }}>
      <ActivityIndicator size="large" color="#f59e0b" />
      <Text style={{ 
        color: '#fff', 
        marginTop: 16, 
        fontSize: 16 
      }}>
        Completing sign in...
      </Text>
    </View>
  )
} 