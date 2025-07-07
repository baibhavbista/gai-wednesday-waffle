// Database types that will be generated from Supabase
// For now, we'll define types that match our existing store interfaces

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          avatar_url: string | null
          created_at: string
          updated_at: string
          notifications_enabled: boolean
          notification_permission_requested: boolean
          last_waffle_week: string | null
        }
        Insert: {
          id: string
          name: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          notifications_enabled?: boolean
          notification_permission_requested?: boolean
          last_waffle_week?: string | null
        }
        Update: {
          id?: string
          name?: string
          avatar_url?: string | null
          updated_at?: string
          notifications_enabled?: boolean
          notification_permission_requested?: boolean
          last_waffle_week?: string | null
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          updated_at?: string
        }
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          group_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          joined_at?: string
        }
      }
      waffles: {
        Row: {
          id: string
          user_id: string
          group_id: string
          content_url: string | null
          content_type: 'video' | 'photo' | 'text'
          caption: string | null
          created_at: string
          view_count: number
        }
        Insert: {
          id?: string
          user_id: string
          group_id: string
          content_url?: string | null
          content_type: 'video' | 'photo' | 'text'
          caption?: string | null
          created_at?: string
          view_count?: number
        }
        Update: {
          content_url?: string | null
          caption?: string | null
          view_count?: number
        }
      }
      transcripts: {
        Row: {
          content_url: string
          text: string
          embedding: number[] | null
          ai_recap: string | null
          thumbnail_url: string | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          content_url: string
          text: string
          embedding?: number[] | null
          ai_recap?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          text?: string
          embedding?: number[] | null
          ai_recap?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 