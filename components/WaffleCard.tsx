import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Heart, MessageCircle, Clock, Eye } from 'lucide-react-native';
import { WaffleMessage } from '@/store/useWaffleStore';

const { width } = Dimensions.get('window');

interface WaffleCardProps {
  waffle: WaffleMessage;
  onLike: (waffleId: string) => void;
  onViewRecap: (waffleId: string) => void;
}

export default function WaffleCard({ waffle, onLike, onViewRecap }: WaffleCardProps) {
  const [showRecap, setShowRecap] = useState(false);

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const getExpiryText = () => {
    if (waffle.retentionType === 'view-once') return 'View once';
    if (waffle.retentionType === 'keep-forever') return 'Saved forever';
    
    const now = new Date();
    const expiresIn = Math.ceil((waffle.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `${expiresIn}d left`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={{ uri: waffle.userAvatar || 'https://via.placeholder.com/40' }} style={styles.avatar} />
          <View>
            <Text style={styles.userName}>{waffle.userName}</Text>
            <Text style={styles.timeAgo}>{getTimeAgo(waffle.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.expiryBadge}>
          <Clock size={12} color="#9CA3AF" />
          <Text style={styles.expiryText}>{getExpiryText()}</Text>
        </View>
      </View>

      {/* Content */}
      {waffle.content.type === 'text' ? (
        // Text-only waffle layout
        <View style={styles.textContentContainer}>
          <Text style={styles.textContent}>{waffle.caption}</Text>
        </View>
      ) : (
        // Media waffle layout
        <>
          <TouchableOpacity 
            style={styles.contentContainer}
            onPress={() => waffle.retentionType === 'view-once' && !waffle.viewed && setShowRecap(!showRecap)}
          >
            {waffle.retentionType === 'view-once' && !waffle.viewed ? (
              <View style={styles.viewOnceOverlay}>
                <Eye size={32} color="#FFFFFF" />
                <Text style={styles.viewOnceText}>Tap to view</Text>
              </View>
            ) : (
              <Image source={{ uri: waffle.content.url || 'https://via.placeholder.com/300x200' }} style={styles.contentImage} />
            )}
          </TouchableOpacity>

          {/* Caption for media waffles */}
          {waffle.caption && (
            <Text style={styles.caption}>{waffle.caption}</Text>
          )}
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, waffle.hasLiked && styles.likedButton]}
          onPress={() => onLike(waffle.id)}
        >
          <Heart 
            size={20} 
            color={waffle.hasLiked ? "#EF4444" : "#9CA3AF"} 
            fill={waffle.hasLiked ? "#EF4444" : "none"}
          />
          <Text style={[styles.actionText, waffle.hasLiked && styles.likedText]}>
            {waffle.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onViewRecap(waffle.id)}
        >
          <MessageCircle size={20} color="#9CA3AF" />
          <Text style={styles.actionText}>Recap</Text>
        </TouchableOpacity>
      </View>

      {/* AI Recap Modal */}
      {showRecap && (
        <View style={styles.recapOverlay}>
          <View style={styles.recapModal}>
            <Text style={styles.recapTitle}>AI Catch-up Recap</Text>
            <Text style={styles.recapText}>
              Sarah discovered a new coffee shop that the group had recommended. She's enjoying 
              a cozy moment with what appears to be a great cup of coffee, finally taking the 
              advice from her friends. The atmosphere looks perfect for some quality coffee time.
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  timeAgo: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiryText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginLeft: 4,
  },
  textContentContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textContent: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 24,
  },
  contentContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  contentImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  viewOnceOverlay: {
    width: '100%',
    height: 200,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnceText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginTop: 8,
  },
  caption: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  likedButton: {},
  actionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginLeft: 6,
  },
  likedText: {
    color: '#EF4444',
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
    fontSize: 18,
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