import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Brain, Sparkles } from 'lucide-react-native';

interface AIAnswerCardProps {
  query: string;
  answer?: string | null;
  status: 'pending' | 'streaming' | 'complete' | 'error';
}

export default function AIAnswerCard({ query, answer, status }: AIAnswerCardProps) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if ((status === 'complete' || status === 'streaming') && answer) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [status, answer]);

  if (status === 'error') {
    return null; // Silently fail
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {status === 'pending' ? (
            <Brain size={20} color="#F97316" />
          ) : (
            <Sparkles size={20} color="#F97316" />
          )}
        </View>
        <Text style={styles.title}>AI Summary</Text>
      </View>

      {status === 'pending' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F97316" />
          <Text style={styles.loadingText}>
            Analyzing videos about &ldquo;{query}&rdquo;...
          </Text>
        </View>
      ) : (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.answerText}>
            {answer}
            {status === 'streaming' && (
              <Text style={styles.cursor}>▊</Text>
            )}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3E8',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDD6A8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginLeft: 12,
  },
  answerText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#78350F',
    lineHeight: 22,
  },
  cursor: {
    color: '#F97316',
    opacity: 0.7,
  },
}); 