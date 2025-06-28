import React, { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet, Text, ActivityIndicator, RefreshControl } from 'react-native'
import { useWaffleStore, WaffleMessage } from '../store/useWaffleStore'
import { useRealtime } from '../hooks/useRealtime'
import { wafflesService } from '../lib/database-service'
import WaffleCard from './WaffleCard'

interface WaffleFeedProps {
  groupId: string
}

export default function WaffleFeed({ groupId }: WaffleFeedProps) {
  const { messages, setCurrentGroup } = useWaffleStore()
  const { status, setCallbacks } = useRealtime()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter messages for current group
  const groupMessages = messages.filter(message => message.groupId === groupId)

  // Load initial waffles for the group
  const loadWaffles = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true)
      setError(null)

      const { data: waffles, error: fetchError } = await wafflesService.getForGroup(groupId)
      
      if (fetchError) {
        throw new Error(fetchError.message)
      }

      if (waffles) {
        // Convert and add to store (this will replace existing messages for this group)
        // Note: In a real implementation, you'd want to merge rather than replace
        console.log('📋 Loaded', waffles.length, 'waffles for group', groupId)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load waffles'
      setError(errorMessage)
      console.error('❌ Error loading waffles:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Handle pull-to-refresh
  const onRefresh = () => {
    setIsRefreshing(true)
    loadWaffles(false)
  }

  // Set up real-time callbacks
  useEffect(() => {
    setCallbacks({
      onWaffleUpdate: (waffle) => {
        if (__DEV__) console.log('🧇 Real-time waffle update received:', waffle.id)
        // The real-time hook already adds to store, so we just need to handle UI feedback
      },
      onWaffleDelete: (waffleId) => {
        if (__DEV__) console.log('🗑️ Real-time waffle deletion:', waffleId)
      },
    })
  }, [setCallbacks])

  // Load initial data and set current group
  useEffect(() => {
    setCurrentGroup(groupId)
    loadWaffles()
  }, [groupId])

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (!status.connected && !status.connecting) {
      return (
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.statusText}>
            {status.error || 'Disconnected'} • Tap to refresh
          </Text>
        </View>
      )
    }
    
    if (status.connecting) {
      return (
        <View style={styles.connectionStatus}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={styles.statusText}>Connecting...</Text>
        </View>
      )
    }

    return (
      <View style={styles.connectionStatus}>
        <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
        <Text style={styles.statusText}>Live updates</Text>
      </View>
    )
  }

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No waffles yet! 🧇</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to share a waffle with your group
      </Text>
    </View>
  )

  // Error state
  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>Failed to load waffles</Text>
      <Text style={styles.errorSubtitle}>{error}</Text>
    </View>
  )

  // Loading state
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading waffles...</Text>
      </View>
    )
  }

  // Error state
  if (error && !isRefreshing && groupMessages.length === 0) {
    return (
      <View style={styles.container}>
        {renderConnectionStatus()}
        {renderErrorState()}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {renderConnectionStatus()}
      
      <FlatList
        data={groupMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WaffleCard 
            waffle={item} 
            onLike={() => {}} // Placeholder - will implement in next phase
            onViewRecap={() => {}} // Placeholder - will implement in next phase
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#f59e0b"
            colors={['#f59e0b']}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  feedContainer: {
    padding: 16,
    paddingBottom: 100, // Extra space for tab bar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
}) 