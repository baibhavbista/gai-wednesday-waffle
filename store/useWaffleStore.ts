import { create } from 'zustand';
import { groupsService, wafflesService } from '@/lib/database-service';

export interface WaffleMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: {
    type: 'photo' | 'video' | 'text';
    url?: string;
    text?: string;
    thumbnail?: string;
  };
  caption: string;
  createdAt: Date;
  groupId: string;
  viewed: boolean;
  likes: number;
  hasLiked: boolean;
  reactions: { [userId: string]: string }; // emoji reactions
  videoDuration?: number; // Duration in seconds for video content
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string | null;
}

export interface Group {
  id: string;
  name: string;
  members: {
    id: string;
    name: string;
    avatar: string;
    lastActive: Date;
    hasPostedThisWeek: boolean;
  }[];
  createdAt: Date;
  inviteCode: string;
  lastMessage?: WaffleMessage;
  unreadCount: number;
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

export interface SearchState {
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  searchHistory: string[];
  searchFilters: {
    groupIds: string[];
    userIds: string[];
    dateRange: { start: Date | null; end: Date | null };
    mediaType: 'video' | 'photo' | 'all';
  };
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: any[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  setSearchFilters: (filters: Partial<SearchState['searchFilters']>) => void;
  resetSearchFilters: () => void;
}

export interface WaffleState {
  currentUser: {
    id: string;
    name: string;
    avatar: string;
    email: string;
  } | null;
  groups: Group[];
  currentGroupId: string | null;
  messages: WaffleMessage[];
  memberCache: Map<string, UserProfile>; // Cache of all group members
  isLoading: boolean;
  hasGroupsInitLoaded: boolean;
  error: string | null;
  
  // Search state
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchHistory: string[];
  searchFilters: {
    groupIds: string[];
    userIds: string[];
    dateRange: { start: Date | null; end: Date | null };
    mediaType: 'video' | 'photo' | 'all';
  };
  totalSearchResults: number;
  hasMoreSearchResults: boolean;
  
  // Actions
  setCurrentUser: (user: WaffleState['currentUser']) => void;
  loadUserGroups: () => Promise<void>; // NEW: Real data loading
  setGroups: (groups: Group[]) => void;
  setCurrentGroup: (groupId: string | null) => void;
  addMessage: (message: Omit<WaffleMessage, 'id' | 'createdAt' | 'likes' | 'hasLiked' | 'viewed' | 'reactions'>) => Promise<void>;
  likeMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  markMessageViewed: (messageId: string) => void;
  joinGroup: (inviteCode: string) => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  setLoading: (loading: boolean) => void;
  setGroupsLoaded: (loaded: boolean) => void;
  setError: (error: string | null) => void;
  clearData: () => void; // NEW: Clear data on logout
  
  // Search actions
  setSearchQuery: (query: string) => void;
  searchWaffles: (query: string, groupId?: string) => Promise<void>;
  clearSearchResults: () => void;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  loadMoreSearchResults: () => Promise<void>;
  
  // Member cache functions
  addToMemberCache: (userProfile: UserProfile) => void;
  getMemberFromCache: (userId: string) => UserProfile | null;
  updateMemberCache: (userProfiles: UserProfile[]) => void;
  clearMemberCache: () => void;
  
  // Real-time actions
  addWaffle: (waffle: WaffleMessage) => void;
  updateWaffle: (waffleId: string, updates: Partial<WaffleMessage>) => void;
  removeWaffle: (waffleId: string) => void;
  updateGroupMemberCount: (groupId: string, delta: number) => void;
  
  // Enhanced real-time group actions
  addGroupRealtime: (group: Group) => void;
  updateGroupRealtime: (groupId: string, updates: Partial<Group>) => void;
  removeGroupRealtime: (groupId: string) => void;
  updateGroupMembers: (groupId: string, members: Group['members']) => void;
  updateGroupLastMessage: (groupId: string, message: WaffleMessage) => void;
  incrementGroupUnreadCount: (groupId: string) => void;
  clearGroupUnreadCount: (groupId: string) => void;
  
