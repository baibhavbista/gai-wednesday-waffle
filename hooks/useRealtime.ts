import { useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useWaffleStore, WaffleMessage, Group } from '../store/useWaffleStore'
import { groupsService } from '../lib/database-service'
import type { Database } from '../lib/database.types'

type Tables = Database['public']['Tables']
type WaffleRow = Tables['waffles']['Row']
type GroupRow = Tables['groups']['Row']
type GroupMemberRow = Tables['group_members']['Row']

// Convert database row to store message format
const waffleRowToMessage = (row: WaffleRow, userName: string = 'Loading...', userAvatar: string | null = null): WaffleMessage => ({
  id: row.id,
  userId: row.user_id,
  userName,
  userAvatar: userAvatar || '',
  content: {
    type: row.content_type || 'text',
    url: row.content_url || '',
  },
  caption: row.caption || '',
  createdAt: new Date(row.created_at),
  expiresAt: row.expires_at ? new Date(row.expires_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  retentionType: row.retention_type === 'view_once' ? 'view-once' : 
                 row.retention_type === '7_days' ? '7-day' : 'keep-forever',
  groupId: row.group_id,
  viewed: false,
  likes: row.view_count || 0,
  hasLiked: false,
  reactions: {},
})

interface RealtimeStatus {
  connected: boolean
  connecting: boolean
  error: string | null
}

interface SubscriptionCallbacks {
  onWaffleUpdate?: (waffle: WaffleRow) => void
  onWaffleDelete?: (waffleId: string) => void
  onGroupUpdate?: (group: GroupRow, action: 'INSERT' | 'UPDATE' | 'DELETE') => void
  onMemberUpdate?: (member: GroupMemberRow, action: 'INSERT' | 'DELETE') => void
}

// Smart group update helpers
const handleGroupRealtime = async (
  group: GroupRow, 
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  userId: string,
  {
    addGroupRealtime,
    updateGroupRealtime, 
    removeGroupRealtime,
    loadUserGroups
  }: {
    addGroupRealtime: (group: Group) => void
    updateGroupRealtime: (groupId: string, updates: Partial<Group>) => void
    removeGroupRealtime: (groupId: string) => void
    loadUserGroups: () => Promise<void>
  }
) => {
  if (__DEV__) console.log('🏗️ Smart group update:', action, group.name)

  switch (action) {
    case 'INSERT':
      // Check if user is a member of this new group before adding
      try {
        const { data: members } = await groupsService.getGroupMembers(group.id)
        const isMember = members?.some(m => m.user_id === userId)
        
        if (isMember) {
          // Transform to store format
          const storeGroup: Group = {
            id: group.id,
            name: group.name,
            inviteCode: group.invite_code,
            createdAt: new Date(group.created_at),
            unreadCount: 0,
            members: members?.map(member => ({
              id: member.user_id,
              name: member.user_name,
              avatar: member.user_avatar || '',
              lastActive: new Date(member.joined_at),
              hasPostedThisWeek: false,
            })) || [],
          }
          addGroupRealtime(storeGroup)
          
          // Update member cache with new group members
          if (members) {
            const { updateMemberCache } = useWaffleStore.getState()
            const memberProfiles = members.map(m => ({
              id: m.user_id,
              name: m.user_name,
              avatar: m.user_avatar || null,
            }))
            updateMemberCache(memberProfiles)
          }
          
          if (__DEV__) console.log('✅ Added new group to store:', group.name)
        }
      } catch (error) {
        if (__DEV__) console.error('❌ Error checking group membership:', error)
        // Fallback to full reload
        loadUserGroups()
      }
      break

    case 'UPDATE':
      // Update group details
      updateGroupRealtime(group.id, {
        name: group.name,
        inviteCode: group.invite_code,
      })
      break

    case 'DELETE':
      removeGroupRealtime(group.id)
      break
  }
}

export function useRealtime() {
  const { session } = useAuth()
  const { 
    addWaffle, 
    updateWaffle, 
    removeWaffle, 
    updateGroupMemberCount,
    addGroupRealtime,
    updateGroupRealtime,
    removeGroupRealtime,
    updateGroupMembers,
    updateGroupLastMessage,
    incrementGroupUnreadCount,
    loadUserGroups,
    currentGroupId,
    getMemberFromCache,
    addToMemberCache,
    updateMemberCache
  } = useWaffleStore()
  
  const [status, setStatus] = useState<RealtimeStatus>({
    connected: false,
    connecting: false,
    error: null,
  })

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map())
  const callbacksRef = useRef<SubscriptionCallbacks>({})

  // Set subscription callbacks
  const setCallbacks = (callbacks: SubscriptionCallbacks) => {
    callbacksRef.current = callbacks
  }

  // Subscribe to a specific group's waffles
  const subscribeToGroup = (groupId: string) => {
    if (!session?.user || channelsRef.current.has(`group-${groupId}`)) return

    if (__DEV__) console.log('🔄 Subscribing to group:', groupId)

    // Important: Unsubscribe from summary subscription for this group to prevent conflicts
    unsubscribeFromGroupSummary(groupId)

    const channel = supabase
      .channel(`group-waffles-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waffles',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (__DEV__) console.log('🧇 Waffle real-time update:', payload.eventType, payload)

          switch (payload.eventType) {
            case 'INSERT':
              const newWaffle = payload.new as WaffleRow
              
              // Get user details from cache first, fallback to fetching if not found
              const { getMemberFromCache, addToMemberCache } = useWaffleStore.getState()
              let userName = 'Unknown User'
              let userAvatar: string | null = null
              
              const cachedUser = getMemberFromCache(newWaffle.user_id)
              if (cachedUser) {
                userName = cachedUser.name
                userAvatar = cachedUser.avatar
                if (__DEV__) console.log('👤 Used cached user details for group message:', userName)
                
                // Check if this is the current user's own message (already added optimistically)
                const { data: { user } } = await supabase.auth.getUser()
                if (newWaffle.user_id === user?.id) {
                  if (__DEV__) console.log('🔄 Skipping own message from real-time (already added optimistically):', newWaffle.id)
                  return // Don't add own messages via real-time
                }
                
                const newMessage = waffleRowToMessage(newWaffle, userName, userAvatar)
                addWaffle(newMessage)
                callbacksRef.current.onWaffleUpdate?.(newWaffle)
                if (__DEV__) console.log('✅ Added new waffle to store via real-time:', newWaffle.id, 'by', userName)
              } else {
                // Fallback: fetch user details if not in cache
                try {
                  // Check if this is the current user's own message first
                  const { data: { user } } = await supabase.auth.getUser()
                  if (newWaffle.user_id === user?.id) {
                    if (__DEV__) console.log('🔄 Skipping own message from real-time (already added optimistically):', newWaffle.id)
                    return // Don't add own messages via real-time
                  }
                  
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, avatar_url')
                    .eq('id', newWaffle.user_id)
                    .single()
                  
                  if (profile) {
                    userName = profile.name || 'Unknown User'
                    userAvatar = profile.avatar_url || null
                    
                    // Add to cache for future use
                    addToMemberCache({
                      id: newWaffle.user_id,
                      name: userName,
                      avatar: userAvatar,
                    })
                    if (__DEV__) console.log('👤 Fetched and cached user details for group message:', userName)
                  }
                  
                  const newMessage = waffleRowToMessage(newWaffle, userName, userAvatar)
                  addWaffle(newMessage)
                  callbacksRef.current.onWaffleUpdate?.(newWaffle)
                  if (__DEV__) console.log('✅ Added new waffle to store via real-time:', newWaffle.id, 'by', userName)
                } catch (error) {
                  if (__DEV__) console.error('❌ Error fetching user details for waffle:', error)
                  // Still add the waffle with fallback info
                  const newMessage = waffleRowToMessage(newWaffle, 'Unknown User', null)
                  addWaffle(newMessage)
                  callbacksRef.current.onWaffleUpdate?.(newWaffle)
                }
              }
              break

            case 'UPDATE':
              const updatedWaffle = payload.new as WaffleRow
              const updatedMessage = waffleRowToMessage(updatedWaffle)
              updateWaffle(updatedWaffle.id, updatedMessage)
              callbacksRef.current.onWaffleUpdate?.(updatedWaffle)
              if (__DEV__) console.log('✅ Updated waffle in store via real-time:', updatedWaffle.id)
              break

            case 'DELETE':
              const deletedWaffle = payload.old as WaffleRow
              removeWaffle(deletedWaffle.id)
              callbacksRef.current.onWaffleDelete?.(deletedWaffle.id)
              if (__DEV__) console.log('✅ Removed waffle from store via real-time:', deletedWaffle.id)
              break
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          if (__DEV__) console.log('👥 Member real-time update:', payload.eventType, payload)

          const member = (payload.new || payload.old) as GroupMemberRow
          const action = payload.eventType as 'INSERT' | 'DELETE'

          // Update member count in store
          if (action === 'INSERT') {
            updateGroupMemberCount(groupId, 1)
          } else if (action === 'DELETE') {
            updateGroupMemberCount(groupId, -1)
          }

          callbacksRef.current.onMemberUpdate?.(member, action)
        }
      )
      .subscribe((status) => {
        if (__DEV__) console.log('📡 Group subscription status:', status, groupId)
        
        setStatus(prev => ({
          ...prev,
          connected: status === 'SUBSCRIBED',
          connecting: false,
          error: status === 'CLOSED' ? 'Connection lost' : null,
        }))
      })

    channelsRef.current.set(`group-${groupId}`, channel)
  }

  // Subscribe to group for summary updates (for Chats screen)
  const subscribeToGroupSummary = (groupId: string) => {
    if (!session?.user || channelsRef.current.has(`summary-${groupId}`)) return

    if (__DEV__) console.log('📋 Subscribing to group summary:', groupId)

    const channel = supabase
      .channel(`group-summary-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'waffles',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (__DEV__) console.log('📨 New waffle for group summary:', payload)

          const newWaffle = payload.new as WaffleRow
          
          // Get user details from cache first, fallback to fetching if not found
          const { getMemberFromCache } = useWaffleStore.getState()
          let userName = 'Unknown User'
          let userAvatar: string | null = null
          
          const cachedUser = getMemberFromCache(newWaffle.user_id)
          if (cachedUser) {
            userName = cachedUser.name
            userAvatar = cachedUser.avatar
            if (__DEV__) console.log('👤 Used cached user details:', userName)
          } else {
            // Fallback: fetch user details if not in cache
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name, avatar_url')
                .eq('id', newWaffle.user_id)
                .single()
              
              if (profile) {
                userName = profile.name || 'Unknown User'
                userAvatar = profile.avatar_url || null
                
                // Add to cache for future use
                const { addToMemberCache } = useWaffleStore.getState()
                addToMemberCache({
                  id: newWaffle.user_id,
                  name: userName,
                  avatar: userAvatar,
                })
                if (__DEV__) console.log('👤 Fetched and cached user details:', userName)
              }
            } catch (error) {
              if (__DEV__) console.error('❌ Error fetching user profile:', error)
            }
          }
          
          // Convert to WaffleMessage format for lastMessage
          const newMessage = waffleRowToMessage(newWaffle, userName, userAvatar)
          
          // Fetch current user to check if message is from them
          try {
            const { data: { user } } = await supabase.auth.getUser()
            
            // If it's from the current user, don't increment unread count
            const isFromCurrentUser = newWaffle.user_id === user?.id
            
            // Update group's last message
            updateGroupLastMessage(groupId, newMessage)
            
            // Increment unread count only if not from current user
            if (!isFromCurrentUser) {
              incrementGroupUnreadCount(groupId)
            }
            
            if (__DEV__) console.log('✅ Updated group summary for:', groupId, 'from current user:', isFromCurrentUser)
          } catch (error) {
            if (__DEV__) console.error('❌ Error updating group summary:', error)
            // Still update last message even if we can't determine user
            updateGroupLastMessage(groupId, newMessage)
            incrementGroupUnreadCount(groupId)
          }
        }
      )
      .subscribe((status) => {
        if (__DEV__) console.log('📡 Group summary subscription status:', status, groupId)
      })

    channelsRef.current.set(`summary-${groupId}`, channel)
  }

  // Unsubscribe from group summary
  const unsubscribeFromGroupSummary = (groupId: string) => {
    const channelKey = `summary-${groupId}`
    const channel = channelsRef.current.get(channelKey)
    
    if (channel) {
      if (__DEV__) console.log('❌ Unsubscribing from group summary:', groupId)
      
      supabase.removeChannel(channel)
      channelsRef.current.delete(channelKey)
    }
  }

  // Subscribe to all groups for summary updates
  const subscribeToAllGroupsSummary = (groupIds: string[]) => {
    if (__DEV__) console.log('📋 Subscribing to all groups summary:', groupIds.length, 'groups')
    
    // Unsubscribe from any existing summary subscriptions
    const existingSummaryChannels = Array.from(channelsRef.current.keys()).filter(key => key.startsWith('summary-'))
    existingSummaryChannels.forEach(key => {
      const groupId = key.replace('summary-', '')
      unsubscribeFromGroupSummary(groupId)
    })
    
    // Subscribe to all current groups
    groupIds.forEach(groupId => subscribeToGroupSummary(groupId))
  }

  // Unsubscribe from a group
  const unsubscribeFromGroup = (groupId: string) => {
    const channelKey = `group-${groupId}`
    const channel = channelsRef.current.get(channelKey)
    
    if (channel) {
      if (__DEV__) console.log('❌ Unsubscribing from group:', groupId)
      
      supabase.removeChannel(channel)
      channelsRef.current.delete(channelKey)
      
      // Re-subscribe to summary subscription for this group when leaving detailed view
      // This ensures the index screen can still receive last message updates
      subscribeToGroupSummary(groupId)
    }
  }

  // Subscribe to user's groups updates with smart handling
  const subscribeToUserGroups = () => {
    if (!session?.user || channelsRef.current.has('user-groups')) return

    if (__DEV__) console.log('🔄 Subscribing to user groups with smart updates...')

    const channel = supabase
      .channel('user-groups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
        },
        async (payload) => {
          if (__DEV__) console.log('🏗️ Group real-time update:', payload.eventType, payload)
          
          const group = (payload.new || payload.old) as GroupRow
          const action = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          
          // Use smart group handling
          await handleGroupRealtime(group, action, session.user.id, {
            addGroupRealtime,
            updateGroupRealtime,
            removeGroupRealtime,
            loadUserGroups
          })
          
          // Also call the callback for backward compatibility
          callbacksRef.current.onGroupUpdate?.(group, action)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
        },
        async (payload) => {
          if (__DEV__) console.log('👥 Group member real-time update:', payload.eventType, payload)
          
          const member = (payload.new || payload.old) as GroupMemberRow
          const action = payload.eventType as 'INSERT' | 'DELETE'
          
          // Only handle if it affects the current user
          if (member.user_id === session.user.id) {
            if (action === 'INSERT') {
              // User joined a new group - trigger smart group reload
              try {
                await loadUserGroups()
                if (__DEV__) console.log('✅ Reloaded groups after user joined new group')
              } catch (error) {
                if (__DEV__) console.error('❌ Error reloading after group join:', error)
              }
            } else if (action === 'DELETE') {
              // User left a group - remove it
              removeGroupRealtime(member.group_id)
              if (__DEV__) console.log('✅ Removed group after user left:', member.group_id)
            }
          } else {
            // Another user joined/left - update member count and list
            try {
              const { data: members } = await groupsService.getGroupMembers(member.group_id)
              if (members) {
                const transformedMembers = members.map(m => ({
                  id: m.user_id,
                  name: m.user_name,
                  avatar: m.user_avatar || '',
                  lastActive: new Date(m.joined_at),
                  hasPostedThisWeek: false,
                }))
                updateGroupMembers(member.group_id, transformedMembers)
                
                // Update member cache with any new members
                const memberProfiles = members.map(m => ({
                  id: m.user_id,
                  name: m.user_name,
                  avatar: m.user_avatar || null,
                }))
                updateMemberCache(memberProfiles)
                
                if (__DEV__) console.log('✅ Updated group members and cache for:', member.group_id)
              }
            } catch (error) {
              if (__DEV__) console.error('❌ Error updating group members:', error)
            }
          }
          
          // Call the callback
          callbacksRef.current.onMemberUpdate?.(member, action)
        }
      )
      .subscribe((status) => {
        if (__DEV__) console.log('📡 Enhanced user groups subscription status:', status)
      })

    channelsRef.current.set('user-groups', channel)
  }

  // Subscribe to current group (auto-switch when currentGroupId changes)
  useEffect(() => {
    if (currentGroupId) {
      // Unsubscribe from previous group
      const currentChannels = Array.from(channelsRef.current.keys())
      currentChannels.forEach(key => {
        if (key.startsWith('group-') && key !== `group-${currentGroupId}`) {
          const groupId = key.replace('group-', '')
          unsubscribeFromGroup(groupId)
        }
      })

      // Subscribe to new group
      subscribeToGroup(currentGroupId)
    }
  }, [currentGroupId])

  // Initialize user groups subscription
  useEffect(() => {
    if (session?.user) {
      subscribeToUserGroups()
    }

    return () => {
      // Cleanup all subscriptions
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel)
      })
      channelsRef.current.clear()
    }
  }, [session?.user])

  // Connection status monitoring (React Native compatible)
  useEffect(() => {
    let netInfoUnsubscribe: (() => void) | undefined;

    const setupNetworkMonitoring = async () => {
      try {
        const NetInfo = await import('@react-native-community/netinfo');
        
        const handleNetworkChange = (state: any) => {
          if (__DEV__) console.log('🌐 Network state changed:', state.isConnected)
          
          if (state.isConnected) {
            if (__DEV__) console.log('🌐 Back online - reconnecting subscriptions...')
            setStatus(prev => ({ ...prev, error: null, connecting: true }))
            
            // Reconnect to current group if needed
            if (currentGroupId) {
              unsubscribeFromGroup(currentGroupId)
              setTimeout(() => subscribeToGroup(currentGroupId), 1000)
            }
          } else {
            if (__DEV__) console.log('📡 Gone offline')
            setStatus(prev => ({ ...prev, connected: false, error: 'Offline' }))
          }
        }

        netInfoUnsubscribe = NetInfo.default.addEventListener(handleNetworkChange)
      } catch (error) {
        if (__DEV__) console.warn('⚠️ NetInfo not available, skipping network monitoring:', error)
      }
    }

    setupNetworkMonitoring()

    return () => {
      if (netInfoUnsubscribe) {
        netInfoUnsubscribe()
      }
    }
  }, [currentGroupId])

  // Optimistic waffle posting
  const postWaffleOptimistic = (waffle: Omit<WaffleRow, 'id' | 'created_at'>) => {
    if (!session?.user) return null

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const optimisticWaffle: WaffleRow = {
      ...waffle,
      id: tempId,
      created_at: new Date().toISOString(),
    }

    // Add to store immediately for instant UI feedback
    addWaffle(waffleRowToMessage(optimisticWaffle, session.user.user_metadata?.name || 'You', session.user.user_metadata?.picture))

    if (__DEV__) console.log('⚡ Posted optimistic waffle:', tempId)
    
    return tempId
  }

  // Remove optimistic waffle (on error)
  const removeOptimisticWaffle = (tempId: string) => {
    removeWaffle(tempId)
    if (__DEV__) console.log('❌ Removed optimistic waffle:', tempId)
  }

  return {
    status,
    subscribeToGroup,
    unsubscribeFromGroup,
    subscribeToUserGroups,
    subscribeToGroupSummary,
    unsubscribeFromGroupSummary,
    subscribeToAllGroupsSummary,
    setCallbacks,
    postWaffleOptimistic,
    removeOptimisticWaffle,
  }
} 