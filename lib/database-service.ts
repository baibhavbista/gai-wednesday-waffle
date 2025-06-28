import { supabase } from './supabase'
import type { Database } from './database.types'

type Tables = Database['public']['Tables']
type GroupRow = Tables['groups']['Row']
type GroupInsert = Tables['groups']['Insert']
type GroupUpdate = Tables['groups']['Update']
type GroupMemberRow = Tables['group_members']['Row']
type GroupMemberInsert = Tables['group_members']['Insert']
type WaffleRow = Tables['waffles']['Row']
type WaffleInsert = Tables['waffles']['Insert']
type WaffleUpdate = Tables['waffles']['Update']

// Extended types with joined data
export interface GroupWithMembers extends GroupRow {
  member_count: number
  members?: GroupMemberRow[]
}

export interface WaffleWithUser extends WaffleRow {
  user_name: string
  user_avatar: string | null
}

// GROUPS SERVICE
export const groupsService = {
  // Create a new group using secure function
  async create(groupData: Omit<GroupInsert, 'created_by'>): Promise<{ data: GroupRow | null; error: any }> {
    if (__DEV__) console.log('🏗️ Creating group with secure function:', groupData.name)
    
    const { data, error } = await supabase.rpc('create_group_safe', {
      group_name: groupData.name
    })

    if (__DEV__ && error) console.error('❌ Error creating group:', error)
    if (__DEV__ && data) console.log('✅ Group created:', data[0])
    
    // The function returns an array with one group object
    return { data: data?.[0] || null, error }
  },

  // Get all groups for current user using secure function (bypasses RLS issues)
  async getUserGroups(): Promise<{ data: GroupWithMembers[] | null; error: any }> {
    if (__DEV__) console.log('📋 Fetching user groups with secure function...')
    
    const { data, error } = await supabase.rpc('get_user_groups')

    if (error) {
      if (__DEV__) console.error('❌ Error fetching user groups:', error)
      return { data: null, error }
    }

    if (__DEV__) console.log('✅ Groups fetched:', data?.length || 0)
    return { data: data as GroupWithMembers[] || [], error: null }
  },

  // Join group by invite code using secure function (bypasses RLS issues)
  async joinByInviteCode(inviteCode: string): Promise<{ data: string | null; error: any }> {
    if (__DEV__) console.log('🔗 Joining group with code using secure function:', inviteCode)
    
    const { data, error } = await supabase.rpc('join_group_by_invite', {
      invite_code_param: inviteCode.toUpperCase()
    })

    if (error) {
      if (__DEV__) console.error('❌ Error joining group:', error)
      return { data: null, error }
    }

    if (__DEV__) console.log('✅ Joined group with ID:', data)
    return { data, error: null }
  },

  // Leave a group using secure function
  async leave(groupId: string): Promise<{ error: any }> {
    if (__DEV__) console.log('🚪 Leaving group with secure function:', groupId)
    
    const { error } = await supabase.rpc('leave_group_safe', {
      group_uuid: groupId
    })

    if (__DEV__ && error) console.error('❌ Error leaving group:', error)
    if (__DEV__ && !error) console.log('✅ Left group successfully')
    
    return { error }
  },

  // Get group members using safe function (bypasses RLS issues)
  async getGroupMembers(groupId: string): Promise<{ data: any[] | null; error: any }> {
    if (__DEV__) console.log('👥 Fetching group members for:', groupId)
    
    const { data, error } = await supabase.rpc('get_group_members', {
      group_uuid: groupId
    })

    if (__DEV__ && error) console.error('❌ Error fetching group members:', error)
    if (__DEV__ && data) console.log('✅ Group members fetched:', data.length)
    
    return { data, error }
  },

  // Update group
  async update(groupId: string, updates: GroupUpdate): Promise<{ data: GroupRow | null; error: any }> {
    if (__DEV__) console.log('📝 Updating group:', groupId, updates)
    
    const { data, error } = await supabase
      .from('groups')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId)
      .select()
      .single()

    if (__DEV__ && error) console.error('❌ Error updating group:', error)
    if (__DEV__ && data) console.log('✅ Group updated:', data)
    
    return { data, error }
  }
}

