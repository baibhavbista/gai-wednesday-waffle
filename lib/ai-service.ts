import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

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
    // below, check if data.suggestions.captions is an array, otherwise just return an empty array 
    if (Array.isArray(data.suggestions.captions)) {
      return data.suggestions.captions;
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error getting caption suggestions:', error);
    throw error;
  }
};

/**
 * Fetches AI-generated caption suggestions from the backend service using an audio file.
 *
 * @param audioUri The URI of the local audio file.
 * @param styleCaptions An array of strings representing example captions to guide the AI's style.
 * @returns A promise that resolves to an array of caption suggestions.
 */
export const getCaptionSuggestionsFromAudio = async (
  audioUri: string,
  styleCaptions: string[]
): Promise<string[]> => {
  const serviceUrl = process.env.EXPO_PUBLIC_CAPTION_SERVICE_URL;
  if (!serviceUrl) {
    throw new Error('Caption service URL is not defined in environment variables.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('User is not authenticated.');
  }

  const formData = new FormData();
  // The 'as any' is a workaround for React Native's FormData typing.
  formData.append('audioChunk', {
    uri: audioUri,
    name: `audio.m4a`,  // Always use .m4a as the backend will convert it
    type: 'audio/x-m4a',  // More standard MIME type for M4A files
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
      console.error('❌ Server error details:', errorData);
      throw new Error(errorData.error || 'Failed to get caption suggestions from audio.');
    }

    const data = await response.json();

    let out;
    // below, check if data.suggestions.captions is an array, otherwise just return an empty array 
    if (Array.isArray(data.suggestions.captions)) {
      out =  data.suggestions.captions;
    } else {
      out =  [];
    }
    console.log('Caption suggestions from audio:data:', out, data);
    return out;
  } catch (error) {
    console.error('Error getting caption suggestions from audio:', error);
    throw error;
  }
};

/**
 * Fetches conversation starter prompts (Prompt-Me-Please).
 *
 * @param groupId UUID of the group.
 * @param userUid Authenticated user's UID (profiles.id).
 * @returns Promise resolving to an array with 2 prompt strings.
 */
export const getConversationStarters = async (
  groupId: string,
  userUid: string
): Promise<string[]> => {
  console.log('getConversationStarters', groupId, userUid);
  const serviceUrl = process.env.EXPO_PUBLIC_CAPTION_SERVICE_URL; // same backend base URL
  if (!serviceUrl) {
    throw new Error('Backend service URL is not defined in environment variables.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('User is not authenticated.');
  }

  try {
    const response = await fetch(`${serviceUrl}/ai/convo-starter`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ group_id: groupId, user_uid: userUid }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get conversation starters.');
    }

    const data = await response.json();
    console.log('Conversation starters:data:', data);
    if (Array.isArray(data.prompts)) {
      return data.prompts;
    }
    return [];
  } catch (error) {
    console.error('Error fetching conversation starters:', error);
    throw error;
  }
}; 