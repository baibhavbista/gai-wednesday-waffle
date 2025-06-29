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
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useWaffleStore } from '@/store/useWaffleStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Check } from 'lucide-react-native';
import { useMedia } from '@/hooks/useMedia';

export default function GroupSelectionScreen() {
  const { groups, addMessage, currentUser, isLoading } = useWaffleStore();
  const { uploadMedia, isLoading: isUploading, uploadProgress } = useMedia();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const videoUri = params.videoUri as string;
  const caption = params.caption as string;

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
    if (!currentUser || !videoUri || selectedGroups.size === 0 || isSending || isUploading) return;

    setIsSending(true);

    console.log('🎯 === GROUP SELECTION WAFFLE CREATION START ===');
    console.log('📹 Video URI:', videoUri);
    console.log('👤 Current User:', currentUser.name);
    console.log('🎯 Selected Groups:', Array.from(selectedGroups));
    console.log('📊 Selected Groups Count:', selectedGroups.size);

    try {
      // First, upload the video once to get the public URL
      console.log('📤 Starting video upload for group selection...');
      
      const uploadResult = await uploadMedia(
        { uri: videoUri, type: 'video' },
        'video'
      );

      if (!uploadResult.success) {
        console.error('❌ Video upload failed:', uploadResult.error);
        alert(uploadResult.error || 'Failed to upload video');
        return;
      }

      console.log('✅ Video uploaded successfully:', uploadResult.url);

      // Now send to all selected groups using the same uploaded URL
      for (const groupId of selectedGroups) {
        const messageData = {
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          content: {
            type: 'video' as const,
            url: uploadResult.url,
          },
          caption: caption || 'Check out my waffle! 🧇',
          groupId,
        };

        try {
          await addMessage(messageData);
          console.log('✅ Message created for group:', groupId);
        } catch (error) {
          console.error('❌ Failed to create message for group:', groupId, error);
          throw error;
        }
      };

      //await Promise.all(messagePromises);
      console.log('✅ All messages created successfully');

      // Navigate back to the main feed
      router.push('/(tabs)');
    } catch (error) {
      console.error('❌ Error in group selection send:', error);
      alert('Failed to send waffle to selected groups');
    } finally {
      setIsSending(false);
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
            (selectedGroups.size === 0 || isSending || isUploading) && styles.sendButtonDisabled
          ]}
          onPress={sendToSelectedGroups}
          disabled={selectedGroups.size === 0 || isSending || isUploading}
        >
          <Text style={[
            styles.sendButtonText,
            (selectedGroups.size === 0 || isSending || isUploading) && styles.sendButtonTextDisabled
          ]}>
            {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` :
             isSending ? 'Sending...' : 'Send'}
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
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : filteredGroups.length === 0 && groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create or join a group first to share your video
            </Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No matching groups</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search
            </Text>
          </View>
        ) : (
          filteredGroups.map((group) => {
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
          })
        )}
      </ScrollView>

      {/* Bottom Info */}
      {selectedGroups.size > 0 && !isSending && !isUploading && (
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomInfoText}>
            {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''} selected
          </Text>
        </View>
      )}

      {/* Loading Modal */}
      <Modal
        visible={isSending || isUploading}
        transparent
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingModal}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={styles.loadingTitle}>
              {isUploading ? 'Uploading Video' : 'Sending Waffle'}
            </Text>
            <Text style={styles.loadingMessage}>
              {isUploading ? 
                `Uploading video... ${Math.round(uploadProgress)}%` :
                `Sharing to ${selectedGroups.size} group${selectedGroups.size > 1 ? 's' : ''}...`
              }
            </Text>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  // Loading modal styles
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});