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
      attendance: {
        Row: {
          batch_id: number
          created_at: string
          date: string
          id: number
          organization_id: number
          status: string
          student_id: number
        }
        Insert: {
          batch_id: number
          created_at?: string
          date: string
          id?: never
          organization_id: number
          status: string
          student_id: number
        }
        Update: {
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
          id: number
          instructor_id: number | null
          level: string | null
          name: string
          organization_id: number
          schedule: Json | null
          studio_id: number | null
          style: string | null
        }
        Insert: {
          batch_code?: string | null
          capacity?: number | null
          created_at?: string
          id?: never
          instructor_id?: number | null
          level?: string | null
          name: string
          organization_id: number
          schedule?: Json | null
          studio_id?: number | null
          style?: string | null
        }
        Update: {
          batch_code?: string | null
          capacity?: number | null
          created_at?: string
          id?: never
          instructor_id?: number | null
          level?: string | null
          name?: string
          organization_id?: number
          schedule?: Json | null
          studio_id?: number | null
          style?: string | null
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
      drop_ins: {
        Row: {
          adjustable_until: string | null
          adjusted: boolean | null
          amount: number
          batch_id: number
          class_date: string
          created_at: string
          id: number
          organization_id: number
          student_id: number
        }
        Insert: {
          adjustable_until?: string | null
          adjusted?: boolean | null
          amount: number
          batch_id: number
          class_date: string
          created_at?: string
          id?: never
          organization_id: number
          student_id: number
        }
        Update: {
          adjustable_until?: string | null
          adjusted?: boolean | null
          amount?: number
          batch_id?: number
          class_date?: string
          created_at?: string
          id?: never
          organization_id?: number
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "drop_ins_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
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
            foreignKeyName: "drop_ins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          batch_id: number
          created_at: string
          end_cycle_id: number | null
          end_date: string
          id: number
          late_renewal: boolean | null
          organization_id: number
          payment_id: number | null
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
          late_renewal?: boolean | null
          organization_id: number
          payment_id?: number | null
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
          late_renewal?: boolean | null
          organization_id?: number
          payment_id?: number | null
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
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: number
          organization_id: number
          payment_mode: string | null
          status: string
          student_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: never
          organization_id: number
          payment_mode?: string | null
          status?: string
          student_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: never
          organization_id?: number
          payment_mode?: string | null
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
      plan_cycles: {
        Row: {
          created_at: string
          duration_days: number | null
          end_date: string | null
          id: number
          is_active: boolean
          name: string
          organization_id: number
          plan_type: string
          start_date: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          end_date?: string | null
          id?: never
          is_active?: boolean
          name: string
          organization_id: number
          plan_type?: string
          start_date: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          end_date?: string | null
          id?: never
          is_active?: boolean
          name?: string
          organization_id?: number
          plan_type?: string
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
          created_at: string
          email: string | null
          id: number
          name: string
          organization_id: number
          phone: string | null
          photo: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          name: string
          organization_id: number
          phone?: string | null
          photo?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          name?: string
          organization_id?: number
          phone?: string | null
          photo?: string | null
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
