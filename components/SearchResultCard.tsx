import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Play, MessageSquare, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getVideoThumbnail, isValidThumbnailUrl } from '@/lib/thumbnail-utils';
import VideoModal from './VideoModal';

const { width } = Dimensions.get('window');

interface SearchResult {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  groupName: string;
  groupId: string;
  videoUrl: string;
  thumbnailUrl: string;
  transcript: string;
  videoDuration: number;
  createdAt: Date | string;
}

interface SearchResultCardProps {
  result: SearchResult;
  searchQuery: string;
  onPress?: () => void;
}

export default function SearchResultCard({ result, searchQuery, onPress }: SearchResultCardProps) {
  const router = useRouter();
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);
  
  // Load thumbnail when component mounts
  useEffect(() => {
    loadThumbnail();
  }, [result.thumbnailUrl, result.videoUrl]);
  
  const loadThumbnail = async () => {
    try {
      setThumbnailLoading(true);
      const thumbnail = await getVideoThumbnail({
        thumbnailUrl: result.thumbnailUrl,
        videoUrl: result.videoUrl,
        fallbackTime: 1000,
        quality: 0.8,
      });
      
      if (thumbnail) {
        setThumbnailUri(thumbnail);
      }
    } catch (error) {
      console.warn('[SearchResultCard] Failed to load thumbnail:', error);
    } finally {
      setThumbnailLoading(false);
    }
  };
  
  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInMs = now.getTime() - dateObj.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  // Get transcript preview
  const getTranscriptPreview = () => {
    const maxLength = 120;
    if (result.transcript.length <= maxLength) {
      return result.transcript;
    }
    return result.transcript.slice(0, maxLength) + '...';
  };
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Open video in fullscreen modal
      setShowVideoModal(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
        {/* Video Card */}
        <View style={styles.videoCard}>
          {thumbnailUri ? (
            <Image 
              source={{ uri: thumbnailUri }} 
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnail}>
              <Text style={styles.thumbnailPlaceholder}>
                {thumbnailLoading ? 'Loading...' : `📹 ${result.userName}&apos;s Video`}
              </Text>
            </View>
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatTime(result.videoDuration)}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <Image source={{ uri: result.userAvatar }} style={styles.avatar} />
            <View style={styles.userText}>
              <Text style={styles.userName}>{result.userName}</Text>
              <Text style={styles.metadata}>
                {result.groupName} • {formatRelativeTime(result.createdAt)}
              </Text>
            </View>
          </View>

          {/* Transcript Preview */}
          <Text style={styles.transcript} numberOfLines={3}>
            {getTranscriptPreview()}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Video Modal */}
      <VideoModal
        visible={showVideoModal}
        videoUrl={result.videoUrl}
        onClose={() => setShowVideoModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  videoCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  thumbnailPlaceholder: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  content: {
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userText: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  metadata: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 1,
  },
  transcript: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
}); 