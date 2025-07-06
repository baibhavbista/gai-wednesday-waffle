import * as VideoThumbnails from 'expo-video-thumbnails';

export interface ThumbnailOptions {
  thumbnailUrl?: string | null;
  videoUrl: string;
  fallbackTime?: number;
  quality?: number;
}

/**
 * Get video thumbnail with optimized backend thumbnail as primary source
 * and client-side generation as fallback
 */
export async function getVideoThumbnail(options: ThumbnailOptions): Promise<string | null> {
  const { thumbnailUrl, videoUrl, fallbackTime = 1000, quality = 0.8 } = options;
  
  // First, check if we have a backend-generated thumbnail
  if (thumbnailUrl && !thumbnailUrl.includes('picsum.photos')) {
    console.log('[Thumbnail] Using optimized backend thumbnail:', thumbnailUrl);
    return thumbnailUrl;
  }
  
  // Fallback to client-side thumbnail generation
  console.log('[Thumbnail] No backend thumbnail, generating client-side for:', videoUrl);
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(
      videoUrl,
      {
        time: fallbackTime, // Get thumbnail at specified time (default 1 second)
        quality: quality, // Good quality
      }
    );
    console.log('[Thumbnail] Client-side thumbnail generated:', uri);
    return uri;
  } catch (error) {
    console.warn('[Thumbnail] Failed to generate client-side thumbnail:', error);
    return null;
  }
}

/**
 * Check if a thumbnail URL is valid (not a placeholder)
 */
export function isValidThumbnailUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return !url.includes('picsum.photos');
} 