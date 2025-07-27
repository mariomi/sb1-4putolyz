export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name?: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          profile_id: string
          name: string
          subject: string
          html_content: string
          status: string
          scheduled_at: string | null
          send_duration_hours: number
          start_time_of_day: string
          warm_up_days: number
          emails_per_batch: number
          batch_interval_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          name: string
          subject: string
          html_content?: string
          status?: string
          scheduled_at?: string | null
          send_duration_hours?: number
          start_time_of_day?: string
          warm_up_days?: number
          emails_per_batch?: number
          batch_interval_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          name?: string
          subject?: string
          html_content?: string
          status?: string
          scheduled_at?: string | null
          send_duration_hours?: number
          start_time_of_day?: string
          warm_up_days?: number
          emails_per_batch?: number
          batch_interval_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          profile_id: string
          name: string
          description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          name: string
          description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          name?: string
          description?: string
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          profile_id: string
          first_name: string
          last_name: string
          email: string
          phone: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      contact_groups: {
        Row: {
          id: string
          contact_id: string
          group_id: string
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          group_id: string
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          group_id?: string
          created_at?: string
        }
      }
      senders: {
        Row: {
          id: string
          profile_id: string
          domain: string
          email_from: string
          display_name: string
          resend_domain_id: string | null
          resend_status: string
          daily_limit: number
          emails_sent_today: number
          current_day: number
          last_sent_at: string | null
          warm_up_stage: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          domain: string
          email_from: string
          display_name: string
          resend_domain_id?: string | null
          resend_status?: string
          daily_limit?: number
          emails_sent_today?: number
          current_day?: number
          last_sent_at?: string | null
          warm_up_stage?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          domain?: string
          email_from?: string
          display_name?: string
          resend_domain_id?: string | null
          resend_status?: string
          daily_limit?: number
          emails_sent_today?: number
          current_day?: number
          last_sent_at?: string | null
          warm_up_stage?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      campaign_senders: {
        Row: {
          id: string
          campaign_id: string
          sender_id: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          sender_id: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          sender_id?: string
          created_at?: string
        }
      }
      campaign_queues: {
        Row: {
          id: string
          campaign_id: string
          contact_id: string
          sender_id: string | null
          status: string
          scheduled_for: string
          sent_at: string | null
          resend_email_id: string | null
          error_message: string | null
          retry_count: number
          priority: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          contact_id: string
          sender_id?: string | null
          status?: string
          scheduled_for: string
          sent_at?: string | null
          resend_email_id?: string | null
          error_message?: string | null
          retry_count?: number
          priority?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          contact_id?: string
          sender_id?: string | null
          status?: string
          scheduled_for?: string
          sent_at?: string | null
          resend_email_id?: string | null
          error_message?: string | null
          retry_count?: number
          priority?: number
          created_at?: string
          updated_at?: string
        }
      }
      logs: {
        Row: {
          id: string
          campaign_id: string
          queue_entry_id: string | null
          sender_id: string | null
          contact_id: string | null
          event_type: string
          event_data: any
          timestamp: string
        }
        Insert: {
          id?: string
          campaign_id: string
          queue_entry_id?: string | null
          sender_id?: string | null
          contact_id?: string | null
          event_type: string
          event_data?: any
          timestamp?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          queue_entry_id?: string | null
          sender_id?: string | null
          contact_id?: string | null
          event_type?: string
          event_data?: any
          timestamp?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']