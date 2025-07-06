import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Play, MessageSquare, Share2 } from 'lucide-react-native';

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
  matchStart: number;
  matchEnd: number;
  timestamp: number;
  videoDuration: number;
  createdAt: Date | string;
  matchPositions: number[];
}

interface SearchResultCardProps {
  result: SearchResult;
  searchQuery: string;
  onPress: () => void;
}

export default function SearchResultCard({ result, searchQuery, onPress }: SearchResultCardProps) {
  const [showFullContext, setShowFullContext] = useState(false);

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

  // Highlight matching text
  const renderHighlightedTranscript = () => {
    const beforeMatch = result.transcript.substring(0, result.matchStart);
    const match = result.transcript.substring(result.matchStart, result.matchEnd);
    const afterMatch = result.transcript.substring(result.matchEnd);

    return (
      <Text style={styles.transcriptText}>
        {showFullContext ? (
          <>
            {beforeMatch}
            <Text style={styles.highlightedText}>{match}</Text>
            {afterMatch}
          </>
        ) : (
          <>
            {beforeMatch.length > 50 ? '...' + beforeMatch.slice(-50) : beforeMatch}
            <Text style={styles.highlightedText}>{match}</Text>
            {afterMatch.slice(0, 50)}{afterMatch.length > 50 ? '...' : ''}
          </>
        )}
      </Text>
    );
  };

  // Calculate timeline position
  const getTimelinePosition = (timestamp: number) => {
    return (timestamp / result.videoDuration) * 100;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      {/* User Info Header */}
      <View style={styles.header}>
        <Image source={{ uri: result.userAvatar }} style={styles.avatar} />
        <View style={styles.headerText}>
          <Text style={styles.userName}>{result.userName}</Text>
          <Text style={styles.groupName}>{result.groupName} • {formatRelativeTime(result.createdAt)}</Text>
        </View>
      </View>

      {/* Video Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image source={{ uri: result.thumbnailUrl }} style={styles.thumbnail} />
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatTime(result.videoDuration)}</Text>
        </View>
      </View>

      {/* Transcript with Highlighting */}
      <View style={styles.transcriptContainer}>
        {renderHighlightedTranscript()}
      </View>

      {/* Video Timeline */}
      <View style={styles.timelineContainer}>
        <View style={styles.timeline}>
          {/* Progress line */}
          <View style={styles.timelineTrack} />
          
          {/* Match indicators */}
          {result.matchPositions.map((position, index) => (
            <View
              key={index}
              style={[
                styles.matchIndicator,
                { left: `${getTimelinePosition(position)}%` },
                position === result.timestamp && styles.activeMatchIndicator,
              ]}
            />
          ))}
        </View>
        <Text style={styles.timelineText}>
          {formatTime(result.timestamp)} / {formatTime(result.videoDuration)}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowFullContext(!showFullContext)}
        >
          <MessageSquare size={16} color="#6B7280" />
          <Text style={styles.actionText}>
            {showFullContext ? 'Less' : 'Context'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Play size={16} color="#6B7280" />
          <Text style={styles.actionText}>Watch</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Share2 size={16} color="#6B7280" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  groupName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  thumbnailContainer: {
    width: width - 32,
    height: (width - 32) * 0.6,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  transcriptContainer: {
    padding: 12,
  },
  transcriptText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  highlightedText: {
    backgroundColor: '#FEF3E8',
    color: '#F97316',
    fontFamily: 'Inter-SemiBold',
  },
  timelineContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  timeline: {
    height: 24,
    position: 'relative',
    justifyContent: 'center',
  },
  timelineTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  matchIndicator: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
    top: 8,
    marginLeft: -4,
  },
  activeMatchIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 6,
    marginLeft: -6,
    backgroundColor: '#EA580C',
  },
  timelineText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 6,
  },
}); 