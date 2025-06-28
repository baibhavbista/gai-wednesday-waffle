import { create } from 'zustand';

export interface WaffleMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: {
    type: 'photo' | 'video';
    url: string;
    thumbnail?: string;
  };
  caption: string;
  createdAt: Date;
  expiresAt: Date;
  retentionType: 'view-once' | '7-day' | 'keep-forever';
  groupId: string;
  viewed: boolean;
  likes: number;
  hasLiked: boolean;
  reactions: { [userId: string]: string }; // emoji reactions
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
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentUser: (user: WaffleState['currentUser']) => void;
  setGroups: (groups: Group[]) => void;
  setCurrentGroup: (groupId: string) => void;
  addMessage: (message: Omit<WaffleMessage, 'id' | 'createdAt' | 'likes' | 'hasLiked' | 'viewed' | 'reactions'>) => void;
  likeMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  markMessageViewed: (messageId: string) => void;
  joinGroup: (inviteCode: string) => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Real-time actions
  addWaffle: (waffle: WaffleMessage) => void;
  updateWaffle: (waffleId: string, updates: Partial<WaffleMessage>) => void;
  removeWaffle: (waffleId: string) => void;
  updateGroupMemberCount: (groupId: string, delta: number) => void;
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
    expiresAt: new Date('2024-01-24T10:30:00'),
    retentionType: '7-day',
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
    expiresAt: new Date('2024-01-23T15:45:00'),
    retentionType: '7-day',
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
    expiresAt: new Date('2024-01-22T07:20:00'),
    retentionType: '7-day',
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
  currentUser: mockUser,
  groups: mockGroups,
  currentGroupId: 'group-1',
  messages: mockMessages,
  isLoading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  
  setGroups: (groups) => set({ groups }),
  
  setCurrentGroup: (groupId) => set({ currentGroupId: groupId }),
  
  addMessage: (messageData) => {
    const newMessage: WaffleMessage = {
      ...messageData,
      id: `msg-${Date.now()}`,
      createdAt: new Date(),
      likes: 0,
      hasLiked: false,
      viewed: false,
      reactions: {},
      expiresAt: messageData.retentionType === 'view-once' 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        : messageData.retentionType === '7-day'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for "keep forever"
    };
    
    set((state) => ({
      messages: [newMessage, ...state.messages],
      groups: state.groups.map(group => 
        group.id === messageData.groupId 
          ? { ...group, lastMessage: newMessage, unreadCount: group.unreadCount + 1 }
          : group
      ),
    }));
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
    set({ isLoading: true, error: null });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Joining group with code:', inviteCode);
    
    set({ isLoading: false });
  },
  
  createGroup: async (name) => {
    set({ isLoading: true, error: null });
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name,
      createdAt: new Date(),
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      unreadCount: 0,
      members: [
        {
          id: get().currentUser?.id || 'user-1',
          name: get().currentUser?.name || 'Unknown',
          avatar: get().currentUser?.avatar || '',
          lastActive: new Date(),
          hasPostedThisWeek: false,
        },
      ],
    };
    
    set((state) => ({
      groups: [...state.groups, newGroup],
      isLoading: false,
    }));
    
    return newGroup;
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  // Real-time actions
  addWaffle: (waffle) => {
    set((state) => ({
      messages: [waffle, ...state.messages],
      groups: state.groups.map(group => 
        group.id === waffle.groupId 
          ? { ...group, lastMessage: waffle, unreadCount: group.unreadCount + 1 }
          : group
      ),
    }));
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
}));