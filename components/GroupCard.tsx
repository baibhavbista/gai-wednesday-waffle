import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { Group } from '../store/useWaffleStore'

interface GroupCardProps {
  group: Group
  onPress: () => void
  isConnected: boolean
}

export default function GroupCard({ group, onPress, isConnected }: GroupCardProps) {
  const formatLastActive = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }

  const activeMembersCount = group.members.filter(member => member.hasPostedThisWeek).length

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Connection indicator */}
      <View style={[styles.connectionIndicator, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      
      {/* Group info */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{group.unreadCount}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.memberInfo}>
          {group.members.length} members • {activeMembersCount} posted this week
        </Text>
      </View>

      {/* Last message preview */}
      {group.lastMessage && (
        <View style={styles.lastMessage}>
          <Text style={styles.lastMessageUser}>{group.lastMessage.userName}</Text>
          <Text style={styles.lastMessageContent} numberOfLines={1}>
            {group.lastMessage.caption || '📷 Photo'}
          </Text>
          <Text style={styles.lastMessageTime}>
            {formatLastActive(group.lastMessage.createdAt)}
          </Text>
        </View>
      )}

      {/* Member avatars */}
      <View style={styles.membersRow}>
        {group.members.slice(0, 4).map((member, index) => (
          <View key={member.id} style={[styles.memberAvatar, { marginLeft: index > 0 ? -8 : 0 }]}>
            <Image 
              source={{ uri: member.avatar }} 
              style={styles.avatarImage}
              defaultSource={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}` }}
            />
            {member.hasPostedThisWeek && <View style={styles.activeIndicator} />}
          </View>
        ))}
        {group.members.length > 4 && (
          <View style={[styles.memberAvatar, { marginLeft: -8 }]}>
            <View style={styles.moreMembers}>
              <Text style={styles.moreMembersText}>+{group.members.length - 4}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Invite code */}
      <View style={styles.inviteCode}>
        <Text style={styles.inviteLabel}>Invite Code:</Text>
        <Text style={styles.inviteCodeText}>{group.inviteCode}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  connectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  memberInfo: {
    fontSize: 14,
    color: '#666',
  },
  lastMessage: {
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#f59e0b',
  },
  lastMessageUser: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
    marginBottom: 2,
  },
  lastMessageContent: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 2,
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#666',
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    position: 'relative',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#111',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#111',
  },
  moreMembers: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  moreMembersText: {
    fontSize: 10,
    color: '#ccc',
    fontWeight: '500',
  },
  inviteCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  inviteLabel: {
    fontSize: 12,
    color: '#666',
  },
  inviteCodeText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
    letterSpacing: 1,
  },
}) 