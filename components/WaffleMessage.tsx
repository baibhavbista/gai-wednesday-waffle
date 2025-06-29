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
import { Video, ResizeMode } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Heart, MessageCircle, Clock, Eye, Smile, Play, X, Pause } from 'lucide-react-native';
import { WaffleMessage as WaffleMessageType } from '@/store/useWaffleStore';
import { useRouter } from 'expo-router';


const { width, height } = Dimensions.get('window');

interface WaffleMessageProps {
  message: WaffleMessageType;
  currentUserId: string;
  onLike: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onViewRecap: (messageId: string) => void;
  isInViewport?: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

export default function WaffleMessage({ 
  message, 
  currentUserId, 
  onLike, 
  onReaction, 
  onViewRecap,
  isInViewport = false
}: WaffleMessageProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  // No longer need the custom useInView hook - using FlatList viewability
  const router = useRouter();


  const isOwnMessage = message.userId === currentUserId;
  const isVideo = message.content.type === 'video';


      // console.log('message', message.content.url, isVideo, isInViewport);

  // Generate video thumbnail only when component is in viewport
  useEffect(() => {
    const generateThumbnail = async () => {
      if (isVideo && message.content.url && isInViewport && !videoThumbnail) {
        console.log('Generating video thumbnail for ', message,  message.content.url);
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(
            message.content.url,
            {
              time: 1000, // Get thumbnail at 1 second
              quality: 0.8, // Good quality
            }
          );
          setVideoThumbnail(uri);
        } catch (error) {
          console.warn('Failed to generate video thumbnail:', error);
        }
      }
    };

    generateThumbnail();
  }, [isVideo, message.content.url, isInViewport, videoThumbnail]);

  // Auto-hide controls after 3 seconds
  const hideControlsTimer = () => {
    setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleVideoPress = () => {
    setShowControls(true);
    hideControlsTimer();
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowControls(true);
    hideControlsTimer();
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

  const reactionEntries = Object.entries(message.reactions);

  return (
    <View 
      style={[styles.container, isOwnMessage && styles.ownContainer]}
    >
      {/* Avatar and Name */}
      {!isOwnMessage && (
        <View style={styles.messageHeader}>
          <Image source={{ uri: message.userAvatar || 'https://via.placeholder.com/32' }} style={styles.avatar} />
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
              </TouchableOpacity>
            ) : (
              // Image content
              <View style={styles.imageContainer}>
                <Image source={{ uri: message.content.url || 'https://via.placeholder.com/300x160' }} style={styles.contentImage} />
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

        {/* Reactions */}
        {reactionEntries.length > 0 && (
          <View style={styles.reactionsContainer}>
            {reactionEntries.map(([userId, emoji]) => (
              <View key={userId} style={styles.reactionBubble}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </View>
            ))}
          </View>
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
          {message.content.type !== 'text' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onViewRecap(message.id)}
            >
              <MessageCircle size={16} color="#9CA3AF" />
              <Text style={styles.actionText}>Recap</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowReactions(true)}
          >
            <Smile size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Reactions */}
      {showReactions && (
        <View style={styles.reactionsOverlay}>
          <View style={styles.reactionsModal}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionOption}
                onPress={() => {
                  onReaction(message.id, emoji);
                  setShowReactions(false);
                }}
              >
                <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Fullscreen Video Modal */}
      <Modal
        visible={showVideoModal}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          setShowVideoModal(false);
          setIsPlaying(true);
          setShowControls(true);
        }}
      >
        <TouchableOpacity 
          style={styles.videoModalContainer}
          activeOpacity={1}
          onPress={handleVideoPress}
        >
          <Video
            source={{ uri: message.content.url || '' }}
            style={styles.fullscreenVideo}
            shouldPlay={isPlaying}
            isLooping={false}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={false}
          />
          
          {/* Custom Controls Overlay */}
          {showControls && (
            <View style={styles.videoControlsOverlay}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowVideoModal(false);
                  setIsPlaying(true);
                  setShowControls(true);
                }}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={togglePlayPause}
              >
                {isPlaying ? (
                  <Pause size={32} color="#FFFFFF" />
                ) : (
                  <Play size={32} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    maxWidth: width * 0.8,
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
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  reactionBubble: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownActions: {
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
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
  reactionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  reactionsModal: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  reactionOption: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  reactionOptionEmoji: {
    fontSize: 24,
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
  videoModalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    padding: 8,
  },
  fullscreenVideo: {
    width: width,
    height: height,
    resizeMode: 'contain',
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
});