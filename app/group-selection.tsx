import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Check } from 'lucide-react-native';

export default function GroupSelectionScreen() {
  const { groups, addMessage, currentUser } = useWaffleStore();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const videoUri = params.videoUri as string;

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleGroupSelection = (groupId: string) => {
    const newSelection = new Set(selectedGroups);
    if (newSelection.has(groupId)) {
      newSelection.delete(groupId);
    } else {
      newSelection.add(groupId);
    }
    setSelectedGroups(newSelection);
  };

  const sendToSelectedGroups = async () => {
    if (!currentUser || !videoUri || selectedGroups.size === 0) return;

    try {
      // Send to all selected groups
      for (const groupId of selectedGroups) {
        addMessage({
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          content: {
            type: 'video',
            url: videoUri,
          },
          caption: 'Check out my waffle! 🧇',
          retentionType: '7-day',
          groupId: groupId,
        });
      }

      // Navigate back to main screen
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error sending video:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#000000" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Send To</Text>
          <Text style={styles.headerSubtitle}>Stories</Text>
        </View>

        <TouchableOpacity 
          style={[
            styles.sendButton,
            selectedGroups.size === 0 && styles.sendButtonDisabled
          ]}
          onPress={sendToSelectedGroups}
          disabled={selectedGroups.size === 0}
        >
          <Text style={[
            styles.sendButtonText,
            selectedGroups.size === 0 && styles.sendButtonTextDisabled
          ]}>
            Send
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Recents Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recents</Text>
      </View>

      {/* Groups List */}
      <ScrollView style={styles.groupsList} showsVerticalScrollIndicator={false}>
        {filteredGroups.map((group) => {
          const isSelected = selectedGroups.has(group.id);
          
          return (
            <TouchableOpacity
              key={group.id}
              style={styles.groupItem}
              onPress={() => toggleGroupSelection(group.id)}
            >
              <View style={styles.groupInfo}>
                <View style={styles.groupAvatar}>
                  <Text style={styles.groupAvatarText}>
                    {group.name.split(' ').map(word => word[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <Text style={styles.groupName}>{group.name}</Text>
              </View>

              <View style={[
                styles.selectionCircle,
                isSelected && styles.selectionCircleSelected
              ]}>
                {isSelected && <Check size={16} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom Info */}
      {selectedGroups.size > 0 && (
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomInfoText}>
            {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''} selected
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  sendButtonTextDisabled: {
    color: '#9CA3AF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#000000',
    marginLeft: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000',
  },
  groupsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupAvatarText: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  groupName: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#000000',
    flex: 1,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  bottomInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  bottomInfoText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
});