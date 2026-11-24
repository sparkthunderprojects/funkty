// Generated from the Supabase schema. Do not edit by hand; regenerate after every migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appeals: {
        Row: {
          body: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          restriction_id: string
          status: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          restriction_id: string
          status?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          restriction_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: true
            referencedRelation: "restrictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          held_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          status: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          held_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          status?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          held_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
          state: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
          state: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bytes: number | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          owner_id: string
          placeholder: string | null
          status: string
          storage_key: string
          updated_at: string
          variants: Json
          width: number | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind: string
          mime_type: string
          owner_id: string
          placeholder?: string | null
          status?: string
          storage_key: string
          updated_at?: string
          variants?: Json
          width?: number | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          owner_id?: string
          placeholder?: string | null
          status?: string
          storage_key?: string
          updated_at?: string
          variants?: Json
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mutes: {
        Row: {
          created_at: string
          muted_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string
          muted_id: string
          muter_id: string
        }
        Update: {
          created_at?: string
          muted_id?: string
          muter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutes_muted_id_fkey"
            columns: ["muted_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutes_muter_id_fkey"
            columns: ["muter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
          story_id: string | null
          unsent_at: string | null
        }
        Insert: {
          body: string
          story_id?: string | null
          unsent_at?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          story_id?: string | null
          unsent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          audience: string
          author_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          media_id: string
        }
        Insert: {
          audience?: string
          author_id: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          media_id: string
        }
        Update: {
          audience?: string
          author_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed_at: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          type?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          summary: string
          title: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          summary: string
          title: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          summary?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      post_media: {
        Row: {
          alt_text: string | null
          media_id: string
          position: number
          post_id: string
        }
        Insert: {
          alt_text?: string | null
          media_id: string
          position: number
          post_id: string
        }
        Update: {
          alt_text?: string | null
          media_id?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_stats: {
        Row: {
          comment_count: number
          like_count: number
          post_id: string
          save_count: number
        }
        Insert: {
          comment_count?: number
          like_count?: number
          post_id: string
          save_count?: number
        }
        Update: {
          comment_count?: number
          like_count?: number
          post_id?: string
          save_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_stats_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          archived_at: string | null
          author_id: string
          caption: string | null
          comments_enabled: boolean
          is_spoiler: boolean
          is_compare: boolean
          series_id: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          hide_like_count: boolean
          id: string
          kind: string
          pinned_at: string | null
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          comments_enabled?: boolean
          is_spoiler?: boolean
          is_compare?: boolean
          series_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          hide_like_count?: boolean
          id?: string
          kind: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          caption?: string | null
          comments_enabled?: boolean
          is_spoiler?: boolean
          is_compare?: boolean
          series_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          hide_like_count?: boolean
          id?: string
          kind?: string
          pinned_at?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          birth_date: string
          country: string
          created_at: string
          locale: string | null
          user_id: string
        }
        Insert: {
          birth_date: string
          country: string
          created_at?: string
          locale?: string | null
          user_id: string
        }
        Update: {
          birth_date?: string
          country?: string
          created_at?: string
          locale?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_stats: {
        Row: {
          followers_count: number
          following_count: number
          posts_count: number
          user_id: string
        }
        Insert: {
          followers_count?: number
          following_count?: number
          posts_count?: number
          user_id: string
        }
        Update: {
          followers_count?: number
          following_count?: number
          posts_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_not_interested: {
        Row: { user_id: string; post_id: string; created_at: string }
        Insert: { user_id: string; post_id: string; created_at?: string }
        Update: { user_id?: string; post_id?: string; created_at?: string }
        Relationships: []
      }
      muted_topics: {
        Row: { user_id: string; tag: string; created_at: string }
        Insert: { user_id: string; tag: string; created_at?: string }
        Update: { user_id?: string; tag?: string; created_at?: string }
        Relationships: []
      }
      reposts: {
        Row: { user_id: string; post_id: string; note: string | null; created_at: string }
        Insert: { user_id: string; post_id: string; note?: string | null; created_at?: string }
        Update: { user_id?: string; post_id?: string; note?: string | null; created_at?: string }
        Relationships: []
      }
      close_friends: {
        Row: { owner_id: string; friend_id: string; created_at: string }
        Insert: { owner_id: string; friend_id: string; created_at?: string }
        Update: { owner_id?: string; friend_id?: string; created_at?: string }
        Relationships: []
      }
      message_reactions: {
        Row: { message_id: string; user_id: string; emoji: string; created_at: string }
        Insert: { message_id: string; user_id: string; emoji: string; created_at?: string }
        Update: { message_id?: string; user_id?: string; emoji?: string; created_at?: string }
        Relationships: []
      }
      account_controls: {
        Row: { user_id: string; require_comment_approval: boolean; comment_words: string[]; allow_reposts: boolean; updated_at: string }
        Insert: { user_id: string; require_comment_approval?: boolean; comment_words?: string[]; allow_reposts?: boolean; updated_at?: string }
        Update: { user_id?: string; require_comment_approval?: boolean; comment_words?: string[]; allow_reposts?: boolean; updated_at?: string }
        Relationships: []
      }
      collection_members: {
        Row: { collection_id: string; user_id: string; status: string; invited_by: string; created_at: string }
        Insert: { collection_id: string; user_id: string; status?: string; invited_by: string; created_at?: string }
        Update: { collection_id?: string; user_id?: string; status?: string; invited_by?: string; created_at?: string }
        Relationships: [
          { foreignKeyName: "collection_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "collection_members_collection_id_fkey"; columns: ["collection_id"]; isOneToOne: false; referencedRelation: "collections"; referencedColumns: ["id"] },
        ]
      }
      comment_likes: {
        Row: { comment_id: string; user_id: string; created_at: string }
        Insert: { comment_id: string; user_id: string; created_at?: string }
        Update: { comment_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      post_drafts: {
        Row: { id: string; owner_id: string; caption: string | null; media_ids: string[]; alt_texts: string[] | null; is_spoiler: boolean; scheduled_for: string | null; status: string; error: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; owner_id: string; caption?: string | null; media_ids: string[]; alt_texts?: string[] | null; is_spoiler?: boolean; scheduled_for?: string | null; status?: string; error?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; owner_id?: string; caption?: string | null; media_ids?: string[]; alt_texts?: string[] | null; is_spoiler?: boolean; scheduled_for?: string | null; status?: string; error?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      highlights: {
        Row: { id: string; owner_id: string; title: string; cover_media_id: string | null; created_at: string }
        Insert: { id?: string; owner_id: string; title: string; cover_media_id?: string | null; created_at?: string }
        Update: { id?: string; owner_id?: string; title?: string; cover_media_id?: string | null; created_at?: string }
        Relationships: []
      }
      highlight_items: {
        Row: { highlight_id: string; media_id: string; story_id: string | null; added_at: string }
        Insert: { highlight_id: string; media_id: string; story_id?: string | null; added_at?: string }
        Update: { highlight_id?: string; media_id?: string; story_id?: string | null; added_at?: string }
        Relationships: []
      }
      post_tags: {
        Row: { post_id: string; tagged_id: string; status: string; created_at: string }
        Insert: { post_id: string; tagged_id: string; status?: string; created_at?: string }
        Update: { post_id?: string; tagged_id?: string; status?: string; created_at?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_media_id: string | null
          bio: string | null
          cover_media_id: string | null
          location: string | null
          website: string | null
          created_at: string
          display_name: string | null
          fanout_mode: string
          id: string
          is_private: boolean
          is_teen: boolean
          updated_at: string
          username: string
        }
        Insert: {
          account_status?: string
          avatar_media_id?: string | null
          bio?: string | null
          cover_media_id?: string | null
          location?: string | null
          website?: string | null
          created_at?: string
          display_name?: string | null
          fanout_mode?: string
          id: string
          is_private?: boolean
          is_teen?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          account_status?: string
          avatar_media_id?: string | null
          bio?: string | null
          cover_media_id?: string | null
          location?: string | null
          website?: string | null
          created_at?: string
          display_name?: string | null
          fanout_mode?: string
          id?: string
          is_private?: boolean
          is_teen?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_media_fk"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason_code: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason_code: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason_code?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_usernames: {
        Row: {
          username: string
        }
        Insert: {
          username: string
        }
        Update: {
          username?: string
        }
        Relationships: []
      }
      restrictions: {
        Row: {
          automated: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          feature: string | null
          id: string
          kind: string
          legal_basis: string | null
          policy_id: string
          reason_text: string
          starts_at: string
          status: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          automated?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          feature?: string | null
          id?: string
          kind: string
          legal_basis?: string | null
          policy_id: string
          reason_text: string
          starts_at?: string
          status?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          automated?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          feature?: string | null
          id?: string
          kind?: string
          legal_basis?: string | null
          policy_id?: string
          reason_text?: string
          starts_at?: string
          status?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restrictions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restrictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      collection_posts: {
        Row: {
          added_at: string
          collection_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          post_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          author_id: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      post_credits: {
        Row: {
          name: string
          position: number
          post_id: string
          role: string
        }
        Insert: {
          name: string
          position: number
          post_id: string
          role: string
        }
        Update: {
          name?: string
          position?: number
          post_id?: string
          role?: string
        }
        Relationships: []
      }
      message_request_decisions: {
        Row: {
          decided_at: string
          decision: string
          other_id: string
          user_id: string
        }
        Insert: {
          decided_at?: string
          decision: string
          other_id: string
          user_id: string
        }
        Update: {
          decided_at?: string
          decision?: string
          other_id?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      post_updates: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: []
      }
      saves: {
        Row: {
          created_at: string
          note: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_post_pinned: { Args: { p_post_id: string; p_on: boolean }; Returns: undefined }
      set_post_archived: { Args: { p_post_id: string; p_on: boolean }; Returns: undefined }
      set_post_hide_likes: { Args: { p_post_id: string; p_on: boolean }; Returns: undefined }
      create_highlight: { Args: { p_title: string; p_story_id: string }; Returns: Database['public']['Tables']['highlights']['Row'] }
      add_story_to_highlight: { Args: { p_highlight_id: string; p_story_id: string }; Returns: undefined }
      remove_highlight_item: { Args: { p_highlight_id: string; p_media_id: string }; Returns: undefined }
      rename_highlight: { Args: { p_highlight_id: string; p_title: string }; Returns: undefined }
      delete_highlight: { Args: { p_highlight_id: string }; Returns: undefined }
      tag_user: { Args: { p_post_id: string; p_user: string }; Returns: undefined }
      untag_user: { Args: { p_post_id: string; p_user: string }; Returns: undefined }
      respond_tag: { Args: { p_post_id: string; p_accept: boolean }; Returns: undefined }
      accept_follow_request: {
        Args: { p_follower: string }
        Returns: undefined
      }
      add_comment: {
        Args: { p_body: string; p_parent_id?: string; p_post_id: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      appeal_restriction: {
        Args: { p_body: string; p_restriction: string }
        Returns: string
      }
      block_user: { Args: { p_target: string }; Returns: undefined }
      create_profile: {
        Args: {
          p_birth_date: string
          p_country: string
          p_display_name?: string
          p_username: string
        }
        Returns: {
          account_status: string
          avatar_media_id: string | null
          bio: string | null
          cover_media_id: string | null
          location: string | null
          website: string | null
          created_at: string
          display_name: string | null
          fanout_mode: string
          id: string
          is_private: boolean
          is_teen: boolean
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_comment: { Args: { p_comment_id: string }; Returns: undefined }
      delete_post: { Args: { p_post_id: string }; Returns: undefined }
      edit_post: {
        Args: {
          p_caption: string
          p_comments_enabled?: boolean
          p_is_spoiler?: boolean
          p_post_id: string
        }
        Returns: {
          author_id: string
          caption: string | null
          comments_enabled: boolean
          is_spoiler: boolean
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: string
          status: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      follow_user: { Args: { p_target: string }; Returns: string }
      like_post: { Args: { p_post_id: string }; Returns: undefined }
      mute_user: { Args: { p_target: string }; Returns: undefined }
      publish_post: {
        Args: {
          p_alt_texts?: string[]
          p_caption: string
          p_comments_enabled?: boolean
          p_is_spoiler?: boolean
          p_media_ids: string[]
          p_visibility?: string
        }
        Returns: {
          author_id: string
          caption: string | null
          comments_enabled: boolean
          is_spoiler: boolean
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: string
          status: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_image: {
        Args: {
          p_bytes: number
          p_height?: number
          p_mime_type: string
          p_storage_key: string
          p_width?: number
        }
        Returns: {
          bytes: number | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          owner_id: string
          placeholder: string | null
          status: string
          storage_key: string
          updated_at: string
          variants: Json
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_video: {
        Args: {
          p_bytes: number
          p_duration_ms: number
          p_height?: number
          p_mime_type: string
          p_poster_key?: string
          p_storage_key: string
          p_width?: number
        }
        Returns: {
          bytes: number | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          owner_id: string
          placeholder: string | null
          status: string
          storage_key: string
          updated_at: string
          variants: Json
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_follow_request: {
        Args: { p_follower: string }
        Returns: undefined
      }
      remove_follower: { Args: { p_follower: string }; Returns: undefined }
      report_content: {
        Args: {
          p_details?: string
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      add_post_update: { Args: { p_body: string; p_post_id: string }; Returns: Database['public']['Tables']['post_updates']['Row'] }
      delete_post_update: { Args: { p_update_id: string }; Returns: undefined }
      explore_posts: { Args: { p_limit?: number }; Returns: { post_id: string }[] }
      invite_to_collection: { Args: { p_collection_id: string; p_user: string }; Returns: undefined }
      respond_collection_invite: { Args: { p_collection_id: string; p_accept: boolean }; Returns: undefined }
      remove_collection_member: { Args: { p_collection_id: string; p_user: string }; Returns: undefined }
      set_account_controls: { Args: { p_require_approval: boolean; p_words: string[]; p_allow_reposts: boolean }; Returns: undefined }
      approve_comment: { Args: { p_comment_id: string }; Returns: undefined }
      reject_comment: { Args: { p_comment_id: string }; Returns: undefined }
      like_comment: { Args: { p_comment_id: string }; Returns: undefined }
      unlike_comment: { Args: { p_comment_id: string }; Returns: undefined }
      comment_like_counts: { Args: { p_ids: string[] }; Returns: { comment_id: string; like_count: number; liked: boolean }[] }
      posting_streak: { Args: Record<string, never>; Returns: { current_streak: number; best_streak: number; posted_today: boolean }[] }
      save_draft: { Args: { p_caption: string; p_media_ids: string[]; p_alt_texts?: string[]; p_spoiler?: boolean; p_scheduled_for?: string }; Returns: Database['public']['Tables']['post_drafts']['Row'] }
      update_draft: { Args: { p_id: string; p_caption: string; p_scheduled_for?: string }; Returns: Database['public']['Tables']['post_drafts']['Row'] }
      delete_draft: { Args: { p_id: string }; Returns: undefined }
      publish_draft: { Args: { p_id: string }; Returns: Database['public']['Tables']['posts']['Row'] }
      set_close_friend: { Args: { p_friend: string; p_in: boolean }; Returns: undefined }
      set_story_audience: { Args: { p_story_id: string; p_audience: string }; Returns: undefined }
      reply_to_story: { Args: { p_story_id: string; p_body: string }; Returns: Database['public']['Tables']['messages']['Row'] }
      react_message: { Args: { p_message: string; p_emoji: string | null }; Returns: undefined }
      unsend_message: { Args: { p_message: string }; Returns: undefined }
      not_interested: { Args: { p_post: string }; Returns: undefined }
      reset_not_interested: { Args: Record<string, never>; Returns: undefined }
      mute_topic: { Args: { p_tag: string }; Returns: undefined }
      unmute_topic: { Args: { p_tag: string }; Returns: undefined }
      repost_post: { Args: { p_post: string; p_note?: string }; Returns: undefined }
      unrepost_post: { Args: { p_post: string }; Returns: undefined }
      friend_suggestions: { Args: { p_limit?: number }; Returns: { user_id: string; mutual_count: number }[] }
      create_collection: { Args: { p_name: string }; Returns: Database['public']['Tables']['collections']['Row'] }
      set_collection_post: { Args: { p_collection_id: string; p_in: boolean; p_post_id: string }; Returns: undefined }
      delete_collection: { Args: { p_collection_id: string }; Returns: undefined }
      create_series: { Args: { p_title: string }; Returns: Database['public']['Tables']['series']['Row'] }
      set_post_series: { Args: { p_post_id: string; p_series_id: string | null }; Returns: undefined }
      set_post_credits: { Args: { p_credits: Json; p_post_id: string }; Returns: undefined }
      set_post_compare: { Args: { p_on: boolean; p_post_id: string }; Returns: undefined }
      decide_message_request: { Args: { p_accept: boolean; p_other: string }; Returns: undefined }
      register_push_token: { Args: { p_platform: string; p_token: string }; Returns: undefined }
      set_save_note: { Args: { p_note: string; p_post_id: string }; Returns: undefined }
      save_post: { Args: { p_post_id: string }; Returns: undefined }
      unblock_user: { Args: { p_target: string }; Returns: undefined }
      unfollow_user: { Args: { p_target: string }; Returns: undefined }
      unlike_post: { Args: { p_post_id: string }; Returns: undefined }
      unmute_user: { Args: { p_target: string }; Returns: undefined }
      unsave_post: { Args: { p_post_id: string }; Returns: undefined }
      delete_story: { Args: { p_story_id: string }; Returns: undefined }
      inbox: {
        Args: Record<PropertyKey, never>
        Returns: {
          last_at: string
          last_body: string
          last_sender: string
          other_id: string
          unread: number
          username: string
        }[]
      }
      mark_notifications_read: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      mark_thread_read: { Args: { p_other: string }; Returns: undefined }
      publish_story: {
        Args: { p_media_id: string }
        Returns: {
          author_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          media_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_message: {
        Args: { p_body: string; p_recipient: string }
        Returns: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      view_story: { Args: { p_story_id: string }; Returns: undefined }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
