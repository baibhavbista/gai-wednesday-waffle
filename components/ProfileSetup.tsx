import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { ProfileService, type UpdateProfileData } from '../lib/profile-service'
import { useAuth } from '../hooks/useAuth'
import { NotificationService } from '../lib/notification-service'

interface ProfileSetupProps {
  userId: string
  initialName?: string
  initialAvatar?: string | null
}

export default function ProfileSetup({ userId, initialName, initialAvatar }: ProfileSetupProps) {
  const [name, setName] = useState(initialName || '')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  async function handleSaveProfile() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    try {
      setLoading(true)

      // Request notification permissions
      const notificationGranted = await NotificationService.requestPermissions()
      console.log('Notification permission granted:', notificationGranted)

      // Try to update existing profile first
      const updateData: UpdateProfileData = {
        name: name.trim(),
        avatar_url: initialAvatar || null,
        notification_permission_requested: true,
        notifications_enabled: notificationGranted,
      }

      const { data: updatedProfile, error: updateError } = await ProfileService.updateProfile(userId, updateData)

      if (updateError) {
        // If update fails, try to create profile
        const { data: newProfile, error: createError } = await ProfileService.createProfile({
          id: userId,
          name: name.trim(),
          avatar_url: initialAvatar || null,
        })

        if (createError) {
          throw createError
        }

        console.log('✅ Profile created:', newProfile)
        
        // Update notification fields after creation
        await ProfileService.updateProfile(userId, {
          notification_permission_requested: true,
          notifications_enabled: notificationGranted,
        })
      } else {
        console.log('✅ Profile updated:', updatedProfile)
      }

      // Schedule notifications if permission was granted
      if (notificationGranted) {
        await NotificationService.scheduleWeeklyNudges()
        console.log('✅ Wednesday nudges scheduled')
      }

      // Force a refresh of auth state to pick up the new profile
      // The useAuth hook will automatically handle the profile fetch
      
    } catch (error) {
      console.error('❌ Profile save error:', error)
      Alert.alert('Error', 'Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Let&apos;s set up your profile to get started
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <Text style={styles.infoText}>
          We&apos;ll send you gentle reminders every Wednesday to share your waffle with friends. You can change this anytime in settings.
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSaveProfile}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Setting up...' : 'Get Started'}
        </Text>
      </TouchableOpacity>

      {!initialName && (
        <Text style={styles.infoText}>
          You can update your profile anytime in settings
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
}) 