import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

/**
 * Fetches AI-generated caption suggestions from the backend service.
 *
 * @param videoUri The URI of the local video file.
 * @param groupId Optional group ID for context-aware caption generation.
 * @returns A promise that resolves to an array of caption suggestions.
 */
export const getCaptionSuggestions = async (
  videoUri: string,
  groupId?: string | null
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
  
  // Add group_id if provided
  if (groupId) {
    formData.append('group_id', groupId);
  }

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
    if (Array.isArray(data.suggestions)) {
      return data.suggestions;
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
 * @param groupId Optional group ID for context-aware caption generation.
 * @returns A promise that resolves to an array of caption suggestions.
 */
export const getCaptionSuggestionsFromAudio = async (
  audioUri: string,
  groupId?: string | null
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
  
  // Add group_id if provided
  if (groupId) {
    formData.append('group_id', groupId);
  }

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
    if (Array.isArray(data.suggestions)) {
      out =  data.suggestions;
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
    if (Array.isArray(data.suggestions)) {
      return data.suggestions;
    }
    return [];
  } catch (error) {
    console.error('Error fetching conversation starters:', error);
    throw error;
  }
};

export interface AIRecapResponse {
  recap: string | null;
  error?: string;
}

/**
 * Fetch AI-generated recap for a waffle message
 */
export async function fetchWaffleRecap(contentUrl: string): Promise<AIRecapResponse> {
  try {
    console.log('Fetching AI recap for content URL:', contentUrl);
    
    const { data, error } = await supabase
      .from('transcripts')
      .select('ai_recap')
      .eq('content_url', contentUrl)
      .single();

    if (error) {
      console.error('Error fetching AI recap:', error);
      return {
        recap: null,
        error: 'Failed to fetch recap'
      };
    }

    if (!data?.ai_recap) {
      console.log('No AI recap found for this waffle');
      return {
        recap: null,
        error: 'No recap available for this waffle yet'
      };
    }

    console.log('Successfully fetched AI recap');
    return {
      recap: data.ai_recap
    };
  } catch (error) {
    console.error('Unexpected error fetching AI recap:', error);
    return {
      recap: null,
      error: 'An unexpected error occurred'
    };
  }
}

/**
 * Check if a waffle has an AI recap available
 */
export async function hasWaffleRecap(contentUrl: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('transcripts')
      .select('ai_recap')
      .eq('content_url', contentUrl)
      .single();

    return !error && !!data?.ai_recap;
  } catch (error) {
    console.error('Error checking recap availability:', error);
    return false;
  }
}

export interface CatchUpSummaryResponse {
  summary: string;
  cached: boolean;
  waffleCount: number;
  days: number;
}

/**
 * Fetch AI-generated catch-up summary for a group
 * @param groupId The group ID to get the summary for
 * @param days Optional number of days to look back (default: 10, max: 30)
 * @returns Promise resolving to catch-up summary data
 */
export async function getCatchUpSummary(
  groupId: string,
  days: number = 10
): Promise<CatchUpSummaryResponse> {
  const serviceUrl = process.env.EXPO_PUBLIC_CAPTION_SERVICE_URL;
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
    console.log(`[CatchUp] Fetching summary for group ${groupId}, last ${days} days`);
    
    const response = await fetch(`${serviceUrl}/api/catchup/${groupId}?days=${days}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CatchUp] API error:', errorData);
      throw new Error(errorData.error || 'Failed to get catch-up summary.');
    }

    const data = await response.json();
    console.log('[CatchUp] Received summary:', data);
    
    return data as CatchUpSummaryResponse;
  } catch (error) {
    console.error('[CatchUp] Error fetching catch-up summary:', error);
    throw error;
  }
} 