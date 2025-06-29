import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useRouter } from 'expo-router';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { Plus, MessageCircle, Clock, Users, UserPlus } from 'lucide-react-native';

export default function ChatsScreen() {
  const { groups, currentUser, isLoading, hasGroupsInitLoaded, error, loadUserGroups, joinGroup, createGroup, clearData } = useWaffleStore();
  const { status, setCallbacks, subscribeToAllGroupsSummary } = useRealtime();
  const { isReady, isAuthenticated } = useAuth();
  const router = useRouter();

  // Group management state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [groupName, setGroupName] = useState('');

  // Set up enhanced real-time callbacks
  useEffect(() => {
    setCallbacks({
      onGroupUpdate: (group, action) => {
        if (__DEV__) console.log('🏗️ Real-time group update callback:', action, group.name);
        // Smart updates are handled automatically by the real-time hook
        // This callback is just for additional UI feedback if needed
      },
      onMemberUpdate: (member, action) => {
        if (__DEV__) console.log('👥 Real-time member update callback:', action, member.user_id);
        // Smart member updates are handled automatically by the real-time hook
        // This callback is just for additional UI feedback if needed
      },
    });
  }, [setCallbacks]);

  // Load groups when authentication is ready
  useEffect(() => {
    if (isReady && isAuthenticated && currentUser) {
      loadUserGroups();
    } else if (isReady && !isAuthenticated) {
      // Clear data if not authenticated
      clearData();
    }
  }, [isReady, isAuthenticated, currentUser]);

  // Subscribe to all groups for real-time last message updates
  useEffect(() => {
    if (isAuthenticated && groups.length > 0) {
      const groupIds = groups.map(group => group.id);
      subscribeToAllGroupsSummary(groupIds);
      if (__DEV__) console.log('📋 Chats screen subscribed to', groupIds.length, 'groups for real-time updates');
    }
  }, [isAuthenticated, groups]);

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    try {
      await joinGroup(inviteCode.trim().toUpperCase());
      setInviteCode('');
      setShowJoinModal(false);
      Alert.alert('Success', 'Joined group successfully!');
    } catch (error) {
      let errorMessage = 'Failed to join group';
      let errorTitle = 'Error';
      
      if (error instanceof Error) {
        if (error.message === 'NETWORK_ERROR') {
          errorTitle = 'Connection Problem';
          errorMessage = 'Can\'t connect to the server. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      const newGroup = await createGroup(groupName.trim());
      
      if (newGroup) {
        setGroupName('');
        setShowCreateModal(false);
        Alert.alert(
          'Success', 
          `Group "${newGroup.name}" created!\n\nInvite Code: ${newGroup.inviteCode}\n\nShare this code with friends to join!`
        );
      }
    } catch (error) {
      let errorMessage = 'Failed to create group';
      let errorTitle = 'Error';
      
      if (error instanceof Error) {
        if (error.message === 'NETWORK_ERROR') {
          errorTitle = 'Connection Problem';
          errorMessage = 'Can\'t connect to the server. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  };

  // Handle + button press with action sheet
  const handleAddPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Create Group', 'Join Group'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setShowCreateModal(true);
          } else if (buttonIndex === 2) {
            setShowJoinModal(true);
          }
        }
      );
    } else {
      // For Android, we'll show a simple modal with options
      Alert.alert(
        'Group Actions',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Group', onPress: () => setShowCreateModal(true) },
          { text: 'Join Group', onPress: () => setShowJoinModal(true) },
        ]
      );
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMinutes >= 2) {
      // Show actual time for messages 2+ minutes old but less than 1 hour
      return date.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    return 'now';
  };

  const getMissingMembers = (group: any) => {
    return group.members.filter((m: any) => !m.hasPostedThisWeek && m.id !== currentUser?.id);
  };

  // Note: Authentication and profile loading is handled by _layout.tsx
  // If we reach this component, we're guaranteed to have an authenticated user with profile

  // Show network error state if there's a connectivity issue
  if (error === 'NETWORK_ERROR') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.userName}>{currentUser?.name || 'User'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.newChatButton}
            onPress={handleAddPress}
          >
            <Plus size={20} color="#F97316" />
          </TouchableOpacity>
        </View>
        <View style={styles.networkErrorContainer}>
          <View style={styles.networkErrorIcon}>
            <Text style={styles.networkErrorEmoji}>📡</Text>
          </View>
          <Text style={styles.networkErrorTitle}>Connection Problem</Text>
          <Text style={styles.networkErrorMessage}>
            Can't connect to the server right now. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              if (isAuthenticated) {
                loadUserGroups();
              }
            }}
            disabled={!hasGroupsInitLoaded && isLoading}
          >
            <Text style={styles.retryButtonText}>
              {!hasGroupsInitLoaded && isLoading ? 'Retrying...' : 'Try Again'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.networkErrorHelp}>
            • Check your WiFi or mobile data{'\n'}
            • Make sure you have internet access{'\n'}
            • Try refreshing the app
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.userName}>{currentUser?.name || 'User'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={handleAddPress}
        >
          <Plus size={20} color="#F97316" />
        </TouchableOpacity>
      </View>

      {/* Chat List */}
              {!hasGroupsInitLoaded && groups.length === 0 ? (
        // Show centered loading while fetching groups for the first time
        <View style={styles.centerLoadingContainer}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Loading your groups...</Text>
        </View>
      ) : (
        <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
          {groups
            .sort((a, b) => {
              // Get the most recent activity time for each group
              const getRecentActivityTime = (group: typeof a) => {
                if (!group.lastMessage) {
                  // No messages, use group creation time
                  return group.createdAt.getTime();
                }
                // Use whichever is more recent: last message or group creation
                return Math.max(
                  group.lastMessage.createdAt.getTime(),
                  group.createdAt.getTime()
                );
              };
              
              const aTime = getRecentActivityTime(a);
              const bTime = getRecentActivityTime(b);
              
              // Sort by most recent activity first
              return bTime - aTime;
            })
            .map((group) => {
              const missingMembers = getMissingMembers(group);
              const isWednesday = new Date().getDay() === 3;
              
              return (
                <TouchableOpacity
                  key={group.id}
                  style={styles.chatItem}
                  onPress={() => router.push(`/chat/${group.id}`)}
                >
                  {/* Group Avatar */}
                  <View style={styles.groupAvatarContainer}>
                    <View style={styles.groupAvatar}>
                      <Text style={styles.groupAvatarText}>
                        {group.name.split(' ').map(word => word[0]).join('').slice(0, 2)}
                      </Text>
                    </View>
                    {group.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{group.unreadCount}</Text>
                      </View>
                    )}
                  </View>

                  {/* Chat Info */}
                  <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      {group.lastMessage && (
                        <Text style={styles.timestamp}>
                          {getTimeAgo(group.lastMessage.createdAt)}
                        </Text>
                      )}
                    </View>

                    {group.lastMessage ? (
                      <View style={styles.lastMessageContainer}>
                        <Text style={styles.lastMessageSender}>
                          {group.lastMessage.userName}:
                        </Text>
                        <Text style={styles.lastMessage} numberOfLines={1}>
                          {group.lastMessage.caption}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noMessages}>No waffles yet this week</Text>
                    )}

                    {/* Wednesday Nudge Indicator */}
                    {isWednesday && missingMembers.length > 0 && (
                      <View style={styles.nudgeIndicator}>
                        <Clock size={12} color="#F97316" />
                        <Text style={styles.nudgeText}>
                          Waiting for {missingMembers.length} member{missingMembers.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Member Avatars */}
                  <View style={styles.memberAvatars}>
                    {group.members.slice(0, 3).map((member, index) => (
                      <View
                        key={member.id}
                        style={[
                          styles.memberAvatar,
                          { marginLeft: index > 0 ? -8 : 0 },
                          !member.hasPostedThisWeek && styles.memberAvatarPending
                        ]}
                      >
                        <Image source={{ uri: member.avatar || 'https://via.placeholder.com/28' }} style={styles.memberAvatarImage} />
                        {!member.hasPostedThisWeek && member.id !== currentUser?.id && (
                          <View style={styles.pendingIndicator} />
                        )}
                      </View>
                    ))}
                    {group.members.length > 3 && (
                      <View style={[styles.memberAvatar, { marginLeft: -8 }]}>
                        <Text style={styles.moreMembers}>+{group.members.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      )}

      {/* Empty State */}
              {hasGroupsInitLoaded && groups.length === 0 && (
        <View style={styles.emptyState}>
          <MessageCircle size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No waffle groups yet</Text>
          <Text style={styles.emptySubtitle}>
            Join your friends or create a new group to start sharing weekly life updates
          </Text>
          <TouchableOpacity 
            style={styles.joinGroupButton}
            onPress={() => setShowJoinModal(true)}
          >
            <UserPlus size={20} color="#FFFFFF" />
            <Text style={styles.joinGroupText}>Join a Group</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createGroupButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Users size={20} color="#F97316" />
            <Text style={styles.createGroupText}>Create New Group</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Join Group Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Group</Text>
            <Text style={styles.modalSubtitle}>
              Enter the invite code shared by your friends
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter invite code (e.g. ABC123)"
              placeholderTextColor="#9CA3AF"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setInviteCode('');
                  setShowJoinModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleJoinGroup}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Joining...' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <Text style={styles.modalSubtitle}>
              Give your group a name to get started
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Group name (e.g. College Squad)"
              placeholderTextColor="#9CA3AF"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setGroupName('');
                  setShowCreateModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleCreateGroup}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  greeting: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  groupAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarText: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  chatInfo: {
    flex: 1,
    marginRight: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessageSender: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    flex: 1,
  },
  noMessages: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#D1D5DB',
    fontStyle: 'italic',
  },
  nudgeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  nudgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#F97316',
    marginLeft: 4,
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'relative',
  },
  memberAvatarPending: {
    opacity: 0.6,
  },
  memberAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  pendingIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreMembers: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#9CA3AF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  joinGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  joinGroupText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: '#F97316',
  },
  createGroupText: {
    color: '#F97316',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Network error styles
  networkErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FAFAFA',
  },
  networkErrorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  networkErrorEmoji: {
    fontSize: 36,
  },
  networkErrorTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  networkErrorMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  networkErrorHelp: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  centerLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});