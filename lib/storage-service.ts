import { supabase } from './supabase'
import * as FileSystem from 'expo-file-system'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

// Storage bucket names
export const STORAGE_BUCKETS = {
  WAFFLES: 'waffles',    // Private bucket for waffle content
  AVATARS: 'avatars',    // Public bucket for profile avatars
} as const

// File constraints
export const FILE_CONSTRAINTS = {
  VIDEO: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_DURATION: 5 * 60,       // 5 minutes in seconds
    ALLOWED_TYPES: ['video/mp4', 'video/quicktime', 'video/mov'],
  },
  PHOTO: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
  AVATAR: {
    MAX_SIZE: 5 * 1024 * 1024,  // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface FileUploadOptions {
  onProgress?: (progress: UploadProgress) => void
  compress?: boolean
  quality?: number // 0-1 for image compression
}

export interface UploadResult {
  success: boolean
  url?: string
  path?: string
  error?: string
  metadata?: {
    size: number
    type: string
    width?: number
    height?: number
    duration?: number
  }
}

class StorageService {
  // Upload waffle content (video/photo)
  async uploadWaffleContent(
    uri: string, 
    contentType: 'video' | 'photo',
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<UploadResult> {
    try {
      if (__DEV__) console.log('📤 Uploading waffle content:', { uri, contentType, userId })

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri)
      if (!fileInfo.exists) {
        return { success: false, error: 'File does not exist' }
      }

      // Validate file size (size property exists on files)
      const constraints = contentType === 'video' ? FILE_CONSTRAINTS.VIDEO : FILE_CONSTRAINTS.PHOTO
      const fileSize = 'size' in fileInfo ? fileInfo.size : 0
      if (fileSize && fileSize > constraints.MAX_SIZE) {
        return { 
          success: false, 
          error: `File too large. Max size: ${constraints.MAX_SIZE / (1024 * 1024)}MB` 
        }
      }

      // Process file based on type
      let processedUri = uri
      let metadata = {
        size: fileSize,
        type: contentType === 'video' ? 'video/mp4' : 'image/jpeg',
      }

      if (contentType === 'photo' && options.compress !== false) {
        const compressed = await this.compressImage(uri, options.quality || 0.8)
        if (compressed.success && compressed.uri) {
          processedUri = compressed.uri
          metadata = { ...metadata, ...compressed.metadata }
        }
      }

      // Generate unique file path
      const timestamp = Date.now()
      const extension = contentType === 'video' ? 'mp4' : 'jpg'
      const fileName = `${userId}/${timestamp}-${Math.random().toString(36).substr(2, 9)}.${extension}`

      // Upload to Supabase Storage
      const fileData = await this.readFileAsArrayBuffer(processedUri)
      
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.WAFFLES)
        .upload(fileName, fileData, {
          contentType: metadata.type,
          upsert: false,
        })

      if (error) {
        if (__DEV__) console.error('❌ Upload error:', error)
        return { success: false, error: error.message }
      }

      // Get signed URL for private access
      const { data: urlData } = await supabase.storage
        .from(STORAGE_BUCKETS.WAFFLES)
        // 10 years in seconds (chatgpt says the only other solution for long running urls would be to make the bucket public)
        .createSignedUrl(data.path, 315360000)

      if (__DEV__) console.log('✅ Waffle content uploaded successfully')

      return {
        success: true,
        url: urlData?.signedUrl,
        path: data.path,
        metadata,
      }

    } catch (error) {
      if (__DEV__) console.error('❌ Upload failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      }
    }
  }

  // Upload avatar image
  async uploadAvatar(
    uri: string,
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<UploadResult> {
    try {
      if (__DEV__) console.log('📤 Uploading avatar:', { uri, userId })

      // Validate and compress image
      const compressed = await this.compressImage(uri, 0.8, { width: 400, height: 400 })
      if (!compressed.success || !compressed.uri) {
        return { success: false, error: 'Failed to process avatar image' }
      }

      // Generate file path
      const fileName = `${userId}/avatar-${Date.now()}.jpg`

      // Upload to public bucket
      const fileData = await this.readFileAsArrayBuffer(compressed.uri)
      
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .upload(fileName, fileData, {
          contentType: 'image/jpeg',
          upsert: true, // Allow overwriting existing avatar
        })

      if (error) {
        return { success: false, error: error.message }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .getPublicUrl(data.path)

      if (__DEV__) console.log('✅ Avatar uploaded successfully')

      return {
        success: true,
        url: urlData.publicUrl,
        path: data.path,
        metadata: compressed.metadata,
      }

    } catch (error) {
      if (__DEV__) console.error('❌ Avatar upload failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Avatar upload failed' 
      }
    }
  }

  // Get signed URL for private content
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.WAFFLES)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        if (__DEV__) console.error('❌ Failed to get signed URL:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      if (__DEV__) console.error('❌ Signed URL error:', error)
      return null
    }
  }

  // Delete file from storage
  async deleteFile(bucket: string, filePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath])

      if (error) {
        if (__DEV__) console.error('❌ Delete error:', error)
        return false
      }

      if (__DEV__) console.log('✅ File deleted successfully')
      return true
    } catch (error) {
      if (__DEV__) console.error('❌ Delete failed:', error)
      return false
    }
  }

  // Helper: Compress image
  private async compressImage(
    uri: string, 
    quality: number = 0.8,
    resize?: { width: number; height: number }
  ): Promise<{ success: boolean; uri?: string; metadata?: any }> {
    try {
      const manipulateOptions: any = {
        compress: quality,
        format: SaveFormat.JPEG,
      }

      if (resize) {
        manipulateOptions.resize = resize
      }

      const result = await manipulateAsync(uri, [], manipulateOptions)
      
      // Get compressed file info
      const fileInfo = await FileSystem.getInfoAsync(result.uri)
      const compressedSize = 'size' in fileInfo ? fileInfo.size || 0 : 0
      
      return {
        success: true,
        uri: result.uri,
        metadata: {
          size: compressedSize,
          type: 'image/jpeg',
          width: result.width,
          height: result.height,
        },
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Image compression failed:', error)
      return { success: false }
    }
  }

  // Helper: Read file as ArrayBuffer for upload
  private async readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
    const response = await fetch(uri)
    return await response.arrayBuffer()
  }

  // Validate file type
  validateFileType(uri: string, allowedTypes: string[]): boolean {
    // Extract file extension and check against allowed types
    const extension = uri.split('.').pop()?.toLowerCase()
    const mimeType = this.getMimeTypeFromExtension(extension || '')
    
    return allowedTypes.includes(mimeType)
  }

  // Helper: Get MIME type from file extension
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'qt': 'video/quicktime',
    }
    
    return mimeTypes[extension] || 'application/octet-stream'
  }
}

export const storageService = new StorageService() 