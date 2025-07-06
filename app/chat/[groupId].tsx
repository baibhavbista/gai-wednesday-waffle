import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWaffleStore } from '@/store/useWaffleStore';
import { ArrowLeft, Camera, Heart, MessageCircle, Eye, Clock, Send } from 'lucide-react-native';
import WaffleMessage from '@/components/WaffleMessage';
import WednesdayNudge from '@/components/WednesdayNudge';
import AISuggestionPills from '@/components/AISuggestionPills';
import WaffleSearchView from '@/components/WaffleSearchView';
import { useRealtime } from '@/hooks/useRealtime';

export default function ChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  
  const { 
    groups, 
    messages, 
    currentUser,
    currentGroupId,
    loadGroupMessages,
    isLoading,
    likeMessage,
    markMessageViewed,
    addMessage,
    clearGroupUnreadCount,
    setCurrentGroup,
  } = useWaffleStore();

  const [showNudge, setShowNudge] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [viewableItems, setViewableItems] = useState<string[]>([]);
  const [showAIPills, setShowAIPills] = useState(true);
  const [showSearchView, setShowSearchView] = useState(false);

  // Real-time hook - no longer need manual subscription calls
  const { status } = useRealtime();
  
  // Debug real-time status and current group
  useEffect(() => {
    console.log('📡 Real-time status:', status);
    console.log('🎯 Current group ID in store:', currentGroupId);
    console.log('🎯 Group ID from params:', groupId);
  }, [status, currentGroupId, groupId]);

  // Viewability configuration
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Item is considered visible when 50% is visible
  };

  // Handle viewable items changed
  const onViewableItemsChanged = useCallback(({ viewableItems: newViewableItems }: { viewableItems: any[] }) => {
    const visibleIds = newViewableItems.map((item: any) => item.item.id);
    setViewableItems(visibleIds);
  }, []);


  // FlatList render function
  const renderMessage: ListRenderItem<any> = useCallback(({ item: message }) => (
    <WaffleMessage
      key={message.id}
      message={message}
      currentUserId={currentUser?.id || ''}
      onLike={likeMessage}
      isInViewport={viewableItems.includes(message.id)}
    />
  ), [currentUser?.id, likeMessage, viewableItems]);

  const group = groups.find(g => g.id === groupId);
  const groupMessages = messages.filter(m => m.groupId === groupId).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() // Reverse order for inverted FlatList
  );

  // Mock: Show nudge on Wednesdays if user hasn't posted
  const isWednesday = new Date().getDay() === 3;
  const userHasPostedThisWeek = group?.members.find(m => m.id === currentUser?.id)?.hasPostedThisWeek || false;
  
  const missingMembers = group?.members
    .filter(m => !m.hasPostedThisWeek && m.id !== currentUser?.id)
    .map(m => m.name) || [];

  // Load messages when group changes
  useEffect(() => {
    if (groupId) {
      console.log('📱 Chat screen: Loading messages and setting up real-time for group:', groupId);
      loadGroupMessages(groupId);
      // Set current group for automatic real-time subscription
      setCurrentGroup(groupId);
      // Clear unread count when entering the group
      clearGroupUnreadCount(groupId);
    }

    return () => {
      // Clear current group when leaving
      if (groupId) {
        console.log('📱 Chat screen: Cleaning up real-time for group:', groupId);
        setCurrentGroup(null);
      }
    };
  }, [groupId, loadGroupMessages, setCurrentGroup, clearGroupUnreadCount]); // Include function dependencies

  useEffect(() => {
    if (isWednesday && !userHasPostedThisWeek && groupMessages.length > 0) {
      const timer = setTimeout(() => setShowNudge(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isWednesday, userHasPostedThisWeek, groupMessages.length]);

  // Scroll to bottom when messages first load
  useEffect(() => {
    if (groupMessages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        // For inverted FlatList, scrollToIndex(0) goes to the most recent message
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 200);
    }
  }, [groupMessages.length > 0]); // Only trigger when we go from 0 to having messages

  useEffect(() => {
    // Scroll to bottom when new messages arrive (but not on initial load)
    if (groupMessages.length > 1) {
      setTimeout(() => {
        if (flatListRef.current) {
          // For inverted FlatList, scrollToIndex(0) goes to the most recent message
          flatListRef.current.scrollToIndex({ index: 0, animated: true });
        }
      }, 100);
    }
  }, [groupMessages.length]);

  // Hide AI pills when typing
  useEffect(() => {
    setShowAIPills(messageText.length === 0);
  }, [messageText]);

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Group not found</Text>
      </SafeAreaView>
    );
  }

  const handleBackPress = () => {
    // Navigate to the main screen (index tab)
    router.push('/');
  };

  const handleCameraPress = () => {
    // Pass the current group ID as a parameter so camera knows where to return
    router.push(`/(tabs)/camera?groupId=${groupId}`);
  };

  const handleNeedIdeasPress = (prompts: string[]) => {
    // Navigate to camera with initial prompts
    router.push({
      pathname: '/(tabs)/camera',
      params: { 
        groupId,
        initialPrompts: JSON.stringify(prompts),
      }
    });
  };

  const handleFindPress = () => {
    setShowSearchView(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser || !groupId) return;

    try {
      await addMessage({
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        content: {
          type: 'text',
          text: messageText.trim(),
        },
        caption: messageText.trim(),
        groupId: groupId,
      });
      
      setMessageText(''); // Clear input after sending
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerInfo}
            onPress={() => router.push(`/group-details/${groupId}`)}
          >
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.memberCount}>
              {group.members.length} members
              {missingMembers.length > 0 && ` • ${group.members.length - missingMembers.length} active this week`}
            </Text>
          </TouchableOpacity>

          <View style={styles.memberAvatars}>
            {group.members.slice(0, 3).map((member, index) => (
              <View
                key={member.id}
                style={[
                  styles.headerMemberAvatar,
                  { marginLeft: index > 0 ? -8 : 0 },
                  !member.hasPostedThisWeek && styles.memberAvatarPending
                ]}
              >
                <Image source={{ uri: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}` }} style={styles.headerMemberAvatarImage} />
                {!member.hasPostedThisWeek && member.id !== currentUser?.id && (
                  <View style={styles.pendingIndicator} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Messages */}
        {isLoading && groupMessages.length === 0 ? (
          <View style={styles.loadingChat}>
            <Text style={styles.loadingText}>Loading waffles...</Text>
          </View>
        ) : groupMessages.length === 0 ? (
          <View style={styles.emptyChat}>
            <View style={styles.emptyIconContainer}>
              <Camera size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No waffles yet this week</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to share a life update with {group.name}!
            </Text>
            <TouchableOpacity 
              style={styles.firstWaffleButton}
              onPress={handleCameraPress}
            >
              <Camera size={16} color="#FFFFFF" />
              <Text style={styles.firstWaffleText}>Share Your First Waffle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={groupMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            inverted={true}
            initialScrollIndex={0}
            getItemLayout={(data, index) => ({
              length: 200, // Approximate item height
              offset: 200 * index,
              index,
            })}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
          />
        )}

        {/* AI Suggestion Pills */}
        <AISuggestionPills
          groupId={groupId}
          userId={currentUser?.id || ''}
          onNeedIdeasPress={handleNeedIdeasPress}
          onFindPress={handleFindPress}
          visible={showAIPills && (groupMessages.length > 0 || !!group.lastMessage)}
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={handleCameraPress}
          >
            <Camera size={24} color="#F97316" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            placeholder="Send a message..."
            value={messageText}
            onChangeText={setMessageText}
            maxLength={200}
          />
          
          <TouchableOpacity 
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
          >
            <Send size={20} color={messageText.trim() ? "#FFFFFF" : "#9CA3AF"} />
          </TouchableOpacity>
        </View>

        {/* Wednesday Nudge */}
        <WednesdayNudge
          visible={showNudge}
          onDismiss={() => setShowNudge(false)}
          onTakeWaffle={() => {
            setShowNudge(false);
            handleCameraPress();
          }}
          groupName={group.name}
          missingMembers={missingMembers}
        />
      </KeyboardAvoidingView>

      {/* Search View Modal */}
      <WaffleSearchView
        visible={showSearchView}
        onClose={() => setShowSearchView(false)}
        groupId={groupId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  memberCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMemberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  headerMemberAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pendingIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
    marginBottom: 32,
  },
  firstWaffleButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  firstWaffleText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
});

// Unmount this screen when it loses focus to clean up realtime listeners
export const unstable_settings = { unmountOnBlur: true };