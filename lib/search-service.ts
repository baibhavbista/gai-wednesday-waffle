import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';


const SEARCH_API_URL = process.env.EXPO_PUBLIC_CAPTION_SERVICE_URL;

export interface SearchFilters {
  groups?: string[];
  users?: string[];
  dateRange?: { start: Date; end: Date };
  mediaType?: 'video' | 'photo' | 'all';
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  groupName: string;
  groupId: string;
  videoUrl: string;
  thumbnailUrl: string;
  transcript: string;
  matchStart: number;
  matchEnd: number;
  timestamp: number;
  videoDuration: number;
  createdAt: Date;
  matchPositions: number[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  suggestions: string[];
  processingStatus: 'complete' | 'partial';
  searchId?: string;
  aiAnswer?: {
    status: 'pending' | 'complete' | 'error';
    text: string | null;
  };
}

class SearchService {
  /**
   * Test backend connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[SearchService] Testing connection to:', `${SEARCH_API_URL}/health`);
      
      const response = await fetch(`${SEARCH_API_URL}/health`, {
        method: 'GET',
      });
      
      console.log('[SearchService] Health check response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[SearchService] Health check response:', data);
        return true;
      } else {
        console.error('[SearchService] Health check failed:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('[SearchService] Health check error:', error);
      return false;
    }
  }

  /**
   * Search waffles using natural language query
   */
  async searchWaffles(request: SearchRequest): Promise<SearchResponse> {
    try {
      console.log('[SearchService] Starting search with request:', JSON.stringify(request, null, 2));
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[SearchService] No auth token available');
        throw new Error('Authentication required');
      }
      
      console.log('[SearchService] Auth token obtained, making request to:', `${SEARCH_API_URL}/api/search/waffles`);

      // Make API request
      const response = await fetch(`${SEARCH_API_URL}/api/search/waffles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: request.query,
          filters: request.filters,
          limit: request.limit || 10,
          offset: request.offset || 0,
        }),
      });

      console.log('[SearchService] Response status:', response.status);
      console.log('[SearchService] Response headers:', response.headers);
      
      // Get response text first to debug
      const responseText = await response.text();
      // console.log('[SearchService] Raw response text:', responseText);

      if (!response.ok) {
        console.error('[SearchService] Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
        });
        
        // Try to parse as JSON if possible
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('[SearchService] Failed to parse error response as JSON');
          errorData = { error: `Server error: ${response.status} - ${responseText.substring(0, 100)}` };
        }
        
        throw new Error(errorData.error || 'Search failed');
      }

      // Parse successful response
      let data;
      try {
        data = JSON.parse(responseText);
        // console.log('[SearchService] Parsed response data:', data);
      } catch (parseError) {
        console.error('[SearchService] Failed to parse successful response as JSON:', parseError);
        console.error('[SearchService] Response text that failed to parse:', responseText);
        throw new Error('Invalid response format from server');
      }
      
      // Save to recent searches if successful
      if (data.results && data.results.length > 0) {
        await this.saveRecentSearch(request.query);
      }

      return data;
    } catch (error) {
      console.error('[SearchService] Search error:', error);
      console.error('[SearchService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery: string): Promise<string[]> {
    try {
      // TODO: Implement real-time search suggestions
      // This could use a combination of:
      // 1. Popular searches
      // 2. User's search history
      // 3. Auto-complete from transcript content
      
      // Mock implementation
      const mockSuggestions = [
        'weekend plans',
        'new job',
        'coffee recommendations',
        'birthday celebration',
        'travel stories',
      ];

      return mockSuggestions.filter(s => 
        s.toLowerCase().includes(partialQuery.toLowerCase())
      );
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Save a search query to user's history
   */
  async saveSearchHistory(query: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save to search_history table
      await supabase
        .from('search_history')
        .insert({
          user_id: user.id,
          query: query,
          results_count: 0, // Will be updated when search completes
        });
    } catch (error) {
      // Don't throw - search history is not critical
      console.error('Failed to save search history:', error);
    }
  }

  /**
   * Get user's recent search history
   */
  async getSearchHistory(limit: number = 10): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('search_history')
        .select('query')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Remove duplicates while preserving order
      const uniqueQueries = new Set<string>();
      const orderedQueries: string[] = [];
      
      data?.forEach(item => {
        if (!uniqueQueries.has(item.query)) {
          uniqueQueries.add(item.query);
          orderedQueries.push(item.query);
        }
      });

      return orderedQueries;
    } catch (error) {
      console.error('Failed to get search history:', error);
      return [];
    }
  }

  /**
   * Clear user's search history
   */
  async clearSearchHistory(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('search_history')
        .delete()
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Failed to clear search history:', error);
      throw error;
    }
  }

  /**
   * Generate video thumbnail URL
   * In production, this would be handled by the backend
   */
  generateThumbnailUrl(videoUrl: string): string {
    // TODO: Implement actual thumbnail generation
    // This could use a service like Cloudinary or custom backend endpoint
    return 'https://picsum.photos/200/120';
  }

  private async saveRecentSearch(query: string): Promise<void> {
    try {
      const recentSearches = await this.getRecentSearches();
      recentSearches.push(query);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  }

  private async getRecentSearches(): Promise<string[]> {
    try {
      const recentSearches = await AsyncStorage.getItem('recentSearches');
      return recentSearches ? JSON.parse(recentSearches) : [];
    } catch (error) {
      console.error('Failed to get recent searches:', error);
      return [];
    }
  }

  /**
   * Stream AI answer updates via SSE
   */
  async streamAIAnswer(
    searchId: string, 
    onUpdate: (data: { status: string; text?: string }) => void
  ): Promise<() => void> {
    try {
      console.log('[SearchService] Starting SSE connection for search:', searchId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // Use EventSource polyfill for React Native
      const EventSource = require('react-native-sse').default;
      
      const eventSource = new EventSource(
        `${SEARCH_API_URL}/api/search/ai-stream/${searchId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      eventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SearchService] SSE message:', data);
          onUpdate(data);
          
          // Close connection if complete or error
          if (data.status === 'complete' || data.status === 'error') {
            eventSource.close();
          }
        } catch (error) {
          console.error('[SearchService] Failed to parse SSE message:', error);
        }
      });
      
      eventSource.addEventListener('error', (error: any) => {
        console.error('[SearchService] SSE error:', error);
        onUpdate({ status: 'error', text: 'Connection lost' });
        eventSource.close();
      });
      
      // Return cleanup function
      return () => {
        console.log('[SearchService] Closing SSE connection');
        eventSource.close();
      };
    } catch (error) {
      console.error('[SearchService] Failed to start SSE:', error);
      throw error;
    }
  }
}

export const searchService = new SearchService(); 