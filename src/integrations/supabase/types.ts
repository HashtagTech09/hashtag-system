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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          batch_ids: Json
          cart_type: string
          created_at: string
          id: number
          organization_id: number
          reminded_at: string | null
          status: string
          student_id: number
        }
        Insert: {
          batch_ids?: Json
          cart_type?: string
          created_at?: string
          id?: number
          organization_id?: number
          reminded_at?: string | null
          status?: string
          student_id: number
        }
        Update: {
          batch_ids?: Json
          cart_type?: string
          created_at?: string
          id?: number
          organization_id?: number
          reminded_at?: string | null
          status?: string
          student_id?: number
        }
        Relationships: []
      }
      application_cases: {
        Row: {
          batch_id: number
          created_at: string
          enrollment_id: number
          id: number
          organization_id: number
          reason: string | null
          requested_at: string
          requested_by_user_id: number | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: number | null
          status: string
          student_id: number
        }
        Insert: {
          batch_id: number
          created_at?: string
          enrollment_id: number
          id?: number
          organization_id?: number
          reason?: string | null
          requested_at?: string
          requested_by_user_id?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: number | null
          status?: string
          student_id: number
        }
        Update: {
          batch_id?: number
          created_at?: string
          enrollment_id?: number
          id?: number
          organization_id?: number
          reason?: string | null
          requested_at?: string
          requested_by_user_id?: number | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: number | null
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_cases_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_cases_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_cases_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_cases_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_cases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          absence_reason: string | null
          batch_id: number
          created_at: string
          date: string
          id: number
          organization_id: number
          status: string
          student_id: number
        }
        Insert: {
          absence_reason?: string | null
          batch_id: number
          created_at?: string
          date: string
          id?: never
          organization_id: number
          status: string
          student_id: number
        }
        Update: {
          absence_reason?: string | null
          batch_id?: number
          created_at?: string
          date?: string
          id?: never
          organization_id?: number
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_sessions: {
        Row: {
          available_slots: number | null
          batch_id: number
          created_at: string
          day: string
          end_time: string
          id: number
          organization_id: number
          session_date: string
          start_time: string
          status: string
          style: string | null
        }
        Insert: {
          available_slots?: number | null
          batch_id: number
          created_at?: string
          day: string
          end_time: string
          id?: never
          organization_id: number
          session_date: string
          start_time: string
          status?: string
          style?: string | null
        }
        Update: {
          available_slots?: number | null
          batch_id?: number
          created_at?: string
          day?: string
          end_time?: string
          id?: never
          organization_id?: number
          session_date?: string
          start_time?: string
          status?: string
          style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          batch_code: string | null
          capacity: number | null
          created_at: string
          eligibility_key: string | null
          id: number
          instructor_2_id: number | null
          instructor_id: number | null
          level: string | null
          name: string
          organization_id: number
          schedule: Json | null
          studio_id: number | null
          style: string | null
          style_base: string | null
        }
        Insert: {
          batch_code?: string | null
          capacity?: number | null
          created_at?: string
          eligibility_key?: string | null
          id?: never
          instructor_2_id?: number | null
          instructor_id?: number | null
          level?: string | null
          name: string
          organization_id: number
          schedule?: Json | null
          studio_id?: number | null
          style?: string | null
          style_base?: string | null
        }
        Update: {
          batch_code?: string | null
          capacity?: number | null
          created_at?: string
          eligibility_key?: string | null
          id?: never
          instructor_2_id?: number | null
          instructor_id?: number | null
          level?: string | null
          name?: string
          organization_id?: number
          schedule?: Json | null
          studio_id?: number | null
          style?: string | null
          style_base?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_payment_requests: {
        Row: {
          amount: number
          batch_ids: Json
          confirmed_at: string | null
          created_at: string
          enrollment_data: Json
          final_amount: number
          gst: number
          id: number
          organization_id: number
          staff_user_id: number
          status: string
          student_id: number
          token: string
        }
        Insert: {
          amount: number
          batch_ids: Json
          confirmed_at?: string | null
          created_at?: string
          enrollment_data: Json
          final_amount: number
          gst?: number
          id?: number
          organization_id?: number
          staff_user_id: number
          status?: string
          student_id: number
          token?: string
        }
        Update: {
          amount?: number
          batch_ids?: Json
          confirmed_at?: string | null
          created_at?: string
          enrollment_data?: Json
          final_amount?: number
          gst?: number
          id?: number
          organization_id?: number
          staff_user_id?: number
          status?: string
          student_id?: number
          token?: string
        }
        Relationships: []
      }
      choreography_uploads: {
        Row: {
          batch_id: number | null
          created_at: string
          duration_sec: number | null
          id: number
          instructor_id: number
          kind: string
          mime_type: string | null
          organization_id: number
          report_id: number
          storage_path: string
          studio_id: number | null
          style: string | null
          taught_on: string
          thumbnail_path: string | null
        }
        Insert: {
          batch_id?: number | null
          created_at?: string
          duration_sec?: number | null
          id?: number
          instructor_id: number
          kind: string
          mime_type?: string | null
          organization_id?: number
          report_id: number
          storage_path: string
          studio_id?: number | null
          style?: string | null
          taught_on: string
          thumbnail_path?: string | null
        }
        Update: {
          batch_id?: number | null
          created_at?: string
          duration_sec?: number | null
          id?: number
          instructor_id?: number
          kind?: string
          mime_type?: string | null
          organization_id?: number
          report_id?: number
          storage_path?: string
          studio_id?: number | null
          style?: string | null
          taught_on?: string
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "choreography_uploads_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "instructor_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_adjustments: {
        Row: {
          adjustment_type: string
          approved_by: number | null
          batch_id: number
          created_at: string
          id: number
          new_cycle_id: number | null
          original_cycle_id: number
          reason: string | null
          status: string
          student_id: number
        }
        Insert: {
          adjustment_type: string
          approved_by?: number | null
          batch_id: number
          created_at?: string
          id?: never
          new_cycle_id?: number | null
          original_cycle_id: number
          reason?: string | null
          status?: string
          student_id: number
        }
        Update: {
          adjustment_type?: string
          approved_by?: number | null
          batch_id?: number
          created_at?: string
          id?: never
          new_cycle_id?: number | null
          original_cycle_id?: number
          reason?: string | null
          status?: string
          student_id?: number
        }
        Relationships: []
      }
      drop_in_credits: {
        Row: {
          created_at: string
          credits_total: number
          credits_used: number
          eligibility_key: string
          expiry_date: string | null
          id: number
          organization_id: number
          payment_id: number | null
          student_id: number
        }
        Insert: {
          created_at?: string
          credits_total?: number
          credits_used?: number
          eligibility_key: string
          expiry_date?: string | null
          id?: never
          organization_id?: number
          payment_id?: number | null
          student_id: number
        }
        Update: {
          created_at?: string
          credits_total?: number
          credits_used?: number
          eligibility_key?: string
          expiry_date?: string | null
          id?: never
          organization_id?: number
          payment_id?: number | null
          student_id?: number
        }
        Relationships: []
      }
      drop_ins: {
        Row: {
          adjusted_at: string | null
          amount: number
          batch_session_id: number
          created_at: string
          id: number
          is_adjusted: boolean
          organization_id: number
          payment_id: number | null
          student_id: number
        }
        Insert: {
          adjusted_at?: string | null
          amount: number
          batch_session_id: number
          created_at?: string
          id?: never
          is_adjusted?: boolean
          organization_id: number
          payment_id?: number | null
          student_id: number
        }
        Update: {
          adjusted_at?: string | null
          amount?: number
          batch_session_id?: number
          created_at?: string
          id?: never
          is_adjusted?: boolean
          organization_id?: number
          payment_id?: number | null
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "drop_ins_batch_session_id_fkey"
            columns: ["batch_session_id"]
            isOneToOne: false
            referencedRelation: "batch_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_ins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_ins_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_ins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrollment_cycles: {
        Row: {
          batch_id: number
          created_at: string
          cycle_id: number
          cycle_type: string
          enrollment_id: number
          id: number
          student_id: number
        }
        Insert: {
          batch_id: number
          created_at?: string
          cycle_id: number
          cycle_type?: string
          enrollment_id: number
          id?: never
          student_id: number
        }
        Update: {
          batch_id?: number
          created_at?: string
          cycle_id?: number
          cycle_type?: string
          enrollment_id?: number
          id?: never
          student_id?: number
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          batch_id: number
          created_at: string
          end_cycle_id: number | null
          end_date: string
          id: number
          is_active: boolean
          late_renewal: boolean | null
          organization_id: number
          payment_id: number | null
          previous_batch_id: number | null
          registration_fee_applied: boolean | null
          start_cycle_id: number | null
          start_date: string
          status_type: string
          student_id: number
          subscription_plan_id: number | null
        }
        Insert: {
          batch_id: number
          created_at?: string
          end_cycle_id?: number | null
          end_date: string
          id?: never
          is_active?: boolean
          late_renewal?: boolean | null
          organization_id: number
          payment_id?: number | null
          previous_batch_id?: number | null
          registration_fee_applied?: boolean | null
          start_cycle_id?: number | null
          start_date: string
          status_type: string
          student_id: number
          subscription_plan_id?: number | null
        }
        Update: {
          batch_id?: number
          created_at?: string
          end_cycle_id?: number | null
          end_date?: string
          id?: never
          is_active?: boolean
          late_renewal?: boolean | null
          organization_id?: number
          payment_id?: number | null
          previous_batch_id?: number | null
          registration_fee_applied?: boolean | null
          start_cycle_id?: number | null
          start_date?: string
          status_type?: string
          student_id?: number
          subscription_plan_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_end_cycle_id_fkey"
            columns: ["end_cycle_id"]
            isOneToOne: false
            referencedRelation: "plan_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_start_cycle_id_fkey"
            columns: ["start_cycle_id"]
            isOneToOne: false
            referencedRelation: "plan_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_reports: {
        Row: {
          absentee_calls: boolean
          absentee_update: boolean
          attendance_marked: boolean
          attire_rating: number
          batch_id: number
          batch_session_id: number
          briefing_done: boolean
          compliance_pct: number | null
          created_at: string
          culture_rating: number
          form: boolean
          id: number
          information_imparted: boolean
          instructor_id: number
          notes: string | null
          organization_id: number
          playlist_prepared: boolean
          poa_shared: boolean
          punctuality: boolean
          registration_followup: boolean
          relationship_building: boolean
          renewal_followup: boolean
          session_date: string
          story_posted: boolean
          students_present: number
          studio_id: number | null
          style: string | null
          submitted_at: string
          syllabus_followed: boolean
          total_score: number | null
          videos_shot: boolean
        }
        Insert: {
          absentee_calls?: boolean
          absentee_update?: boolean
          attendance_marked?: boolean
          attire_rating?: number
          batch_id: number
          batch_session_id: number
          briefing_done?: boolean
          compliance_pct?: number | null
          created_at?: string
          culture_rating?: number
          form?: boolean
          id?: number
          information_imparted?: boolean
          instructor_id: number
          notes?: string | null
          organization_id?: number
          playlist_prepared?: boolean
          poa_shared?: boolean
          punctuality?: boolean
          registration_followup?: boolean
          relationship_building?: boolean
          renewal_followup?: boolean
          session_date: string
          story_posted?: boolean
          students_present?: number
          studio_id?: number | null
          style?: string | null
          submitted_at?: string
          syllabus_followed?: boolean
          total_score?: number | null
          videos_shot?: boolean
        }
        Update: {
          absentee_calls?: boolean
          absentee_update?: boolean
          attendance_marked?: boolean
          attire_rating?: number
          batch_id?: number
          batch_session_id?: number
          briefing_done?: boolean
          compliance_pct?: number | null
          created_at?: string
          culture_rating?: number
          form?: boolean
          id?: number
          information_imparted?: boolean
          instructor_id?: number
          notes?: string | null
          organization_id?: number
          playlist_prepared?: boolean
          poa_shared?: boolean
          punctuality?: boolean
          registration_followup?: boolean
          relationship_building?: boolean
          renewal_followup?: boolean
          session_date?: string
          story_posted?: boolean
          students_present?: number
          studio_id?: number | null
          style?: string | null
          submitted_at?: string
          syllabus_followed?: boolean
          total_score?: number | null
          videos_shot?: boolean
        }
        Relationships: []
      }
      manager_student_access: {
        Row: {
          created_at: string
          id: number
          manager_user_id: number
          organization_id: number
          student_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          manager_user_id: number
          organization_id?: number
          student_id: number
        }
        Update: {
          created_at?: string
          id?: number
          manager_user_id?: number
          organization_id?: number
          student_id?: number
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: number
          organization_id: number
          payload: Json | null
          recipient: string
          status: string
          template_name: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: never
          organization_id?: number
          payload?: Json | null
          recipient: string
          status?: string
          template_name?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: never
          organization_id?: number
          payload?: Json | null
          recipient?: string
          status?: string
          template_name?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          batch_id: number
          created_at: string
          id: number
          is_primary: boolean
          payment_id: number
          studio_id: number | null
        }
        Insert: {
          allocated_amount?: number
          batch_id: number
          created_at?: string
          id?: never
          is_primary?: boolean
          payment_id: number
          studio_id?: number | null
        }
        Update: {
          allocated_amount?: number
          batch_id?: number
          created_at?: string
          id?: never
          is_primary?: boolean
          payment_id?: number
          studio_id?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          confirmed_by_staff_id: number | null
          created_at: string
          final_amount: number | null
          gateway_order_id: string | null
          gateway_payment_id: string | null
          gst: number | null
          id: number
          net_amount: number | null
          organization_id: number
          payment_mode: string | null
          rzp_account: string | null
          status: string
          student_id: number
        }
        Insert: {
          amount: number
          confirmed_by_staff_id?: number | null
          created_at?: string
          final_amount?: number | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gst?: number | null
          id?: never
          net_amount?: number | null
          organization_id: number
          payment_mode?: string | null
          rzp_account?: string | null
          status?: string
          student_id: number
        }
        Update: {
          amount?: number
          confirmed_by_staff_id?: number | null
          created_at?: string
          final_amount?: number | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gst?: number | null
          id?: never
          net_amount?: number | null
          organization_id?: number
          payment_mode?: string | null
          rzp_account?: string | null
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_enrollments: {
        Row: {
          created_at: string
          enrollment_data: Json
          id: number
          payment_id: number
          status: string
        }
        Insert: {
          created_at?: string
          enrollment_data: Json
          id?: never
          payment_id: number
          status?: string
        }
        Update: {
          created_at?: string
          enrollment_data?: Json
          id?: never
          payment_id?: number
          status?: string
        }
        Relationships: []
      }
      plan_cycles: {
        Row: {
          created_at: string
          duration_days: number | null
          end_date: string | null
          grace_days: number
          id: number
          is_active: boolean
          name: string
          open_for_sale: boolean
          organization_id: number
          plan_type: string
          registration_deadline: string | null
          sequence_no: number | null
          start_date: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          end_date?: string | null
          grace_days?: number
          id?: never
          is_active?: boolean
          name: string
          open_for_sale?: boolean
          organization_id: number
          plan_type?: string
          registration_deadline?: string | null
          sequence_no?: number | null
          start_date: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          end_date?: string | null
          grace_days?: number
          id?: never
          is_active?: boolean
          name?: string
          open_for_sale?: boolean
          organization_id?: number
          plan_type?: string
          registration_deadline?: string | null
          sequence_no?: number | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          batch_count: number
          id: number
          organization_id: number
          price: number
        }
        Insert: {
          batch_count: number
          id?: never
          organization_id: number
          price: number
        }
        Update: {
          batch_count?: number
          id?: never
          organization_id?: number
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: number
          name: string
          type: string
        }
        Insert: {
          id?: never
          name: string
          type: string
        }
        Update: {
          id?: never
          name?: string
          type?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string
          dob: string | null
          email: string | null
          gender: string | null
          id: number
          name: string
          organization_id: number
          phone: string | null
          photo: string | null
          user_id: number
        }
        Insert: {
          created_at?: string
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: never
          name: string
          organization_id: number
          phone?: string | null
          photo?: string | null
          user_id: number
        }
        Update: {
          created_at?: string
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: never
          name?: string
          organization_id?: number
          phone?: string | null
          photo?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          code: string | null
          created_at: string
          dreamcatcher_id: number | null
          google_maps_url: string | null
          id: number
          location: string | null
          name: string
          organization_id: number
          wingperson_id: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          dreamcatcher_id?: number | null
          google_maps_url?: string | null
          id?: never
          location?: string | null
          name: string
          organization_id: number
          wingperson_id?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string
          dreamcatcher_id?: number | null
          google_maps_url?: string | null
          id?: never
          location?: string | null
          name?: string
          organization_id?: number
          wingperson_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studios_dreamcatcher_id_fkey"
            columns: ["dreamcatcher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studios_wingperson_id_fkey"
            columns: ["wingperson_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_cycles: {
        Row: {
          id: number
          plan_type: string
          sequence_order: number
          subscription_plan_id: number
        }
        Insert: {
          id?: never
          plan_type?: string
          sequence_order: number
          subscription_plan_id: number
        }
        Update: {
          id?: never
          plan_type?: string
          sequence_order?: number
          subscription_plan_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_cycles_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          organization_id: number
          total_cycles: number
          total_grid_cycles: number
          total_regular_cycles: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          name: string
          organization_id: number
          total_cycles?: number
          total_grid_cycles?: number
          total_regular_cycles?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          name?: string
          organization_id?: number
          total_cycles?: number
          total_grid_cycles?: number
          total_regular_cycles?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: number
          key: string
          organization_id: number
          value: string
        }
        Insert: {
          id?: never
          key: string
          organization_id: number
          value: string
        }
        Update: {
          id?: never
          key?: string
          organization_id?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: number
          is_primary: boolean
          organization_id: number
          role_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          is_primary?: boolean
          organization_id: number
          role_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: never
          is_primary?: boolean
          organization_id?: number
          role_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string
          email: string | null
          id: number
          name: string
          organization_id: number
          phone: string | null
          photo: string | null
          scope_restricted: boolean
          source: string | null
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          email?: string | null
          id?: never
          name: string
          organization_id: number
          phone?: string | null
          photo?: string | null
          scope_restricted?: boolean
          source?: string | null
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          email?: string | null
          id?: never
          name?: string
          organization_id?: number
          phone?: string | null
          photo?: string | null
          scope_restricted?: boolean
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_otp: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          otp: string
          phone: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: never
          otp: string
          phone: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: never
          otp?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
