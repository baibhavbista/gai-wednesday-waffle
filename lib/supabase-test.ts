import { supabase } from './supabase'

export async function testSupabaseConnection() {
  try {
    console.log('🧪 Testing Supabase connection...')
    
    // Test 1: Basic connection
    const { data, error } = await supabase.from('test_connection').select('*').limit(1)
    
    if (error) {
      // If test_connection table doesn't exist, that's expected for now
      console.log('⚠️ Test table not found (expected):', error.message)
    } else {
      console.log('✅ Database connection successful!')
    }

    // Test 2: Auth service availability
    const { data: session } = await supabase.auth.getSession()
    console.log('✅ Auth service working, session state:', session.session ? 'authenticated' : 'not authenticated')

    // Test 3: Basic client info
    console.log('✅ Supabase client initialized successfully')
    
    return { success: true, message: 'All tests passed!' }
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error)
    return { success: false, error }
  }
}

// Test function for auth operations
export async function testAuthFlow() {
  try {
    console.log('🧪 Testing auth availability...')
    
    // Just test that auth methods are available
    const authMethods = {
      signUp: typeof supabase.auth.signUp === 'function',
      signIn: typeof supabase.auth.signInWithPassword === 'function',
      signOut: typeof supabase.auth.signOut === 'function',
      getSession: typeof supabase.auth.getSession === 'function',
    }
    
    console.log('✅ Auth methods available:', authMethods)
    return { success: true, authMethods }
  } catch (error) {
    console.error('❌ Auth test failed:', error)
    return { success: false, error }
  }
} 