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
        }
        Insert: {
          id: string
          name: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          avatar_url?: string | null
          updated_at?: string
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
          retention_type: 'view_once' | '7_days' | 'forever'
          created_at: string
          expires_at: string | null
          view_count: number
          ai_caption: string | null
          ai_transcript: string | null
          ai_summary: string | null
        }
        Insert: {
          id?: string
          user_id: string
          group_id: string
          content_url?: string | null
          content_type: 'video' | 'photo' | 'text'
          caption?: string | null
          retention_type?: 'view_once' | '7_days' | 'forever'
          created_at?: string
          expires_at?: string | null
          view_count?: number
          ai_caption?: string | null
          ai_transcript?: string | null
          ai_summary?: string | null
        }
        Update: {
          content_url?: string | null
          caption?: string | null
          retention_type?: 'view_once' | '7_days' | 'forever'
          expires_at?: string | null
          view_count?: number
          ai_caption?: string | null
          ai_transcript?: string | null
          ai_summary?: string | null
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