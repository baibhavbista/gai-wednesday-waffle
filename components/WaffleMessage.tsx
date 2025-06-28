import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Heart, MessageCircle, Clock, Eye, Smile } from 'lucide-react-native';
import { WaffleMessage as WaffleMessageType } from '@/store/useWaffleStore';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface WaffleMessageProps {
  message: WaffleMessageType;
  currentUserId: string;
  onLike: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onViewRecap: (messageId: string) => void;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

export default function WaffleMessage({ 
  message, 
  currentUserId, 
  onLike, 
  onReaction, 
  onViewRecap 
}: WaffleMessageProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const router = useRouter();

  const isOwnMessage = message.userId === currentUserId;

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

  const getExpiryText = () => {
    if (message.retentionType === 'view-once') return 'View once';
    if (message.retentionType === 'keep-forever') return 'Saved forever';
    
    const now = new Date();
    const expiresIn = Math.ceil((message.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `${expiresIn}d left`;
  };

  const reactionEntries = Object.entries(message.reactions);

  return (
    <View style={[styles.container, isOwnMessage && styles.ownMessage]}>
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

      {/* Content */}
      <View style={[styles.messageContent, isOwnMessage && styles.ownMessageContent]}>
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
            <TouchableOpacity 
              style={styles.imageContainer}
              onPress={() => message.retentionType === 'view-once' && !message.viewed && setShowRecap(!showRecap)}
              onLongPress={() => setShowReactions(true)}
            >
              {message.retentionType === 'view-once' && !message.viewed ? (
                <View style={styles.viewOnceOverlay}>
                  <Eye size={32} color="#FFFFFF" />
                  <Text style={styles.viewOnceText}>Tap to view</Text>
                </View>
              ) : (
                <Image source={{ uri: message.content.url || 'https://via.placeholder.com/300x160' }} style={styles.contentImage} />
              )}
              
              {/* Expiry Badge */}
              <View style={styles.expiryBadge}>
                <Clock size={10} color="#FFFFFF" />
                <Text style={styles.expiryText}>{getExpiryText()}</Text>
              </View>
            </TouchableOpacity>

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

          {/* Show expiry badge after emoji button for text messages */}
          {message.content.type === 'text' && (
            <View style={styles.textExpiryBadgeInline}>
              <Clock size={12} color="#9CA3AF" />
              <Text style={styles.textExpiryTextInline}>{getExpiryText()}</Text>
            </View>
          )}
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

      {/* AI Recap Modal */}
      {showRecap && (
        <View style={styles.recapOverlay}>
          <View style={styles.recapModal}>
            <Text style={styles.recapTitle}>AI Catch-up Recap</Text>
            <Text style={styles.recapText}>
              This waffle shows a cozy coffee moment at the recommended shop. The atmosphere 
              looks perfect for some quality coffee time, and it seems like the group's 
              suggestion was a hit! The setting appears warm and inviting.
            </Text>
            <TouchableOpacity 
              style={styles.recapCloseButton}
              onPress={() => setShowRecap(false)}
            >
              <Text style={styles.recapCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    maxWidth: width * 0.8,
  },
  ownMessage: {
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
  messageContent: {
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
  ownMessageContent: {
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
  textExpiryBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textExpiryText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginLeft: 2,
  },
  textExpiryBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  textExpiryTextInline: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginLeft: 4,
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
  viewOnceOverlay: {
    width: '100%',
    height: 160,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnceText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginTop: 4,
  },
  expiryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  expiryText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    marginLeft: 2,
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
  recapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  recapModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: width - 80,
  },
  recapTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  recapText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  recapCloseButton: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  recapCloseText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});