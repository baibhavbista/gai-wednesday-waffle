import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Camera, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface WednesdayNudgeProps {
  visible: boolean;
  onDismiss: () => void;
  onTakeWaffle: () => void;
  groupName: string;
  missingMembers: string[];
}

export default function WednesdayNudge({ 
  visible, 
  onDismiss, 
  onTakeWaffle, 
  groupName, 
  missingMembers 
}: WednesdayNudgeProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Camera size={32} color="#F97316" />
          </View>
        </View>

        <Text style={styles.title}>Wednesday Waffle Time! 🧇</Text>
        <Text style={styles.subtitle}>Drop a quick life update for {groupName}</Text>

        {missingMembers.length > 0 && (
          <View style={styles.missingContainer}>
            <Text style={styles.missingLabel}>Still waiting for:</Text>
            <Text style={styles.missingNames}>{missingMembers.join(', ')}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.takeButton} onPress={onTakeWaffle}>
          <Camera size={20} color="#FFFFFF" />
          <Text style={styles.takeButtonText}>Take Your Waffle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
          <Text style={styles.laterButtonText}>Maybe Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxWidth: width - 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  missingContainer: {
    backgroundColor: '#FEF7ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  missingLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  missingNames: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#F97316',
  },
  takeButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  takeButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  laterButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  laterButtonText: {
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
});