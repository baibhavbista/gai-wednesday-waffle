import { supabase } from './supabase';

/**
 * Fetches AI-generated caption suggestions from the backend service.
 *
 * @param videoUri The URI of the local video file.
 * @param styleCaptions An array of strings representing example captions to guide the AI's style.
 * @returns A promise that resolves to an array of caption suggestions.
 */
export const getCaptionSuggestions = async (
  videoUri: string,
  styleCaptions: string[]
): Promise<string[]> => {
  // TODO: Replace with your actual Render service URL from your environment variables.
  const serviceUrl = process.env.EXPO_PUBLIC_CAPTION_SERVICE_URL;
  if (!serviceUrl) {
    throw new Error('Caption service URL is not defined in environment variables.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('User is not authenticated.');
  }

  const formData = new FormData();
  // The 'as any' is a workaround for React Native's FormData typing.
  formData.append('videoChunk', {
    uri: videoUri,
    name: 'video.mov',
    type: 'video/mov',
  } as any);
  formData.append('styleCaptions', JSON.stringify(styleCaptions));

  try {
    const response = await fetch(`${serviceUrl}/generate-captions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get caption suggestions.');
    }

    const data = await response.json();

    console.log('Caption suggestions:data:', data);
    return data.suggestions.captions || [];
  } catch (error) {
    console.error('Error getting caption suggestions:', error);
    throw error;
  }
}; 