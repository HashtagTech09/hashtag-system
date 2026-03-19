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
      batches: {
        Row: {
          capacity: number | null
          created_at: string
          days: string[] | null
          end_time: string | null
          id: number
          instructor_id: number | null
          level: string | null
          name: string
          organization_id: number
          start_time: string | null
          studio_id: number | null
          style: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          days?: string[] | null
          end_time?: string | null
          id?: never
          instructor_id?: number | null
          level?: string | null
          name: string
          organization_id: number
          start_time?: string | null
          studio_id?: number | null
          style?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          days?: string[] | null
          end_time?: string | null
          id?: never
          instructor_id?: number | null
          level?: string | null
          name?: string
          organization_id?: number
          start_time?: string | null
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
          end_date: string
          id: number
          late_renewal: boolean | null
          organization_id: number
          payment_id: number | null
          registration_fee_applied: boolean | null
          start_date: string
          status_type: string
          student_id: number
        }
        Insert: {
          batch_id: number
          created_at?: string
          end_date: string
          id?: never
          late_renewal?: boolean | null
          organization_id: number
          payment_id?: number | null
          registration_fee_applied?: boolean | null
          start_date: string
          status_type: string
          student_id: number
        }
        Update: {
          batch_id?: number
          created_at?: string
          end_date?: string
          id?: never
          late_renewal?: boolean | null
          organization_id?: number
          payment_id?: number | null
          registration_fee_applied?: boolean | null
          start_date?: string
          status_type?: string
          student_id?: number
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
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      students: {
        Row: {
          created_at: string
          email: string | null
          id: number
          name: string
          organization_id: number
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          source: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          name: string
          organization_id: number
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          source?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          name?: string
          organization_id?: number
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          source?: string | null
          user_id?: number | null
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
          created_at: string
          id: number
          location: string | null
          name: string
          organization_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          location?: string | null
          name: string
          organization_id: number
        }
        Update: {
          created_at?: string
          id?: never
          location?: string | null
          name?: string
          organization_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "studios_organization_id_fkey"
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
      users: {
        Row: {
          created_at: string
          email: string | null
          id: number
          name: string
          organization_id: number
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          name: string
          organization_id: number
          phone?: string | null
          role: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          name?: string
          organization_id?: number
          phone?: string | null
          role?: string
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
