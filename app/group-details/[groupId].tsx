import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  Clipboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWaffleStore } from '@/store/useWaffleStore';
import { 
  ArrowLeft, 
  Copy, 
  Share as ShareIcon, 
  Settings, 
  UserMinus, 
  Crown,
  Calendar,
  Users,
  MessageCircle 
} from 'lucide-react-native';

export default function GroupDetailsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { groups, messages, currentUser, isLoading } = useWaffleStore();
  const [copiedCode, setCopiedCode] = useState(false);

  const group = groups.find(g => g.id === groupId);

  // Show loading state while groups are being fetched
  if (isLoading && groups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Group Details</Text>
          
          <View style={styles.headerButton} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.loadingText}>Loading group details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Group Details</Text>
          
          <View style={styles.headerButton} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Group not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate actual posting activity from messages
  const getLastPostTime = (memberId: string) => {
    const memberMessages = messages.filter(m => 
      m.groupId === groupId && 
      m.userId === memberId && 
      m.content.type !== 'text' // Filter out text-only messages
    );
    if (memberMessages.length === 0) return null;
    
    // Sort by creation date and get the most recent
    const sortedMessages = memberMessages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return sortedMessages[0].createdAt;
  };

  const hasPostedThisWeek = (memberId: string) => {
    const lastPost = getLastPostTime(memberId);
    if (!lastPost) return false;
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return lastPost > weekAgo;
  };

  const getTimeSinceLastPost = (memberId: string) => {
    const lastPost = getLastPostTime(memberId);
    if (!lastPost) return 'Never posted';
    
    const now = new Date();
    const diffMs = now.getTime() - lastPost.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  const isCreator = group.members.find(m => m.id === currentUser?.id)?.id === currentUser?.id;
  
  // Use actual posting data instead of mock data
  const activeMembers = group.members.filter(m => hasPostedThisWeek(m.id));
  const pendingMembers = group.members.filter(m => !hasPostedThisWeek(m.id));

  const handleCopyInviteCode = async () => {
    try {
      Clipboard.setString(group.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy invite code');
    }
  };

  const handleShareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join "${group.name}" on Wednesday Waffle!\n\nInvite Code: ${group.inviteCode}\n\nShare your weekly life updates with the group! 🧇`,
        title: `Join ${group.name}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"? You&apos;ll need a new invite code to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implement leave group functionality
            Alert.alert('Coming Soon', 'Leave group functionality will be implemented with the backend integration');
          }
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Group Details</Text>
        
        <TouchableOpacity style={styles.headerButton}>
          <Settings size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Info */}
        <View style={styles.groupInfoSection}>
          <View style={styles.groupAvatar}>
            <Text style={styles.groupAvatarText}>
              {group.name.split(' ').map(word => word[0]).join('').slice(0, 2)}
            </Text>
          </View>
          
          <Text style={styles.groupName}>{group.name}</Text>
          
          <View style={styles.groupStats}>
            <View style={styles.statItem}>
              <Users size={16} color="#9CA3AF" />
              <Text style={styles.statText}>{group.members.length} members</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Calendar size={16} color="#9CA3AF" />
              <Text style={styles.statText}>Created {formatDate(group.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Invite Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Code</Text>
          <View style={styles.inviteCodeContainer}>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{group.inviteCode}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.actionButton, copiedCode && styles.actionButtonSuccess]}
              onPress={handleCopyInviteCode}
            >
              <Copy size={16} color={copiedCode ? "#10B981" : "#F97316"} />
              <Text style={[styles.actionButtonText, copiedCode && styles.actionButtonTextSuccess]}>
                {copiedCode ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShareInviteCode}>
              <ShareIcon size={16} color="#F97316" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({group.members.length})
          </Text>
          
          {/* Active Members */}
          {activeMembers.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>
                Posted This Week ({activeMembers.length})
              </Text>
              {activeMembers.map((member) => (
                <View key={member.id} style={styles.memberItem}>
                  <Image source={{ uri: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}` }} style={styles.memberAvatar} />
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {member.id === currentUser?.id && (
                        <Text style={styles.youLabel}>You</Text>
                      )}
                      {isCreator && member.id === currentUser?.id && (
                        <Crown size={14} color="#F59E0B" />
                      )}
                    </View>
                    <Text style={styles.memberStatus}>
                      Last posted {getTimeSinceLastPost(member.id)}
                    </Text>
                  </View>
                  <View style={styles.activeIndicator} />
                </View>
              ))}
            </>
          )}

          {/* Pending Members */}
          {pendingMembers.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>
                Pending This Week ({pendingMembers.length})
              </Text>
              {pendingMembers.map((member) => (
                <View key={member.id} style={styles.memberItem}>
                  <Image source={{ uri: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}` }} style={[styles.memberAvatar, styles.memberAvatarPending]} />
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={[styles.memberName, styles.memberNamePending]}>{member.name}</Text>
                      {member.id === currentUser?.id && (
                        <Text style={styles.youLabel}>You</Text>
                      )}
                    </View>
                    <Text style={styles.memberStatusPending}>
                      Last posted {getTimeSinceLastPost(member.id)}
                    </Text>
                  </View>
                  <View style={styles.pendingIndicator} />
                </View>
              ))}
            </>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={() => router.push(`/chat/${groupId}`)}
          >
            <MessageCircle size={20} color="#FFFFFF" />
            <Text style={styles.chatButtonText}>Go to Chat</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
            <UserMinus size={20} color="#EF4444" />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  groupInfoSection: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupAvatarText: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  groupName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 6,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 12,
    marginTop: 8,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteCodeBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  inviteCodeText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    letterSpacing: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF7ED',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionButtonSuccess: {
    backgroundColor: '#ECFDF5',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#F97316',
    marginLeft: 6,
  },
  actionButtonTextSuccess: {
    color: '#10B981',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  memberAvatarPending: {
    opacity: 0.6,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginRight: 8,
  },
  memberNamePending: {
    color: '#9CA3AF',
  },
  youLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#F97316',
    backgroundColor: '#FEF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  memberStatus: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  memberStatusPending: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  pendingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  chatButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  leaveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
}); 