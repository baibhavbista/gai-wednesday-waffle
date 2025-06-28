import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { Plus, Users, Copy, UserPlus, Settings, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';

export default function GroupsScreen() {
  const { 
    groups, 
    currentGroupId, 
    currentUser,
    setCurrentGroup, 
    joinGroup, 
    createGroup,
    isLoading,
  } = useWaffleStore();

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      const newGroup = await createGroup(newGroupName.trim());
      setNewGroupName('');
      setShowCreateGroup(false);
      setCurrentGroup(newGroup.id);
      Alert.alert('Success!', `Created "${newGroup.name}" group. Share the invite code: ${newGroup.inviteCode}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    try {
      await joinGroup(inviteCode.trim().toUpperCase());
      setInviteCode('');
      setShowJoinGroup(false);
      Alert.alert('Success!', 'Joined group successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to join group. Check the invite code.');
    }
  };

  const copyInviteCode = (code: string) => {
    // Mock clipboard functionality
    Alert.alert('Copied!', `Invite code "${code}" copied to clipboard`);
  };

  const getMemberStatus = (member: any) => {
    if (member.hasPostedThisWeek) {
      return { icon: CheckCircle, color: '#15803D', text: 'Posted' };
    }
    return { icon: Clock, color: '#F59E0B', text: 'Pending' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowJoinGroup(true)}
          >
            <UserPlus size={20} color="#F97316" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowCreateGroup(true)}
          >
            <Plus size={20} color="#F97316" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.id} style={styles.groupCard}>
            {/* Group Header */}
            <View style={styles.groupHeader}>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  {group.members.length} members • {group.waffleCount} waffles
                </Text>
              </View>
              
              {currentGroupId === group.id && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>

            {/* Members */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members</Text>
              {group.members.map((member) => {
                const status = getMemberStatus(member);
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberLastActive}>
                        {member.id === currentUser?.id ? 'You' : 'Last active 2d ago'}
                      </Text>
                    </View>
                    <View style={styles.memberStatus}>
                      <status.icon size={16} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.text}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Group Actions */}
            <View style={styles.groupActions}>
              {currentGroupId !== group.id ? (
                <TouchableOpacity 
                  style={styles.switchButton}
                  onPress={() => setCurrentGroup(group.id)}
                >
                  <Text style={styles.switchButtonText}>Switch to this group</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.activeActions}>
                  <TouchableOpacity 
                    style={styles.inviteButton}
                    onPress={() => copyInviteCode(group.inviteCode)}
                  >
                    <Copy size={16} color="#F97316" />
                    <Text style={styles.inviteButtonText}>Copy invite: {group.inviteCode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.settingsButton}>
                    <Settings size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create New Group</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter group name"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCreateGroup(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={handleCreateGroup}
                disabled={isLoading}
              >
                <Text style={styles.createButtonText}>
                  {isLoading ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Join Group Modal */}
      {showJoinGroup && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Join Group</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowJoinGroup(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={handleJoinGroup}
                disabled={isLoading}
              >
                <Text style={styles.createButtonText}>
                  {isLoading ? 'Joining...' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  activeBadge: {
    backgroundColor: '#15803D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  membersSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  memberLastActive: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  groupActions: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  switchButton: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF7ED',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  inviteButtonText: {
    color: '#F97316',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginLeft: 8,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#9CA3AF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  createButton: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});