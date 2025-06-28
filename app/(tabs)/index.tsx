import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useRouter } from 'expo-router';
import { Plus, MessageCircle, Clock } from 'lucide-react-native';

export default function ChatsScreen() {
  const { groups, currentUser } = useWaffleStore();
  const router = useRouter();

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return 'now';
  };

  const getMissingMembers = (group: any) => {
    return group.members.filter((m: any) => !m.hasPostedThisWeek && m.id !== currentUser?.id);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.userName}>{currentUser?.name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={() => router.push('/groups')}
        >
          <Plus size={20} color="#F97316" />
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
        {groups.map((group) => {
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
                    <Image source={{ uri: member.avatar }} style={styles.memberAvatarImage} />
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

      {/* Empty State */}
      {groups.length === 0 && (
        <View style={styles.emptyState}>
          <MessageCircle size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No waffle groups yet</Text>
          <Text style={styles.emptySubtitle}>
            Create or join a group to start sharing weekly life updates
          </Text>
          <TouchableOpacity 
            style={styles.createGroupButton}
            onPress={() => router.push('/groups')}
          >
            <Text style={styles.createGroupText}>Create Your First Group</Text>
          </TouchableOpacity>
        </View>
      )}
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
  createGroupButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  createGroupText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
});