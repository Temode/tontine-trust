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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contributions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          group_id: string
          id: string
          payer_user_id: string
          provider: Database["public"]["Enums"]["payment_provider"] | null
          reference: string | null
          status: Database["public"]["Enums"]["contribution_status"]
          submitted_at: string | null
          turn_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          payer_user_id: string
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          reference?: string | null
          status?: Database["public"]["Enums"]["contribution_status"]
          submitted_at?: string | null
          turn_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          payer_user_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          reference?: string | null
          status?: Database["public"]["Enums"]["contribution_status"]
          submitted_at?: string | null
          turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          cycle_number: number
          ended_at: string | null
          group_id: string
          id: string
          started_at: string
        }
        Insert: {
          cycle_number?: number
          ended_at?: string | null
          group_id: string
          id?: string
          started_at?: string
        }
        Update: {
          cycle_number?: number
          ended_at?: string | null
          group_id?: string
          id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          position: number | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          position?: number | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          position?: number | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          category: string | null
          contribution_amount: number
          created_at: string
          created_by: string
          description: string | null
          frequency: Database["public"]["Enums"]["group_frequency"]
          id: string
          late_penalty_after_days: number
          late_penalty_percent: number
          max_members: number
          name: string
          rotation_order_kind: Database["public"]["Enums"]["rotation_order"]
          status: Database["public"]["Enums"]["group_status"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          contribution_amount: number
          created_at?: string
          created_by: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["group_frequency"]
          id?: string
          late_penalty_after_days?: number
          late_penalty_percent?: number
          max_members: number
          name: string
          rotation_order_kind?: Database["public"]["Enums"]["rotation_order"]
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          contribution_amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["group_frequency"]
          id?: string
          late_penalty_after_days?: number
          late_penalty_percent?: number
          max_members?: number
          name?: string
          rotation_order_kind?: Database["public"]["Enums"]["rotation_order"]
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          max_uses: number | null
          status: Database["public"]["Enums"]["invitation_status"]
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          max_uses?: number | null
          status?: Database["public"]["Enums"]["invitation_status"]
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          max_uses?: number | null
          status?: Database["public"]["Enums"]["invitation_status"]
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          group_id: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone_number: string | null
          reliability_score: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone_number?: string | null
          reliability_score?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          reliability_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      turns: {
        Row: {
          beneficiary_user_id: string
          cycle_id: string
          due_date: string
          group_id: string
          id: string
          paid_at: string | null
          payout_amount: number
          payout_reference: string | null
          status: Database["public"]["Enums"]["turn_status"]
          turn_number: number
        }
        Insert: {
          beneficiary_user_id: string
          cycle_id: string
          due_date: string
          group_id: string
          id?: string
          paid_at?: string | null
          payout_amount: number
          payout_reference?: string | null
          status?: Database["public"]["Enums"]["turn_status"]
          turn_number: number
        }
        Update: {
          beneficiary_user_id?: string
          cycle_id?: string
          due_date?: string
          group_id?: string
          id?: string
          paid_at?: string | null
          payout_amount?: number
          payout_reference?: string | null
          status?: Database["public"]["Enums"]["turn_status"]
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "turns_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      my_groups_overview: {
        Row: {
          contribution_amount: number | null
          created_at: string | null
          description: string | null
          frequency: Database["public"]["Enums"]["group_frequency"] | null
          id: string | null
          is_organizer: boolean | null
          max_members: number | null
          members_count: number | null
          name: string | null
          status: Database["public"]["Enums"]["group_status"] | null
        }
        Insert: {
          contribution_amount?: number | null
          created_at?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["group_frequency"] | null
          id?: string | null
          is_organizer?: never
          max_members?: number | null
          members_count?: never
          name?: string | null
          status?: Database["public"]["Enums"]["group_status"] | null
        }
        Update: {
          contribution_amount?: number | null
          created_at?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["group_frequency"] | null
          id?: string | null
          is_organizer?: never
          max_members?: number | null
          members_count?: never
          name?: string | null
          status?: Database["public"]["Enums"]["group_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_organizer: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      join_group_with_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "organisateur" | "participant"
      contribution_status: "pending" | "submitted" | "confirmed" | "rejected"
      group_frequency: "hebdomadaire" | "quinzaine" | "mensuelle"
      group_status: "draft" | "open" | "active" | "completed" | "cancelled"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      member_role: "organisateur" | "membre"
      member_status: "active" | "invited" | "removed" | "left"
      notification_kind:
        | "invitation_received"
        | "invitation_accepted"
        | "cycle_started"
        | "contribution_due"
        | "contribution_received"
        | "turn_paid"
        | "group_completed"
        | "system"
      payment_provider: "orange_money" | "mtn_money" | "cash" | "simulation"
      rotation_order: "random" | "fixed" | "choice"
      turn_status: "upcoming" | "collecting" | "paid" | "skipped"
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
      app_role: ["admin", "organisateur", "participant"],
      contribution_status: ["pending", "submitted", "confirmed", "rejected"],
      group_frequency: ["hebdomadaire", "quinzaine", "mensuelle"],
      group_status: ["draft", "open", "active", "completed", "cancelled"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      member_role: ["organisateur", "membre"],
      member_status: ["active", "invited", "removed", "left"],
      notification_kind: [
        "invitation_received",
        "invitation_accepted",
        "cycle_started",
        "contribution_due",
        "contribution_received",
        "turn_paid",
        "group_completed",
        "system",
      ],
      payment_provider: ["orange_money", "mtn_money", "cash", "simulation"],
      rotation_order: ["random", "fixed", "choice"],
      turn_status: ["upcoming", "collecting", "paid", "skipped"],
    },
  },
} as const
