import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface CreateProfileData {
  id: string
  name: string
  avatar_url?: string | null
}

export interface UpdateProfileData {
  name?: string
  avatar_url?: string | null
}

export class ProfileService {
  
  /**
   * Create a new profile from auth user data
   */
  static async createProfile(data: CreateProfileData): Promise<{ data: Profile | null; error: any }> {
    try {
      console.log('🔥 Creating profile:', data)
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .insert([{
          id: data.id,
          name: data.name,
          avatar_url: data.avatar_url || null,
        }])
        .select()
        .single()

      if (error) {
        console.error('❌ Profile creation error:', error)
        return { data: null, error }
      }

      console.log('✅ Profile created successfully:', profile)
      return { data: profile, error: null }
    } catch (error) {
      console.error('❌ Profile creation exception:', error)
      return { data: null, error }
    }
  }

  /**
   * Get profile by user ID
   */
  static async getProfile(userId: string): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('❌ Profile fetch error:', error)
        return { data: null, error }
      }

      return { data: profile, error: null }
    } catch (error) {
      console.error('❌ Profile fetch exception:', error)
      return { data: null, error }
    }
  }

  /**
   * Update existing profile
   */
  static async updateProfile(userId: string, updates: UpdateProfileData): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        console.error('❌ Profile update error:', error)
        return { data: null, error }
      }

      console.log('✅ Profile updated successfully:', profile)
      return { data: profile, error: null }
    } catch (error) {
      console.error('❌ Profile update exception:', error)
      return { data: null, error }
    }
  }

  /**
   * Extract profile data from auth user (OAuth or email signup)
   */
  static extractProfileData(user: User): CreateProfileData {
    // For OAuth users (Google)
    if (user.user_metadata?.full_name) {
      return {
        id: user.id,
        name: user.user_metadata.full_name,
        avatar_url: user.user_metadata.picture || user.user_metadata.avatar_url || null,
      }
    }

    // For email signup users
    if (user.user_metadata?.name) {
      return {
        id: user.id,
        name: user.user_metadata.name,
        avatar_url: null,
      }
    }

    // Fallback: use email prefix as name
    const emailName = user.email?.split('@')[0] || 'User'
    return {
      id: user.id,
      name: emailName,
      avatar_url: null,
    }
  }

  /**
   * Get or create profile for a user
   */
  static async getOrCreateProfile(user: User): Promise<{ data: Profile | null; error: any }> {
    // First try to get existing profile
    const { data: existingProfile, error: fetchError } = await this.getProfile(user.id)
    
    if (existingProfile) {
      console.log('✅ Found existing profile:', existingProfile)
      return { data: existingProfile, error: null }
    }

    // If no profile exists, create one
    console.log('📝 No profile found, creating new profile for user:', user.id)
    const profileData = this.extractProfileData(user)
    return await this.createProfile(profileData)
  }
} 