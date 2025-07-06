import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  ScrollView,
} from 'react-native';
import { BarChart3, Lightbulb, Search } from 'lucide-react-native';
import { getCatchUpSummary, getConversationStarters } from '../lib/ai-service';

interface AISuggestionPillsProps {
  groupId: string;
  userId: string;
  onNeedIdeasPress: (prompts: string[]) => void;
  onFindPress: () => void;
  visible: boolean;
}

export default function AISuggestionPills({
  groupId,
  userId,
  onNeedIdeasPress,
  onFindPress,
  visible,
}: AISuggestionPillsProps) {
  const [catchUpLoading, setCatchUpLoading] = useState(false);
  const [needIdeasLoading, setNeedIdeasLoading] = useState(false);
  const [findLoading, setFindLoading] = useState(false);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [catchUpSummary, setCatchUpSummary] = useState<string | null>(null);
  const [catchUpMetadata, setCatchUpMetadata] = useState<{ 
    waffleCount: number; 
    days: number; 
    cached: boolean; 
  } | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const scaleAnimCatchUp = useRef(new Animated.Value(1)).current;
  const scaleAnimNeedIdeas = useRef(new Animated.Value(1)).current;
  const scaleAnimFind = useRef(new Animated.Value(1)).current;

  // Animate pills in/out based on visibility
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 15,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 10,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const handleCatchUpPress = async () => {
    if (catchUpLoading || needIdeasLoading || findLoading) return;

    // Animate press
    Animated.sequence([
      Animated.spring(scaleAnimCatchUp, {
        toValue: 0.95,
        speed: 20,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimCatchUp, {
        toValue: 1,
        damping: 15,
        useNativeDriver: true,
      }),
    ]).start();

    setCatchUpLoading(true);

    try {
      // Fetch catch-up summary from backend
      const response = await getCatchUpSummary(groupId, 10);
      
      setCatchUpSummary(response.summary);
      setCatchUpMetadata({
        waffleCount: response.waffleCount,
        days: response.days,
        cached: response.cached,
      });
      setShowRecapModal(true);
    } catch (error) {
      console.error('Failed to get catch up summary:', error);
      
      // Show error alert
      Alert.alert(
        'Unable to Generate Summary',
        'Could not fetch the catch-up summary. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setCatchUpLoading(false);
    }
  };

  const handleNeedIdeasPress = async () => {
    if (catchUpLoading || needIdeasLoading || findLoading) return;

    // Animate press
    Animated.sequence([
      Animated.spring(scaleAnimNeedIdeas, {
        toValue: 0.95,
        speed: 20,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimNeedIdeas, {
        toValue: 1,
        damping: 15,
        useNativeDriver: true,
      }),
    ]).start();

    setNeedIdeasLoading(true);

    try {
      // Call real AI service to get conversation starters
      const prompts = await getConversationStarters(groupId, userId);
      
      if (prompts && prompts.length > 0) {
        onNeedIdeasPress(prompts);
      } else {
        // Fallback if no prompts are returned
        Alert.alert(
          'No Ideas Available',
          'Unable to generate conversation starters at this time. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to get conversation starters:', error);
      Alert.alert(
        'Error',
        'Failed to load conversation ideas. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setNeedIdeasLoading(false);
    }
  };

  const handleFindPress = async () => {
    if (catchUpLoading || needIdeasLoading || findLoading) return;

    // Animate press
    Animated.sequence([
      Animated.spring(scaleAnimFind, {
        toValue: 0.95,
        speed: 20,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimFind, {
        toValue: 1,
        damping: 15,
        useNativeDriver: true,
      }),
    ]).start();

    setFindLoading(true);

    try {
      // Brief loading state before navigation
      await new Promise(resolve => setTimeout(resolve, 200));
      onFindPress();
    } catch (error) {
      console.error('Failed to open search:', error);
    } finally {
      setFindLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Catch Up Pill */}
        <Animated.View style={{ transform: [{ scale: scaleAnimCatchUp }] }}>
          <TouchableOpacity
            style={[
              styles.pill,
              (catchUpLoading || needIdeasLoading || findLoading) && styles.pillDisabled,
            ]}
            onPress={handleCatchUpPress}
            disabled={catchUpLoading || needIdeasLoading || findLoading}
            activeOpacity={0.8}
          >
            {catchUpLoading ? (
              <ActivityIndicator size="small" color="#F97316" />
            ) : (
              <>
                <BarChart3 size={16} color="#F97316" style={styles.icon} />
                <Text style={styles.pillText}>Catch up</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Need Ideas Pill */}
        <Animated.View style={{ transform: [{ scale: scaleAnimNeedIdeas }] }}>
          <TouchableOpacity
            style={[
              styles.pill,
              (catchUpLoading || needIdeasLoading || findLoading) && styles.pillDisabled,
            ]}
            onPress={handleNeedIdeasPress}
            disabled={catchUpLoading || needIdeasLoading || findLoading}
            activeOpacity={0.8}
          >
            {needIdeasLoading ? (
              <ActivityIndicator size="small" color="#F97316" />
            ) : (
              <>
                <Lightbulb size={16} color="#F97316" style={styles.icon} />
                <Text style={styles.pillText}>Need ideas?</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Find Pill */}
        <Animated.View style={{ transform: [{ scale: scaleAnimFind }] }}>
          <TouchableOpacity
            style={[
              styles.pill,
              (catchUpLoading || needIdeasLoading || findLoading) && styles.pillDisabled,
            ]}
            onPress={handleFindPress}
            disabled={catchUpLoading || needIdeasLoading || findLoading}
            activeOpacity={0.8}
          >
            {findLoading ? (
              <ActivityIndicator size="small" color="#F97316" />
            ) : (
              <>
                <Search size={16} color="#F97316" style={styles.icon} />
                <Text style={styles.pillText}>Find</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Recap Modal - Similar to existing Recap UI */}
      {showRecapModal && catchUpSummary && (
        <TouchableOpacity
          style={styles.recapOverlay}
          onPress={() => setShowRecapModal(false)}
          activeOpacity={1}
        >
          <View style={styles.recapModal}>
            <View style={styles.recapHeader}>
              <BarChart3 size={20} color="#F97316" />
              <Text style={styles.recapTitle}>Catch Up Summary</Text>
            </View>
            
            {catchUpMetadata && (
              <View style={styles.recapMetadata}>
                <Text style={styles.recapMetaText}>
                  {catchUpMetadata.waffleCount > 0
                    ? `${catchUpMetadata.waffleCount} waffle${catchUpMetadata.waffleCount !== 1 ? 's' : ''} from the last ${catchUpMetadata.days} days`
                    : `Last ${catchUpMetadata.days} days`}
                </Text>
                {/* {catchUpMetadata.cached && (
                  <Text style={styles.recapCachedText}>• Cached</Text>
                )} */}
              </View>
            )}
            
            <ScrollView 
              style={styles.recapScrollView}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.recapText}>{catchUpSummary}</Text>
            </ScrollView>
            
            <TouchableOpacity
              style={styles.recapCloseButton}
              onPress={() => {
                setShowRecapModal(false);
                setCatchUpSummary(null);
                setCatchUpMetadata(null);
              }}
            >
              <Text style={styles.recapCloseText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    minWidth: 100,
    justifyContent: 'center',
  },
  pillDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: 6,
  },
  pillText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#F97316',
  },
  // Recap Modal Styles
  recapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  recapModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  recapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  recapTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
  },
  recapMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  recapMetaText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  recapCachedText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  recapScrollView: {
    maxHeight: 300,
    marginBottom: 20,
  },
  recapText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
    textAlign: 'left',
  },
  recapCloseButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  recapCloseText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
}); 