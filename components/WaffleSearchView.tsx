import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { ArrowLeft, Search, Mic, Filter, X } from 'lucide-react-native';
import SearchResultCard from './SearchResultCard';
import { SearchFilters } from './SearchFilters';
import { useWaffleStore } from '@/store/useWaffleStore';
import { searchService } from '@/lib/search-service';

const { width } = Dimensions.get('window');

interface WaffleSearchViewProps {
  visible: boolean;
  onClose: () => void;
  groupId?: string; // Optional: search within specific group
}

export default function WaffleSearchView({ visible, onClose, groupId }: WaffleSearchViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "Josh's new job",
    "Weekend plans",
    "Coffee recommendations",
  ]);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const { 
    groups, 
    messages, 
    currentUser,
    searchFilters,
    setSearchFilters,
    searchHistory,
  } = useWaffleStore();

  // Get group members for filter UI
  const currentGroup = groups.find(g => g.id === groupId);
  const allMembers = groups.reduce((acc, group) => {
    group.members.forEach(member => {
      if (!acc.find(m => m.id === member.id)) {
        acc.push({
          id: member.id,
          name: member.name,
          avatar: member.avatar,
        });
      }
    });
    return acc;
  }, [] as { id: string; name: string; avatar: string }[]);

  // Focus search input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
      
      // Test backend connectivity
      testBackendConnection();
    }
  }, [visible]);

  const testBackendConnection = async () => {
    console.log('[WaffleSearchView] Testing backend connection...');
    const isConnected = await searchService.testConnection();
    if (!isConnected) {
      console.error('[WaffleSearchView] Backend connection test failed!');
      Alert.alert(
        'Connection Issue',
        'Unable to connect to search service. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } else {
      console.log('[WaffleSearchView] Backend connection test successful');
    }
  };

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await searchService.getSearchHistory(5);
      if (history.length > 0) {
        setRecentSearches(history);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    console.log('[WaffleSearchView] Starting search for:', searchQuery);
    
    try {
      // Build search request with filters
      const searchRequest = {
        query: searchQuery,
        filters: {
          groupIds: groupId ? [groupId] : searchFilters.groupIds,
          userIds: searchFilters.userIds,
          dateRange: searchFilters.dateRange.start && searchFilters.dateRange.end ? {
            start: searchFilters.dateRange.start,
            end: searchFilters.dateRange.end,
          } : undefined,
          mediaType: searchFilters.mediaType,
        },
        limit: 20,
        offset: 0,
      };

      console.log('[WaffleSearchView] Search request:', JSON.stringify(searchRequest, null, 2));

      const response = await searchService.searchWaffles(searchRequest);
      console.log('[WaffleSearchView] Search response:', response);
      
      setSearchResults(response.results);
      
      // Add to recent searches
      setRecentSearches(prev => {
        const updated = [searchQuery, ...prev.filter(q => q !== searchQuery)].slice(0, 5);
        return updated;
      });
    } catch (error) {
      console.error('[WaffleSearchView] Search failed:', error);
      console.error('[WaffleSearchView] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Show user-friendly error message
      Alert.alert(
        'Search Failed',
        error instanceof Error ? error.message : 'Unable to search at this time. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    setTimeout(() => handleSearch(), 100);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const handleApplyFilters = () => {
    setShowFilters(false);
    if (searchQuery) {
      handleSearch();
    }
  };

  // Calculate active filter count
  const activeFilterCount = 
    searchFilters.groupIds.length +
    searchFilters.userIds.length +
    (searchFilters.dateRange.start ? 1 : 0) +
    (searchFilters.mediaType !== 'all' ? 1 : 0);

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.searchingText}>Searching waffles...</Text>
        </View>
      );
    }

    if (searchQuery && searchResults.length === 0 && !isSearching) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.noResultsTitle}>No results found</Text>
          <Text style={styles.noResultsSubtitle}>
            Try searching for different keywords or check your filters
          </Text>
        </View>
      );
    }

    if (!searchQuery) {
      return (
        <View style={styles.recentSearchesContainer}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          {recentSearches.map((query, index) => (
            <TouchableOpacity
              key={index}
              style={styles.recentSearchItem}
              onPress={() => handleRecentSearch(query)}
            >
              <Search size={16} color="#9CA3AF" />
              <Text style={styles.recentSearchText}>{query}</Text>
            </TouchableOpacity>
          ))}
          
          <Text style={styles.sectionTitle}>Try searching for</Text>
          <View style={styles.suggestionChips}>
            {['Weekend adventures', 'Happy moments', 'Team updates'].map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleRecentSearch(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <ArrowLeft size={24} color="#374151" />
            </TouchableOpacity>
            
            <View style={styles.searchBarContainer}>
              <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search waffles..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.micButton}>
                <Mic size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} color={activeFilterCount > 0 ? '#F97316' : '#374151'} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Results Count */}
          {searchResults.length > 0 && (
            <View style={styles.resultsCount}>
              <Text style={styles.resultsCountText}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          )}

          {/* Search Results or Empty State */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SearchResultCard
                result={item}
                searchQuery={searchQuery}
                onPress={() => {
                  // Navigate to chat with video at timestamp
                  console.log('Navigate to video at timestamp:', item.timestamp);
                }}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState()}
            showsVerticalScrollIndicator={false}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
      
      {/* Filter Modal */}
      {showFilters && (
        <SearchFilters
          groups={groups}
          groupMembers={allMembers}
          onClose={() => setShowFilters(false)}
          onApply={handleApplyFilters}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  clearButton: {
    padding: 4,
  },
  micButton: {
    padding: 4,
    marginLeft: 8,
  },
  filterButton: {
    padding: 8,
    marginLeft: 8,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#FEF3E8',
    borderRadius: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#F97316',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  resultsCountText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  searchingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  noResultsTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  noResultsSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  recentSearchesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    marginBottom: 12,
    marginTop: 20,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentSearchText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    marginLeft: 12,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  suggestionChip: {
    backgroundColor: '#FEF3E8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#F97316',
  },
}); 