import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import { Heart, MessageCircle, Clock, Eye, Play, X, Pause } from 'lucide-react-native';
import { WaffleMessage as WaffleMessageType } from '@/store/useWaffleStore';
import { useRouter } from 'expo-router';
import { fetchWaffleRecap } from '@/lib/ai-service';
import { getVideoThumbnail } from '@/lib/thumbnail-utils';
import VideoModal from './VideoModal';


const { width, height } = Dimensions.get('window');

interface WaffleMessageProps {
  message: WaffleMessageType;
  currentUserId: string;
  onLike: (messageId: string) => void;
  isInViewport?: boolean;
}

export default function WaffleMessage({ 
  message, 
  currentUserId, 
  onLike, 
  isInViewport = false
}: WaffleMessageProps) {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recapContent, setRecapContent] = useState<string | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);
  // No longer need the custom useInView hook - using FlatList viewability
  const router = useRouter();


  const isOwnMessage = message.userId === currentUserId;
  const isVideo = message.content.type === 'video';

  // Format video duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate video thumbnail only when component is in viewport
  useEffect(() => {
    const generateThumbnail = async () => {
      if (isVideo && message.content.url && isInViewport && !videoThumbnail) {
        console.log('[WaffleMessage] Getting thumbnail for:', message.id);
        try {
          const thumbnail = await getVideoThumbnail({
            thumbnailUrl: message.content.thumbnail,
            videoUrl: message.content.url,
            fallbackTime: 1000,
            quality: 0.8,
          });
          
          if (thumbnail) {
            setVideoThumbnail(thumbnail);
          }
        } catch (error) {
          console.warn('[WaffleMessage] Failed to get video thumbnail:', error);
        }
      }
    };

    generateThumbnail();
  }, [isVideo, message.content.url, message.content.thumbnail, isInViewport, videoThumbnail]);



  const handleRecapPress = async () => {
    if (!message.content.url) {
      console.warn('No content URL available for recap');
      return;
    }

    setShowRecapModal(true);
    setRecapLoading(true);
    setRecapError(null);
    setRecapContent(null);

    try {
      const result = await fetchWaffleRecap(message.content.url);
      
      if (result.error || !result.recap) {
        setRecapError(result.error || 'No recap available');
      } else {
        setRecapContent(result.recap);
      }
    } catch (error) {
      console.error('Failed to fetch recap:', error);
      setRecapError('Failed to load recap');
    } finally {
      setRecapLoading(false);
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes >= 2) {
      // Show actual time for messages 2+ minutes old but less than 1 hour
      return date.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    return 'Just now';
  };

  return (
    <View 
      style={[styles.container, isOwnMessage && styles.ownContainer]}
    >
      {/* Avatar and Name */}
      {!isOwnMessage && (
        <View style={styles.messageHeader}>
          <Image source={{ uri: message.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.userName)}` }} style={styles.avatar} />
          <View style={styles.messageInfo}>
            <Text style={styles.userName}>{message.userName}</Text>
            <Text style={styles.timestamp}>{getTimeAgo(message.createdAt)}</Text>
          </View>
        </View>
      )}

      {isOwnMessage && (
        <View style={styles.ownMessageHeader}>
          <Text style={styles.ownTimestamp}>{getTimeAgo(message.createdAt)}</Text>
        </View>
      )}

      {/* Message content */}
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {message.content.type === 'text' ? (
          // Text-only message layout
          <View style={styles.textOnlyContainer}>
            <Text style={[styles.textContent, isOwnMessage && styles.ownTextContent]}>
              {message.caption}
            </Text>
          </View>
        ) : (
          // Media message layout
          <>
            {isVideo ? (
              // Video thumbnail with play button
              <TouchableOpacity 
                style={styles.videoContainer}
                onPress={() => setShowVideoModal(true)}
              >
                {videoThumbnail ? (
                  <Image 
                    source={{ uri: videoThumbnail }} 
                    style={styles.videoThumbnail}
                  />
                ) : (
                  <View style={styles.videoThumbnailPlaceholder}>
                    <Text style={styles.videoThumbnailText}>Loading...</Text>
                  </View>
                )}
                <View style={styles.playButtonOverlay}>
                  <View style={styles.playButton}>
                    <Play size={24} color="#000000" />
                  </View>
                </View>
                {message.videoDuration && (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(message.videoDuration)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              // Image content
              <View style={styles.imageContainer}>
                <Image source={{ uri: message.content.url || 'https://www.gravatar.com/avatar/?d=mp' }} style={styles.contentImage} />
              </View>
            )}

            {/* Caption for media messages */}
            {message.caption && (
              <Text style={[styles.caption, isOwnMessage && styles.ownCaption]}>
                {message.caption}
              </Text>
            )}
          </>
        )}

        {/* Actions */}
        <View style={[styles.actions, isOwnMessage && styles.ownActions]}>
          <TouchableOpacity 
            style={[styles.actionButton, message.hasLiked && styles.likedButton]}
            onPress={() => onLike(message.id)}
          >
            <Heart 
              size={16} 
              color={message.hasLiked ? "#EF4444" : "#9CA3AF"} 
              fill={message.hasLiked ? "#EF4444" : "none"}
            />
            <Text style={[styles.actionText, message.hasLiked && styles.likedText]}>
              {message.likes}
            </Text>
          </TouchableOpacity>

          {/* Only show Recap button for media messages */}
          {message.content.type !== 'text' ? (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleRecapPress}
            >
              <MessageCircle size={16} color="#9CA3AF" />
              <Text style={styles.actionText}>Recap</Text>
            </TouchableOpacity>
          ) : (
            <View /> 
          )}
        </View>
      </View>

      {/* Fullscreen Video Modal */}
      <VideoModal
        visible={showVideoModal}
        videoUrl={message.content.url || ''}
        onClose={() => setShowVideoModal(false)}
      />

      {/* AI Recap Modal */}
      <Modal
        visible={showRecapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRecapModal(false)}
      >
        <View style={styles.recapModalContainer}>
          <View style={styles.recapHeader}>
            <Text style={styles.recapTitle}>AI Catch-up Recap</Text>
            <TouchableOpacity
              style={styles.recapCloseButton}
              onPress={() => setShowRecapModal(false)}
            >
              <X size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.recapContent}>
            {recapLoading ? (
              <View style={styles.recapLoadingContainer}>
                <Text style={styles.recapLoadingText}>Generating recap...</Text>
              </View>
            ) : recapError ? (
              <View style={styles.recapErrorContainer}>
                <Text style={styles.recapErrorText}>{recapError}</Text>
                <TouchableOpacity
                  style={styles.recapRetryButton}
                  onPress={handleRecapPress}
                >
                  <Text style={styles.recapRetryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : recapContent ? (
              <View style={styles.recapTextContainer}>
                <Text style={styles.recapText}>{recapContent}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.recapFooter}>
            <Text style={styles.recapFooterText}>
              AI-generated summary • {getTimeAgo(message.createdAt)}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    maxWidth: width * 0.8,
    minWidth: 170,
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  messageHeader: {
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
  messageInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  ownMessageHeader: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  ownTimestamp: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  messageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ownMessageContainer: {
    backgroundColor: '#FEF7ED',
  },
  textOnlyContainer: {
    position: 'relative',
  },
  textContent: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
    marginBottom: 8,
  },
  ownTextContent: {
    color: '#1F2937',
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  contentImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  caption: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  ownCaption: {
    color: '#1F2937',
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownActions: {
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likedButton: {},
  actionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginLeft: 4,
  },
  likedText: {
    color: '#EF4444',
  },

  videoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  videoThumbnailPlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbnailText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  playButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
  },

  // Recap Modal Styles
  recapModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  recapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recapTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  recapCloseButton: {
    padding: 8,
  },
  recapContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  recapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recapLoadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  recapErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recapErrorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  recapRetryButton: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  recapRetryText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
  },
  recapTextContainer: {
    flex: 1,
  },
  recapText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 24,
  },
  recapFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  recapFooterText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
});