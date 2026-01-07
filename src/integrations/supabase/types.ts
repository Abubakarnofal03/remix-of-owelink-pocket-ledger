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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      bill_participants: {
        Row: {
          amount_owed: number
          amount_paid: number
          bill_id: string
          created_at: string
          id: string
          phone_number: string
          phone_suffix: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_owed: number
          amount_paid?: number
          bill_id: string
          created_at?: string
          id?: string
          phone_number: string
          phone_suffix?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_owed?: number
          amount_paid?: number
          bill_id?: string
          created_at?: string
          id?: string
          phone_number?: string
          phone_suffix?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_participants_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          created_at: string
          creator_id: string
          currency: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          last_reminder_sent_at: string | null
          reminder_enabled: boolean | null
          reminder_interval_days: number | null
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          reminder_enabled?: boolean | null
          reminder_interval_days?: number | null
          status?: string
          title: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          reminder_enabled?: boolean | null
          reminder_interval_days?: number | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          linked_profile_id: string | null
          nickname: string | null
          phone_number: string
          phone_suffix: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_profile_id?: string | null
          nickname?: string | null
          phone_number: string
          phone_suffix?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_profile_id?: string | null
          nickname?: string | null
          phone_number?: string
          phone_suffix?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          device_platform: string | null
          fcm_token: string
          id: string
          phone_suffix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_platform?: string | null
          fcm_token: string
          id?: string
          phone_suffix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_platform?: string | null
          fcm_token?: string
          id?: string
          phone_suffix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paid: number
          client_phone_number: string
          client_user_id: string | null
          created_at: string
          creator_id: string
          currency: string
          deleted_at: string | null
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          client_phone_number: string
          client_user_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          status?: string
          title: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          client_phone_number?: string
          client_user_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      iou_payment_requests: {
        Row: {
          amount_claimed: number
          created_at: string
          creator_response: string | null
          id: string
          iou_id: string
          message: string | null
          receipt_url: string | null
          requester_phone_suffix: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_claimed?: number
          created_at?: string
          creator_response?: string | null
          id?: string
          iou_id: string
          message?: string | null
          receipt_url?: string | null
          requester_phone_suffix: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_claimed?: number
          created_at?: string
          creator_response?: string | null
          id?: string
          iou_id?: string
          message?: string | null
          receipt_url?: string | null
          requester_phone_suffix?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iou_payment_requests_iou_id_fkey"
            columns: ["iou_id"]
            isOneToOne: false
            referencedRelation: "ious"
            referencedColumns: ["id"]
          },
        ]
      }
      ious: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          creditor_id: string
          currency: string
          debtor_phone_number: string
          debtor_phone_suffix: string | null
          debtor_user_id: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          last_reminder_sent_at: string | null
          reminder_enabled: boolean | null
          reminder_interval_days: number | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          creditor_id: string
          currency?: string
          debtor_phone_number: string
          debtor_phone_suffix?: string | null
          debtor_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          reminder_enabled?: boolean | null
          reminder_interval_days?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          creditor_id?: string
          currency?: string
          debtor_phone_number?: string
          debtor_phone_suffix?: string | null
          debtor_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          reminder_enabled?: boolean | null
          reminder_interval_days?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount_claimed: number
          bill_id: string
          created_at: string
          creator_response: string | null
          id: string
          message: string | null
          participant_id: string
          receipt_url: string | null
          requester_phone_suffix: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_claimed?: number
          bill_id: string
          created_at?: string
          creator_response?: string | null
          id?: string
          message?: string | null
          participant_id: string
          receipt_url?: string | null
          requester_phone_suffix: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_claimed?: number
          bill_id?: string
          created_at?: string
          creator_response?: string | null
          id?: string
          message?: string | null
          participant_id?: string
          receipt_url?: string | null
          requester_phone_suffix?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "bill_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          payer_id: string | null
          payer_phone_number: string
          reference_id: string
          reference_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payer_id?: string | null
          payer_phone_number: string
          reference_id: string
          reference_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payer_id?: string | null
          payer_phone_number?: string
          reference_id?: string
          reference_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_mode_enabled: boolean
          created_at: string
          id: string
          notification_preferences: Json | null
          phone_number: string
          phone_suffix: string | null
          settings: Json | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          business_mode_enabled?: boolean
          created_at?: string
          id?: string
          notification_preferences?: Json | null
          phone_number: string
          phone_suffix?: string | null
          settings?: Json | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          business_mode_enabled?: boolean
          created_at?: string
          id?: string
          notification_preferences?: Json | null
          phone_number?: string
          phone_suffix?: string | null
          settings?: Json | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_phone: { Args: { _user_id: string }; Returns: string }
      get_user_phone_suffix: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_bill_creator: { Args: { bill_id: string }; Returns: boolean }
      is_bill_participant: { Args: { bill_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
