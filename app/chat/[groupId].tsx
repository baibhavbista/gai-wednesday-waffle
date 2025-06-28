import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWaffleStore } from '@/store/useWaffleStore';
import { ArrowLeft, Camera, Heart, MessageCircle, Eye, Clock, Smile } from 'lucide-react-native';
import WaffleMessage from '@/components/WaffleMessage';
import WednesdayNudge from '@/components/WednesdayNudge';

export default function ChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { 
    groups, 
    messages, 
    currentUser,
    likeMessage,
    addReaction,
    markMessageViewed,
  } = useWaffleStore();

  const [showNudge, setShowNudge] = useState(false);
  const [messageText, setMessageText] = useState('');

  const group = groups.find(g => g.id === groupId);
  const groupMessages = messages.filter(m => m.groupId === groupId).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Mock: Show nudge on Wednesdays if user hasn't posted
  const isWednesday = new Date().getDay() === 3;
  const userHasPostedThisWeek = group?.members.find(m => m.id === currentUser?.id)?.hasPostedThisWeek || false;
  
  const missingMembers = group?.members
    .filter(m => !m.hasPostedThisWeek && m.id !== currentUser?.id)
    .map(m => m.name) || [];

  useEffect(() => {
    if (isWednesday && !userHasPostedThisWeek && groupMessages.length > 0) {
      const timer = setTimeout(() => setShowNudge(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isWednesday, userHasPostedThisWeek, groupMessages.length]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [groupMessages.length]);

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

  const handleViewRecap = (messageId: string) => {
    markMessageViewed(messageId);
    // Mock AI recap
    alert('AI Catch-up Recap: This waffle shows a cozy coffee moment at the recommended shop. The atmosphere looks perfect for some quality coffee time, and it seems like the group\'s suggestion was a hit!');
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
              {missingMembers.length > 0 && ` • ${missingMembers.length} pending`}
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
                <Image source={{ uri: member.avatar }} style={styles.headerMemberAvatarImage} />
                {!member.hasPostedThisWeek && member.id !== currentUser?.id && (
                  <View style={styles.pendingIndicator} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
        >
          {groupMessages.length === 0 ? (
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
            groupMessages.map((message) => (
              <WaffleMessage
                key={message.id}
                message={message}
                currentUserId={currentUser?.id || ''}
                onLike={likeMessage}
                onReaction={addReaction}
                onViewRecap={handleViewRecap}
              />
            ))
          )}
        </ScrollView>

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
            multiline
            maxLength={200}
          />
          
          <TouchableOpacity style={styles.emojiButton}>
            <Smile size={24} color="#9CA3AF" />
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    maxHeight: 100,
    marginRight: 12,
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});