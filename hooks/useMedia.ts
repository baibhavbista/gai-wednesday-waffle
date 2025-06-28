import { useState } from 'react'
import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { storageService, FILE_CONSTRAINTS } from '../lib/storage-service'
import { useAuth } from './useAuth'

export interface MediaPickerOptions {
  allowsEditing?: boolean
  quality?: number
  mediaTypes?: 'photos' | 'videos' | 'all'
  aspect?: [number, number]
}

export interface MediaResult {
  uri: string
  type: 'photo' | 'video'
  width?: number
  height?: number
  duration?: number
}

export function useMedia() {
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { session } = useAuth()

  // Request permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Wednesday Waffle needs camera and photo library permissions to share waffles!'
      )
      return false
    }
    return true
  }

  // Take photo with camera
  const takePhoto = async (options: MediaPickerOptions = {}): Promise<MediaResult | null> => {
    try {
      const hasPermission = await requestPermissions()
      if (!hasPermission) return null

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect ?? [4, 3],
        quality: options.quality ?? 0.8,
        exif: false, // Don't include metadata for privacy
      })

      if (result.canceled || !result.assets?.[0]) return null

      const asset = result.assets[0]
      return {
        uri: asset.uri,
        type: 'photo',
        width: asset.width,
        height: asset.height,
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Take photo error:', error)
      Alert.alert('Error', 'Failed to take photo. Please try again.')
      return null
    }
  }

  // Record video with camera  
  const recordVideo = async (): Promise<MediaResult | null> => {
    try {
      const hasPermission = await requestPermissions()
      if (!hasPermission) return null

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: ImagePicker.UIImagePickerControllerQualityType.High, // High quality for better processing
        videoMaxDuration: FILE_CONSTRAINTS.VIDEO.MAX_DURATION, // 5 minutes
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High, // Record high, compress later
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality, // Target 720p equivalent
      })

      if (result.canceled || !result.assets?.[0]) return null

      const asset = result.assets[0]
      return {
        uri: asset.uri,
        type: 'video',
        width: asset.width,
        height: asset.height,
        duration: asset.duration ?? undefined,
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Record video error:', error)
      Alert.alert('Error', 'Failed to record video. Please try again.')
      return null
    }
  }

  // Pick from gallery
  const pickFromGallery = async (options: MediaPickerOptions = {}): Promise<MediaResult | null> => {
    try {
      const hasPermission = await requestPermissions()
      if (!hasPermission) return null

      const mediaTypeMap = {
        'photos': ImagePicker.MediaTypeOptions.Images,
        'videos': ImagePicker.MediaTypeOptions.Videos,
        'all': ImagePicker.MediaTypeOptions.All,
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypeMap[options.mediaTypes || 'all'],
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect,
        quality: options.quality ?? 0.8,
        exif: false, // Don't include metadata for privacy
        videoMaxDuration: FILE_CONSTRAINTS.VIDEO.MAX_DURATION,
      })

      if (result.canceled || !result.assets?.[0]) return null

      const asset = result.assets[0]
      return {
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'photo',
        width: asset.width,
        height: asset.height,
        duration: asset.duration ?? undefined,
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Pick from gallery error:', error)
      Alert.alert('Error', 'Failed to select media. Please try again.')
      return null
    }
  }

  // Upload media to storage
  const uploadMedia = async (
    media: MediaResult,
    contentType: 'photo' | 'video'
  ): Promise<{ success: boolean; url?: string; path?: string; error?: string }> => {
    if (!session?.user) {
      return { success: false, error: 'User not authenticated' }
    }

    setIsLoading(true)
    setUploadProgress(0)

    try {
      const result = await storageService.uploadWaffleContent(
        media.uri,
        contentType,
        session.user.id,
        {
          onProgress: (progress) => {
            setUploadProgress(progress.percentage)
          },
          compress: contentType === 'photo',
          quality: 0.8,
        }
      )

      setIsLoading(false)
      setUploadProgress(0)

      if (!result.success) {
        Alert.alert('Upload Failed', result.error || 'Failed to upload media')
      }

      return result
    } catch (error) {
      setIsLoading(false)
      setUploadProgress(0)
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      Alert.alert('Upload Error', errorMessage)
      
      return { success: false, error: errorMessage }
    }
  }

  // Upload avatar
  const uploadAvatar = async (uri: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!session?.user) {
      return { success: false, error: 'User not authenticated' }
    }

    setIsLoading(true)

    try {
      const result = await storageService.uploadAvatar(uri, session.user.id)
      setIsLoading(false)

      if (!result.success) {
        Alert.alert('Upload Failed', result.error || 'Failed to upload avatar')
      }

      return result
    } catch (error) {
      setIsLoading(false)
      
      const errorMessage = error instanceof Error ? error.message : 'Avatar upload failed'
      Alert.alert('Upload Error', errorMessage)
      
      return { success: false, error: errorMessage }
    }
  }

  // Show media picker options
  const showMediaPicker = () => {
    Alert.alert(
      'Choose Option',
      'How would you like to share your waffle?',
      [
        { text: 'Camera', onPress: () => takePhoto() },
        { text: 'Video', onPress: () => recordVideo() },
        { text: 'Gallery', onPress: () => pickFromGallery() },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    )
  }

  return {
    isLoading,
    uploadProgress,
    takePhoto,
    recordVideo,
    pickFromGallery,
    uploadMedia,
    uploadAvatar,
    showMediaPicker,
    requestPermissions,
  }
} 