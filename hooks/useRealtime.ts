import { useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useWaffleStore, WaffleMessage } from '../store/useWaffleStore'
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
    type: row.content_type || 'photo',
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
  onGroupUpdate?: (group: GroupRow) => void
  onMemberUpdate?: (member: GroupMemberRow, action: 'INSERT' | 'DELETE') => void
}

export function useRealtime() {
  const { session } = useAuth()
  const { 
    addWaffle, 
    updateWaffle, 
    removeWaffle, 
    updateGroupMemberCount,
    currentGroupId 
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
        (payload) => {
          if (__DEV__) console.log('🧇 Waffle real-time update:', payload.eventType, payload)

          switch (payload.eventType) {
            case 'INSERT':
              const newWaffle = payload.new as WaffleRow
              addWaffle(waffleRowToMessage(newWaffle))
              callbacksRef.current.onWaffleUpdate?.(newWaffle)
              break

            case 'UPDATE':
              const updatedWaffle = payload.new as WaffleRow
              const updatedMessage = waffleRowToMessage(updatedWaffle)
              updateWaffle(updatedWaffle.id, updatedMessage)
              callbacksRef.current.onWaffleUpdate?.(updatedWaffle)
              break

            case 'DELETE':
              const deletedWaffle = payload.old as WaffleRow
              removeWaffle(deletedWaffle.id)
              callbacksRef.current.onWaffleDelete?.(deletedWaffle.id)
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

  // Unsubscribe from a group
  const unsubscribeFromGroup = (groupId: string) => {
    const channelKey = `group-${groupId}`
    const channel = channelsRef.current.get(channelKey)
    
    if (channel) {
      if (__DEV__) console.log('❌ Unsubscribing from group:', groupId)
      
      supabase.removeChannel(channel)
      channelsRef.current.delete(channelKey)
    }
  }

  // Subscribe to user's groups updates
  const subscribeToUserGroups = () => {
    if (!session?.user || channelsRef.current.has('user-groups')) return

    if (__DEV__) console.log('🔄 Subscribing to user groups...')

    const channel = supabase
      .channel('user-groups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
        },
        (payload) => {
          if (__DEV__) console.log('🏗️ Group real-time update:', payload.eventType, payload)
          
          const group = (payload.new || payload.old) as GroupRow
          callbacksRef.current.onGroupUpdate?.(group)
        }
      )
      .subscribe((status) => {
        if (__DEV__) console.log('📡 User groups subscription status:', status)
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
    setCallbacks,
    postWaffleOptimistic,
    removeOptimisticWaffle,
  }
} 