// WAFFLES SERVICE
export const wafflesService = {
  // Create a new waffle
  async create(waffleData: Omit<WaffleInsert, 'user_id'>): Promise<{ data: WaffleRow | null; error: any }> {
    if (__DEV__) console.log('🧇 Creating waffle:', waffleData)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new Error('User not authenticated') }

    const { data, error } = await supabase
      .from('waffles')
      .insert({
        ...waffleData,
        user_id: user.id,
      })
      .select()
      .single()

    if (__DEV__ && error) console.error('❌ Error creating waffle:', error)
    if (__DEV__ && data) console.log('✅ Waffle created:', data)
    
    return { data, error }
  },

  // Get waffles for a group
  async getForGroup(groupId: string): Promise<{ data: WaffleWithUser[] | null; error: any }> {
    if (__DEV__) console.log('📋 Fetching waffles for group:', groupId)
    
    const { data, error } = await supabase
      .from('waffles')
      .select(`
        *,
        profiles!waffles_user_id_fkey(
          name,
          avatar_url
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      if (__DEV__) console.error('❌ Error fetching waffles:', error)
      return { data: null, error }
    }

    // Transform the data to include user info directly
    const waffles = data?.map(waffle => ({
      ...waffle,
      user_name: waffle.profiles?.name || 'Unknown User',
      user_avatar: waffle.profiles?.avatar_url || null,
    })) || []

    if (__DEV__) console.log('✅ Waffles fetched:', waffles.length)
    return { data: waffles as WaffleWithUser[], error: null }
  },

  // Update waffle (for AI content)
  async update(waffleId: string, updates: WaffleUpdate): Promise<{ data: WaffleRow | null; error: any }> {
    if (__DEV__) console.log('📝 Updating waffle:', waffleId, updates)
    
    const { data, error } = await supabase
      .from('waffles')
      .update(updates)
      .eq('id', waffleId)
      .select()
      .single()

    if (__DEV__ && error) console.error('❌ Error updating waffle:', error)
    if (__DEV__ && data) console.log('✅ Waffle updated:', data)
    
    return { data, error }
  },

  // Increment view count
  async incrementViews(waffleId: string): Promise<{ error: any }> {
    if (__DEV__) console.log('👁️ Incrementing views for waffle:', waffleId)
    
    const { error } = await supabase.rpc('increment_waffle_views', {
      waffle_id: waffleId
    })

    if (__DEV__ && error) console.error('❌ Error incrementing views:', error)
    
    return { error }
  },

  // Delete waffle
  async delete(waffleId: string): Promise<{ error: any }> {
    if (__DEV__) console.log('🗑️ Deleting waffle:', waffleId)
    
    const { error } = await supabase
      .from('waffles')
      .delete()
      .eq('id', waffleId)

    if (__DEV__ && error) console.error('❌ Error deleting waffle:', error)
    if (__DEV__ && !error) console.log('✅ Waffle deleted successfully')
    
    return { error }
  }
}

// REAL-TIME SUBSCRIPTIONS
export const subscriptionsService = {
  // Subscribe to group waffles
  subscribeToGroupWaffles(groupId: string, onUpdate: (waffle: WaffleRow) => void) {
    if (__DEV__) console.log('🔄 Subscribing to waffles for group:', groupId)
    
    return supabase
      .channel(`group-waffles-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waffles',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          if (__DEV__) console.log('🔄 Waffle update:', payload)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            onUpdate(payload.new as WaffleRow)
          }
        }
      )
      .subscribe()
  },

  // Subscribe to user's groups
  subscribeToUserGroups(onUpdate: (group: GroupRow) => void) {
    if (__DEV__) console.log('🔄 Subscribing to user groups...')
    
    return supabase
      .channel('user-groups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
        },
        (payload) => {
          if (__DEV__) console.log('🔄 Group update:', payload)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            onUpdate(payload.new as GroupRow)
          }
        }
      )
      .subscribe()
  }
} 