  // Optimistic updates
  addOptimisticGroup: (group: Group) => string; // Returns temp ID
  removeOptimisticGroup: (tempId: string) => void;
  replaceOptimisticGroup: (tempId: string, realGroup: Group) => void;
  
  // Real waffle/message management
  loadGroupMessages: (groupId: string) => Promise<void>;
  setGroupMessages: (groupId: string, messages: WaffleMessage[]) => void;
  addOptimisticMessage: (message: Omit<WaffleMessage, 'id' | 'createdAt' | 'likes' | 'hasLiked' | 'viewed' | 'reactions'>) => string;
  removeOptimisticMessage: (tempId: string) => void;
  replaceOptimisticMessage: (tempId: string, realMessage: WaffleMessage) => void;
}

// Mock data
const mockUser = {
  id: 'user-1',
  name: 'Alex Chen',
  avatar: 'https://images.pexels.com/photos/3996914/pexels-photo-3996914.jpeg?w=200&h=200&fit=crop&crop=face',
  email: 'alex@example.com',
};

const mockMessages: WaffleMessage[] = [
  {
    id: 'msg-1',
    userId: 'user-2',
    userName: 'Sarah Kim',
    userAvatar: 'https://images.pexels.com/photos/3317168/pexels-photo-3317168.jpeg?w=200&h=200&fit=crop&crop=face',
    content: {
      type: 'photo',
      url: 'https://images.pexels.com/photos/3342739/pexels-photo-3342739.jpeg?w=400&h=600&fit=crop',
    },
    caption: "Finally trying that coffee shop you all recommended! ☕️",
    createdAt: new Date('2024-01-17T10:30:00'),
    groupId: 'group-1',
    viewed: false,
    likes: 3,
    hasLiked: false,
    reactions: { 'user-3': '☕', 'user-4': '😍' },
  },
  {
    id: 'msg-2',
    userId: 'user-4',
    userName: 'Emma Wilson',
    userAvatar: 'https://images.pexels.com/photos/3317381/pexels-photo-3317381.jpeg?w=200&h=200&fit=crop&crop=face',
    content: {
      type: 'photo',
      url: 'https://images.pexels.com/photos/3394664/pexels-photo-3394664.jpeg?w=400&h=600&fit=crop',
    },
    caption: "Desk setup is finally coming together 🎯",
    createdAt: new Date('2024-01-16T15:45:00'),
    groupId: 'group-1',
    viewed: true,
    likes: 5,
    hasLiked: true,
    reactions: { 'user-1': '🔥', 'user-2': '💯' },
  },
  {
    id: 'msg-3',
    userId: 'user-1',
    userName: 'Alex Chen',
    userAvatar: 'https://images.pexels.com/photos/3996914/pexels-photo-3996914.jpeg?w=200&h=200&fit=crop&crop=face',
    content: {
      type: 'photo',
      url: 'https://images.pexels.com/photos/3394652/pexels-photo-3394652.jpeg?w=400&h=600&fit=crop',
    },
    caption: "Morning run before the chaos begins 🏃‍♂️",
    createdAt: new Date('2024-01-15T07:20:00'),
    groupId: 'group-1',
    viewed: true,
    likes: 2,
    hasLiked: false,
    reactions: { 'user-2': '💪' },
  },
];

const mockGroups: Group[] = [
  {
    id: 'group-1',
    name: 'College Squad',
    createdAt: new Date('2024-01-15'),
    inviteCode: 'WAFFLE123',
    unreadCount: 2,
    lastMessage: mockMessages[0],
    members: [
      {
        id: 'user-1',
        name: 'Alex Chen',
        avatar: 'https://images.pexels.com/photos/3996914/pexels-photo-3996914.jpeg?w=200&h=200&fit=crop&crop=face',
        lastActive: new Date(),
        hasPostedThisWeek: true,
      },
      {
        id: 'user-2',
        name: 'Sarah Kim',
        avatar: 'https://images.pexels.com/photos/3317168/pexels-photo-3317168.jpeg?w=200&h=200&fit=crop&crop=face',
        lastActive: new Date('2024-01-17'),
        hasPostedThisWeek: true,
      },
      {
        id: 'user-3',
        name: 'Marcus Johnson',
        avatar: 'https://images.pexels.com/photos/3889942/pexels-photo-3889942.jpeg?w=200&h=200&fit=crop&crop=face',
        lastActive: new Date('2024-01-16'),
        hasPostedThisWeek: false,
      },
      {
        id: 'user-4',
        name: 'Emma Wilson',
        avatar: 'https://images.pexels.com/photos/3317381/pexels-photo-3317381.jpeg?w=200&h=200&fit=crop&crop=face',
        lastActive: new Date('2024-01-15'),
        hasPostedThisWeek: true,
      },
    ],
  },
  {
    id: 'group-2',
    name: 'NYC Roomies',
    createdAt: new Date('2023-08-10'),
    inviteCode: 'CITY456',
    unreadCount: 0,
    members: [
      {
        id: 'user-1',
        name: 'Alex Chen',
        avatar: 'https://images.pexels.com/photos/3996914/pexels-photo-3996914.jpeg?w=200&h=200&fit=crop&crop=face',
        lastActive: new Date(),
        hasPostedThisWeek: true,
      },
      {
        id: 'user-5',
        name: 'Jordan Lee',
        avatar: 'https://images.pexels.com/photos/3394667/pexels-photo-3394667.jpeg?w=200&h=200&fit=crop&crop=face',
        lastActive: new Date('2024-01-17'),
        hasPostedThisWeek: false,
      },
    ],
  },
];

export const useWaffleStore = create<WaffleState>((set, get) => ({
  currentUser: null, // Will be set through authentication
  groups: [], // Will be loaded from API when user is authenticated
  currentGroupId: null,
  messages: [], // Will be loaded per group
  memberCache: new Map(),
  isLoading: false,
  hasGroupsInitLoaded: false,
  error: null,

  // Search state initialization
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  searchHistory: [],
  searchFilters: {
    groupIds: [],
    userIds: [],
    dateRange: { start: null, end: null },
    mediaType: 'video', // Default to video since we only support videos
  },
  totalSearchResults: 0,
  hasMoreSearchResults: false,

  setCurrentUser: (user) => set({ currentUser: user }),

  // NEW: Load real groups from Supabase
  loadUserGroups: async () => {
    const state = get();
    
    // Prevent multiple concurrent calls
    if (state.isLoading && !state.hasGroupsInitLoaded) {
      console.log('⏳ Already loading groups, skipping duplicate call');
      return;
    }
    
    const currentUser = state.currentUser;
    if (!currentUser) {
      console.log('❌ Cannot load groups: No user authenticated');
      set({ hasGroupsInitLoaded: false });
      return;
    }

    console.log('📋 Starting to load groups for user:', currentUser.name);

    try {
      set({ isLoading: true, error: null });
      
      const { data: userGroups, error } = await groupsService.getUserGroups();
      
      if (error) {
        console.error('❌ Database error loading groups:', error);
        throw new Error(error.message);
      }

      console.log('📋 Raw groups data from database:', userGroups?.length || 0, 'groups');

      if (userGroups) {
        // Transform API format to store format
        const transformedGroups: Group[] = await Promise.all(
          userGroups.map(async (apiGroup) => {
            // Get group members for this group
            const { data: groupMembers } = await groupsService.getGroupMembers(apiGroup.id);
            
            // Get latest waffle for this group
            const { data: waffles } = await wafflesService.getForGroup(apiGroup.id);
            const latestWaffle = waffles?.[0];

            return {
              id: apiGroup.id,
              name: apiGroup.name,
              inviteCode: apiGroup.invite_code,
              createdAt: new Date(apiGroup.created_at),
              unreadCount: 0, // TODO: Calculate based on user's last read
              lastMessage: latestWaffle ? {
                id: latestWaffle.id!,
                userId: latestWaffle.user_id,
                userName: latestWaffle.user_name,
                userAvatar: latestWaffle.user_avatar || '',
                content: {
                  type: latestWaffle.content_type as 'photo' | 'video' | 'text',
                  url: latestWaffle.content_type === 'text' ? undefined : latestWaffle.content_url || '',
                  text: latestWaffle.content_type === 'text' ? latestWaffle.caption || '' : undefined,
                  thumbnail: latestWaffle.thumbnail_url ?? undefined,
                },
                caption: latestWaffle.caption || '',
                createdAt: new Date(latestWaffle.created_at),
                groupId: latestWaffle.group_id!,
                viewed: false, // TODO: Track viewed status
                likes: 0, // TODO: Implement likes
                hasLiked: false,
                reactions: {},
                videoDuration: latestWaffle.content_type === 'video' ? latestWaffle.duration_seconds ?? undefined : undefined,
              } : undefined,
              members: groupMembers?.map(member => ({
                id: member.user_id,
                name: member.user_name,
                avatar: member.user_avatar || '',
                lastActive: new Date(member.joined_at), // Placeholder
                hasPostedThisWeek: false, // TODO: Calculate based on recent waffles
              })) || [],
            };
          })
        );

        set({ groups: transformedGroups, hasGroupsInitLoaded: true });
        console.log('✅ Loaded', transformedGroups.length, 'groups from Supabase');
        console.log('📊 Final groups in store:', transformedGroups.map(g => ({ id: g.id, name: g.name, memberCount: g.members.length })));

        // Populate member cache with all group members
        const allMemberProfiles: UserProfile[] = [];
        transformedGroups.forEach(group => {
          group.members.forEach(member => {
            // Check if we already have this user profile to avoid duplicates
            const existingProfile = allMemberProfiles.find(p => p.id === member.id);
            if (!existingProfile) {
              allMemberProfiles.push({
                id: member.id,
                name: member.name,
                avatar: member.avatar || null,
              });
            }
          });
        });
        
        // Update the member cache with all profiles
        get().updateMemberCache(allMemberProfiles);
        console.log('👥 Populated member cache with', allMemberProfiles.length, 'user profiles');
      }
    } catch (error) {
      let errorMessage = 'Failed to load groups';
      
      // Check for network connectivity issues
      if (error instanceof Error) {
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch')) {
          errorMessage = 'NETWORK_ERROR';
        } else {
          errorMessage = error.message;
        }
      }
      
      set({ error: errorMessage });
      console.error('❌ Error loading groups:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // NEW: Clear all data (for logout)
  clearData: () => set({
    groups: [],
    currentGroupId: null,
    messages: [],
    memberCache: new Map(),
    error: null,
    searchQuery: '',
    searchResults: [],
    searchHistory: [],
  }),
  
  setGroups: (groups) => set({ groups }),
  
  setCurrentGroup: (groupId: string | null) => set({ currentGroupId: groupId }),
  
  addMessage: async (messageData) => {
    const currentUser = get().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    console.log('🏪 === STORE addMessage START ===');
    console.log('📦 Received messageData:');
    console.log('   - userId:', messageData.userId);
    console.log('   - userName:', messageData.userName);
    console.log('   - content.type:', messageData.content.type);
    console.log('   - content.url:', messageData.content.url ? 'present' : 'missing');
    console.log('   - caption:', messageData.caption);
    console.log('   - groupId:', messageData.groupId);

    // Add optimistic message immediately
    const tempId = get().addOptimisticMessage(messageData);
    console.log('⚡ Added optimistic message with tempId:', tempId);

    try {
      const createData = {
        group_id: messageData.groupId,
        content_url: messageData.content.type === 'text' ? null : messageData.content.url,
        content_type: messageData.content.type,
        caption: messageData.caption,
      };

      console.log('📤 Sending to database service:');
      console.log('   - group_id:', createData.group_id);
      console.log('   - content_url:', createData.content_url ? 'present' : 'null');
      console.log('   - content_type:', createData.content_type);
      console.log('   - caption:', createData.caption);

      // Post to database
      const { data: newWaffle, error } = await wafflesService.create(createData);

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error(error.message);
      }

      if (newWaffle) {
        console.log('📩 Received from database:');
        console.log('   - id:', newWaffle.id);
        console.log('   - user_id:', newWaffle.user_id);
        console.log('   - group_id:', newWaffle.group_id);
        console.log('   - content_type:', newWaffle.content_type);
        console.log('   - content_url:', newWaffle.content_url ? 'present' : 'null');
        console.log('   - caption:', newWaffle.caption);

        // Transform to store format
        const realMessage: WaffleMessage = {
          id: newWaffle.id,
          userId: newWaffle.user_id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          content: {
            ...messageData.content,
            thumbnail: newWaffle.thumbnail_url ?? messageData.content.thumbnail,
          },
          caption: messageData.caption,
          createdAt: new Date(newWaffle.created_at),
          groupId: messageData.groupId,
          viewed: false,
          likes: 0,
          hasLiked: false,
          reactions: {},
          videoDuration: newWaffle.content_type === 'video' ? newWaffle.duration_seconds ?? undefined : undefined,
        };

        console.log('✅ Final message object for store:');
        console.log('   - id:', realMessage.id);
        console.log('   - userId:', realMessage.userId);
        console.log('   - userName:', realMessage.userName);
        console.log('   - content.type:', realMessage.content.type);
        console.log('   - caption:', realMessage.caption);
        console.log('   - groupId:', realMessage.groupId);
        console.log('   - createdAt:', realMessage.createdAt);

        // Replace optimistic with real message
        get().replaceOptimisticMessage(tempId, realMessage);

        // Update group's last message
        set((state) => ({
          groups: state.groups.map(group => 
            group.id === messageData.groupId 
              ? { ...group, lastMessage: realMessage }
              : group
          ),
        }));

        console.log('✅ Posted waffle successfully:', newWaffle.id);

        // Cancel current week's nudges and update last waffle week
        try {
          const { NotificationService } = await import('@/lib/notification-service');
          await NotificationService.cancelCurrentWeekNudges();
          await NotificationService.updateLastWaffleWeek(currentUser.id);
          console.log('✅ Notifications updated: canceled current week nudges');
        } catch (notifError) {
          console.error('Failed to update notifications:', notifError);
          // Don't fail the whole operation if notification update fails
        }

        console.log('🏪 === STORE addMessage END ===');
      }
    } catch (error) {
      // Remove optimistic message on error
      get().removeOptimisticMessage(tempId);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to post waffle';
      set({ error: errorMessage });
      console.error('❌ Error posting waffle:', error);
      console.log('🏪 === STORE addMessage FAILED ===');
      throw error;
    }
  },
  
  likeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              likes: message.hasLiked ? message.likes - 1 : message.likes + 1,
              hasLiked: !message.hasLiked,
            }
          : message
      ),
    }));
  },

  addReaction: (messageId, emoji) => {
    const currentUserId = get().currentUser?.id;
    if (!currentUserId) return;

    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              reactions: {
                ...message.reactions,
                [currentUserId]: emoji,
              },
            }
          : message
      ),
    }));
  },
  
  markMessageViewed: (messageId) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, viewed: true } : message
      ),
    }));
  },
  
  joinGroup: async (inviteCode) => {
    const currentUser = get().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Create optimistic "joining" group for instant feedback
    const optimisticGroup: Group = {
      id: 'temp-joining',
      name: `Joining ${inviteCode}...`,
      inviteCode,
      createdAt: new Date(),
      unreadCount: 0,
      members: [{
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        lastActive: new Date(),
        hasPostedThisWeek: false,
      }],
    };

    const tempId = get().addOptimisticGroup(optimisticGroup);

    try {
      set({ isLoading: true, error: null });
      
      const { data: groupId, error } = await groupsService.joinByInviteCode(inviteCode);
      
      if (error) {
        throw new Error(error.message);
      }

      if (groupId) {
        console.log('✅ Joined group:', groupId);
        
        // Remove the optimistic group - real group will be added via real-time
        get().removeOptimisticGroup(tempId);
        
        // Trigger a refresh to get the actual group data
        await get().loadUserGroups();
      }
    } catch (error) {
      // Remove optimistic group on error
      get().removeOptimisticGroup(tempId);
      
      let errorMessage = 'Failed to join group';
      
      // Check for network connectivity issues
      if (error instanceof Error) {
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch')) {
          errorMessage = 'NETWORK_ERROR';
        } else {
          errorMessage = error.message;
        }
      }
      
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  createGroup: async (name) => {
    const currentUser = get().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Create optimistic group for instant UI feedback
    const optimisticGroup: Group = {
      id: 'temp-creating',
      name,
      inviteCode: 'CREATING...',
      createdAt: new Date(),
      unreadCount: 0,
      members: [{
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        lastActive: new Date(),
        hasPostedThisWeek: false,
      }],
    };

    const tempId = get().addOptimisticGroup(optimisticGroup);

    try {
      set({ isLoading: true, error: null });
      
      const { data: newGroupData, error } = await groupsService.create({ name });
      
      if (error) {
        throw new Error(error.message);
      }

      if (newGroupData) {
        console.log('✅ Created group:', newGroupData);
        
        // Transform to store format
        const realGroup: Group = {
          id: newGroupData.id,
          name: newGroupData.name,
          inviteCode: newGroupData.invite_code,
          createdAt: new Date(newGroupData.created_at),
          unreadCount: 0,
          members: [{
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            lastActive: new Date(),
            hasPostedThisWeek: false,
          }],
        };
        
        // Replace optimistic with real group
        get().replaceOptimisticGroup(tempId, realGroup);
        
        return realGroup;
      }
    } catch (error) {
      // Remove optimistic group on error
      get().removeOptimisticGroup(tempId);
      
      let errorMessage = 'Failed to create group';
      
      // Check for network connectivity issues
      if (error instanceof Error) {
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch')) {
          errorMessage = 'NETWORK_ERROR';
        } else {
          errorMessage = error.message;
        }
      }
      
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
    
    throw new Error('Failed to create group');
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setGroupsLoaded: (loaded: boolean) => set({ hasGroupsInitLoaded: loaded }),
  
  setError: (error) => set({ error }),
  
  // Real-time actions
  addWaffle: (waffle) => {
    set((state) => {
      // Check if message already exists to prevent duplicates
      const existingMessage = state.messages.find(m => m.id === waffle.id);
      if (existingMessage) {
        if (__DEV__) console.log('🔄 Message already exists, skipping duplicate:', waffle.id, 'from:', waffle.userName);
        return state; // Don't add duplicate
      }

      if (__DEV__) console.log('➕ Adding new waffle to store:', waffle.id, 'from:', waffle.userName, 'group:', waffle.groupId);

      return {
        messages: [waffle, ...state.messages],
        groups: state.groups.map(group => 
          group.id === waffle.groupId 
            ? { ...group, lastMessage: waffle, unreadCount: group.unreadCount + 1 }
            : group
        ),
      };
    });
  },
  
  updateWaffle: (waffleId, updates) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === waffleId ? { ...message, ...updates } : message
      ),
    }));
  },
  
  removeWaffle: (waffleId) => {
    set((state) => ({
      messages: state.messages.filter((message) => message.id !== waffleId),
    }));
  },
  
  updateGroupMemberCount: (groupId, delta) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === groupId 
          ? { 
              ...group, 
              members: delta > 0 
                ? [...group.members] // Keep existing for now
                : group.members // Will be updated by separate member management
            }
          : group
      ),
    }));
  },

  // Enhanced real-time group actions
  addGroupRealtime: (group) => {
    set((state) => {
      // Check if group already exists to avoid duplicates
      const exists = state.groups.some(g => g.id === group.id);
      if (exists) return state;
      
      return {
        groups: [...state.groups, group],
      };
    });
  },

  updateGroupRealtime: (groupId, updates) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === groupId 
          ? { ...group, ...updates }
          : group
      ),
    }));
  },

  removeGroupRealtime: (groupId) => {
    set((state) => ({
      groups: state.groups.filter(group => group.id !== groupId),
      // Clear current group if it was removed
      currentGroupId: state.currentGroupId === groupId ? null : state.currentGroupId,
    }));
  },

  updateGroupMembers: (groupId, members) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === groupId 
          ? { ...group, members }
          : group
      ),
    }));
  },

  // Optimistic updates for instant UI feedback
  addOptimisticGroup: (group) => {
    const tempId = `temp-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticGroup = { ...group, id: tempId };
    
    set((state) => ({
      groups: [...state.groups, optimisticGroup],
    }));
    
    if (__DEV__) console.log('⚡ Added optimistic group:', tempId);
    return tempId;
  },

  removeOptimisticGroup: (tempId) => {
    set((state) => ({
      groups: state.groups.filter(group => group.id !== tempId),
    }));
    if (__DEV__) console.log('❌ Removed optimistic group:', tempId);
  },

  replaceOptimisticGroup: (tempId, realGroup) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === tempId ? realGroup : group
      ),
    }));
    if (__DEV__) console.log('✅ Replaced optimistic group with real:', tempId, '→', realGroup.id);
  },

  // Real waffle/message management
  loadGroupMessages: async (groupId) => {
    const state = get();
    
    // Don't reload if already loading for this group
    if (state.isLoading) {
      if (__DEV__) console.log('⏳ Already loading messages, skipping...');
      return;
    }

    // Check if we already have messages for this group
    const existingMessages = state.messages.filter(m => m.groupId === groupId);
    if (existingMessages.length > 0) {
      if (__DEV__) console.log('📋 Messages already loaded for group:', groupId);
      return;
    }

    try {
      set({ isLoading: true, error: null });
      
      const { data: waffles, error } = await wafflesService.getForGroup(groupId);
      
      if (error) {
        throw new Error(error.message);
      }

      if (waffles) {
        // Transform API format to store format
        const transformedMessages: WaffleMessage[] = waffles.map(waffle => ({
          id: waffle.id!,
          userId: waffle.user_id,
          userName: waffle.user_name,
          userAvatar: waffle.user_avatar || '',
          content: {
            type: waffle.content_type as 'photo' | 'video' | 'text',
            url: waffle.content_type === 'text' ? undefined : waffle.content_url || '',
            text: waffle.content_type === 'text' ? waffle.caption || '' : undefined,
            thumbnail: waffle.thumbnail_url ?? undefined,
          },
          caption: waffle.caption || '',
          createdAt: new Date(waffle.created_at),
          groupId: waffle.group_id!,
          viewed: false, // TODO: Track viewed status per user
          likes: 0, // TODO: Implement likes system
          hasLiked: false,
          reactions: {}, // TODO: Implement reactions
          videoDuration: waffle.content_type === 'video' ? waffle.duration_seconds ?? undefined : undefined,
        }));

        // Replace messages for this group only
        set((state) => ({
          messages: [
            // Keep messages from other groups
            ...state.messages.filter(m => m.groupId !== groupId),
            // Add new messages for this group
            ...transformedMessages
          ],
        }));

        console.log('✅ Loaded', transformedMessages.length, 'messages for group:', groupId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';
      set({ error: errorMessage });
      console.error('❌ Error loading messages:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setGroupMessages: (groupId, messages) => {
    set((state) => ({
      messages: [
        // Keep messages from other groups
        ...state.messages.filter(m => m.groupId !== groupId),
        // Set new messages for this group
        ...messages
      ],
    }));
  },

  addOptimisticMessage: (messageData) => {
    const tempId = `temp-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const optimisticMessage: WaffleMessage = {
      ...messageData,
      id: tempId,
      createdAt: new Date(),
      likes: 0,
      hasLiked: false,
      viewed: false,
      reactions: {},
    };
    
    set((state) => ({
      messages: [optimisticMessage, ...state.messages],
    }));
    
    if (__DEV__) console.log('⚡ Added optimistic message:', tempId);
    return tempId;
  },

  removeOptimisticMessage: (tempId) => {
    set((state) => ({
      messages: state.messages.filter(message => message.id !== tempId),
    }));
    if (__DEV__) console.log('❌ Removed optimistic message:', tempId);
  },

  replaceOptimisticMessage: (tempId, realMessage) => {
    set((state) => ({
      messages: state.messages.map(message => 
        message.id === tempId ? realMessage : message
      ),
    }));
    if (__DEV__) console.log('✅ Replaced optimistic message with real:', tempId, '→', realMessage.id);
  },

  updateGroupLastMessage: (groupId, message) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === groupId 
          ? { ...group, lastMessage: message }
          : group
      ),
    }));
    if (__DEV__) console.log('📨 Updated group last message:', groupId, message.caption);
  },

  incrementGroupUnreadCount: (groupId) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === groupId 
          ? { ...group, unreadCount: group.unreadCount + 1 }
          : group
      ),
    }));
    if (__DEV__) console.log('🔔 Incremented unread count for group:', groupId);
  },

  clearGroupUnreadCount: (groupId) => {
    set((state) => ({
      groups: state.groups.map(group => 
        group.id === groupId 
          ? { ...group, unreadCount: 0 }
          : group
      ),
    }));
    if (__DEV__) console.log('✅ Cleared unread count for group:', groupId);
  },

  // Member cache functions
  addToMemberCache: (userProfile) => {
    set((state) => {
      const newCache = new Map(state.memberCache);
      newCache.set(userProfile.id, userProfile);
      return { memberCache: newCache };
    });
    if (__DEV__) console.log('👤 Added to member cache:', userProfile.name);
  },

  getMemberFromCache: (userId) => {
    return get().memberCache.get(userId) || null;
  },

  updateMemberCache: (userProfiles) => {
    set((state) => {
      const newCache = new Map(state.memberCache);
      userProfiles.forEach(profile => newCache.set(profile.id, profile));
      return { memberCache: newCache };
    });
    if (__DEV__) console.log('👥 Updated member cache with', userProfiles.length, 'profiles');
  },

  clearMemberCache: () => {
    set({ memberCache: new Map() });
    if (__DEV__) console.log('🗑️ Cleared member cache');
  },

  // Search actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  searchWaffles: async (query: string, groupId?: string) => {
    const currentUser = get().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    set({ isSearching: true, searchQuery: query });

    try {
      // TODO: Replace with real API call
      // const { data, error } = await searchService.searchWaffles(query, groupId);
      
      // Mock search implementation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock results - in real implementation, this would come from the API
      const mockResults: SearchResult[] = [
        {
          id: '1',
          userId: 'user-1',
          userName: 'Josh M.',
          userAvatar: 'https://ui-avatars.com/api/?name=Josh',
          groupName: 'Work Friends',
          groupId: 'group-1',
          videoUrl: 'mock-video-url',
          thumbnailUrl: 'https://picsum.photos/200/120',
          transcript: "I'm really excited to share that I just accepted a new position at Tesla! The team seems amazing and I'll be working on autonomous driving features. Can't wait to start next month!",
          matchStart: 42,
          matchEnd: 67,
          timestamp: 135,
          videoDuration: 270,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          matchPositions: [135, 203],
        },
      ];

      set({ 
        searchResults: mockResults,
        totalSearchResults: mockResults.length,
        hasMoreSearchResults: false,
        isSearching: false,
      });

      // Add to search history
      get().addToSearchHistory(query);
    } catch (error) {
      console.error('Search failed:', error);
      set({ 
        searchResults: [],
        isSearching: false,
        error: 'Search failed. Please try again.',
      });
    }
  },
  
  clearSearchResults: () => set({ 
    searchResults: [],
    searchQuery: '',
    totalSearchResults: 0,
    hasMoreSearchResults: false,
  }),
  
  addToSearchHistory: (query: string) => set((state) => ({
    searchHistory: [query, ...state.searchHistory.filter(q => q !== query)].slice(0, 10)
  })),
  
  clearSearchHistory: () => set({ searchHistory: [] }),
  
  loadMoreSearchResults: async () => {
    // TODO: Implement pagination
    console.log('Loading more search results...');
  },

  setSearchResults: (results: SearchResult[]) => set({ searchResults: results }),

  setIsSearching: (isSearching: boolean) => set({ isSearching }),

  setSearchFilters: (filters: Partial<WaffleState['searchFilters']>) => set((state) => ({
    searchFilters: { ...state.searchFilters, ...filters }
  })),

  resetSearchFilters: () => set({
    searchFilters: {
      groupIds: [],
      userIds: [],
      dateRange: { start: null, end: null },
      mediaType: 'all',
    }
  }),
}));