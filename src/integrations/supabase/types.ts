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
          penalty_amount: number
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
          penalty_amount?: number
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
          penalty_amount?: number
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
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "contributions_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
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
          applicant_message: string | null
          group_id: string
          id: string
          joined_at: string
          position: number | null
          preferred_operator: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          applicant_message?: string | null
          group_id: string
          id?: string
          joined_at?: string
          position?: number | null
          preferred_operator?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          applicant_message?: string | null
          group_id?: string
          id?: string
          joined_at?: string
          position?: number | null
          preferred_operator?: string | null
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
          {
            foreignKeyName: "group_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          category: string | null
          co_organizers: string[]
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
          visibility: Database["public"]["Enums"]["group_visibility"]
        }
        Insert: {
          category?: string | null
          co_organizers?: string[]
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
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Update: {
          category?: string | null
          co_organizers?: string[]
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
          visibility?: Database["public"]["Enums"]["group_visibility"]
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
      join_attempts: {
        Row: {
          attempted_at: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number | null
          contribution_id: string | null
          created_at: string
          cycle_id: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          group_id: string
          hash: string
          id: string
          memo: string | null
          payment_id: string | null
          prev_hash: string | null
          seq: number
          turn_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          contribution_id?: string | null
          created_at?: string
          cycle_id?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          group_id: string
          hash: string
          id?: string
          memo?: string | null
          payment_id?: string | null
          prev_hash?: string | null
          seq?: number
          turn_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          contribution_id?: string | null
          created_at?: string
          cycle_id?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          group_id?: string
          hash?: string
          id?: string
          memo?: string | null
          payment_id?: string | null
          prev_hash?: string | null
          seq?: number
          turn_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "ledger_entries_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "ledger_entries_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "my_payments_history"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "ledger_entries_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "ledger_entries_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
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
          link: string | null
          read_at: string | null
          title: string
          turn_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          title: string
          turn_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          title?: string
          turn_id?: string | null
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
          {
            foreignKeyName: "notifications_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "notifications_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "notifications_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contribution_id: string
          error_message: string | null
          group_id: string
          id: string
          initiated_at: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          contribution_id: string
          error_message?: string | null
          group_id: string
          id?: string
          initiated_at?: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          contribution_id?: string
          error_message?: string | null
          group_id?: string
          id?: string
          initiated_at?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
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
      receipts: {
        Row: {
          amount: number
          beneficiary_user_id: string
          cycle_id: string
          fee_amount: number
          group_id: string
          hash: string
          id: string
          issued_at: string
          issued_by: string
          ledger_entry_id: string | null
          net_amount: number | null
          payment_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          receipt_number: string
          turn_id: string
        }
        Insert: {
          amount: number
          beneficiary_user_id: string
          cycle_id: string
          fee_amount?: number
          group_id: string
          hash: string
          id?: string
          issued_at?: string
          issued_by: string
          ledger_entry_id?: string | null
          net_amount?: number | null
          payment_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          receipt_number: string
          turn_id: string
        }
        Update: {
          amount?: number
          beneficiary_user_id?: string
          cycle_id?: string
          fee_amount?: number
          group_id?: string
          hash?: string
          id?: string
          issued_at?: string
          issued_by?: string
          ledger_entry_id?: string | null
          net_amount?: number | null
          payment_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          receipt_number?: string
          turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "group_ledger_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "my_payments_history"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "receipts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "receipts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
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
      user_reliability_scores: {
        Row: {
          avg_delay_days: number
          cycles_completed: number
          last_computed_at: string
          score: number
          tier: Database["public"]["Enums"]["reliability_tier"]
          total_due: number
          total_late: number
          total_on_time: number
          total_paid: number
          user_id: string
        }
        Insert: {
          avg_delay_days?: number
          cycles_completed?: number
          last_computed_at?: string
          score?: number
          tier?: Database["public"]["Enums"]["reliability_tier"]
          total_due?: number
          total_late?: number
          total_on_time?: number
          total_paid?: number
          user_id: string
        }
        Update: {
          avg_delay_days?: number
          cycles_completed?: number
          last_computed_at?: string
          score?: number
          tier?: Database["public"]["Enums"]["reliability_tier"]
          total_due?: number
          total_late?: number
          total_on_time?: number
          total_paid?: number
          user_id?: string
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
      group_ledger_view: {
        Row: {
          amount: number | null
          balance_after: number | null
          created_at: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"] | null
          group_id: string | null
          id: string | null
          memo: string | null
          payment_id: string | null
          seq: number | null
          turn_id: string | null
          turn_number: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "my_payments_history"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "ledger_entries_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "ledger_entries_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      group_reliability: {
        Row: {
          full_name: string | null
          group_id: string | null
          score: number | null
          tier: Database["public"]["Enums"]["reliability_tier"] | null
          total_late: number | null
          total_paid: number | null
          user_id: string | null
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
          {
            foreignKeyName: "group_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      my_contributions_due: {
        Row: {
          amount: number | null
          beneficiary_name: string | null
          beneficiary_user_id: string | null
          contribution_id: string | null
          days_to_due: number | null
          due_date: string | null
          expected_penalty: number | null
          group_id: string | null
          group_name: string | null
          status: Database["public"]["Enums"]["contribution_status"] | null
          turn_id: string | null
          turn_number: number | null
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
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "contributions_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
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
          my_role: Database["public"]["Enums"]["member_role"] | null
          my_status: Database["public"]["Enums"]["member_status"] | null
          name: string | null
          organizer_name: string | null
          status: Database["public"]["Enums"]["group_status"] | null
          visibility: Database["public"]["Enums"]["group_visibility"] | null
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
          my_role?: never
          my_status?: never
          name?: string | null
          organizer_name?: never
          status?: Database["public"]["Enums"]["group_status"] | null
          visibility?: Database["public"]["Enums"]["group_visibility"] | null
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
          my_role?: never
          my_status?: never
          name?: string | null
          organizer_name?: never
          status?: Database["public"]["Enums"]["group_status"] | null
          visibility?: Database["public"]["Enums"]["group_visibility"] | null
        }
        Relationships: []
      }
      my_late_contributions: {
        Row: {
          amount: number | null
          confirmed_at: string | null
          contribution_id: string | null
          delay_days: number | null
          due_date: string | null
          group_id: string | null
          group_name: string | null
          turn_number: number | null
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
        ]
      }
      my_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          group_id: string | null
          id: string | null
          kind: Database["public"]["Enums"]["notification_kind"] | null
          link: string | null
          read_at: string | null
          title: string | null
          turn_id: string | null
          user_id: string | null
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
          {
            foreignKeyName: "notifications_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "notifications_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "notifications_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      my_payments_history: {
        Row: {
          amount: number | null
          contribution_id: string | null
          group_id: string | null
          group_name: string | null
          initiated_at: string | null
          payment_id: string | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          provider_ref: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          turn_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      my_receipts: {
        Row: {
          amount: number | null
          beneficiary_name: string | null
          beneficiary_user_id: string | null
          fee_amount: number | null
          group_id: string | null
          group_name: string | null
          hash: string | null
          id: string | null
          issued_at: string | null
          issued_by_name: string | null
          net_amount: number | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          receipt_number: string | null
          turn_id: string | null
          turn_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "receipts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "receipts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      my_reliability: {
        Row: {
          avg_delay_days: number | null
          cycles_completed: number | null
          last_computed_at: string | null
          score: number | null
          tier: Database["public"]["Enums"]["reliability_tier"] | null
          total_due: number | null
          total_late: number | null
          total_on_time: number | null
          total_paid: number | null
          user_id: string | null
        }
        Insert: {
          avg_delay_days?: number | null
          cycles_completed?: number | null
          last_computed_at?: string | null
          score?: number | null
          tier?: Database["public"]["Enums"]["reliability_tier"] | null
          total_due?: number | null
          total_late?: number | null
          total_on_time?: number | null
          total_paid?: number | null
          user_id?: string | null
        }
        Update: {
          avg_delay_days?: number | null
          cycles_completed?: number | null
          last_computed_at?: string | null
          score?: number | null
          tier?: Database["public"]["Enums"]["reliability_tier"] | null
          total_due?: number | null
          total_late?: number | null
          total_on_time?: number | null
          total_paid?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      next_turn_per_group: {
        Row: {
          beneficiary_name: string | null
          beneficiary_user_id: string | null
          cycle_id: string | null
          due_date: string | null
          group_id: string | null
          payout_amount: number | null
          status: Database["public"]["Enums"]["turn_status"] | null
          turn_id: string | null
          turn_number: number | null
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
      turn_settlement: {
        Row: {
          beneficiary_user_id: string | null
          collected_amount: number | null
          confirmed_count: number | null
          cycle_id: string | null
          due_date: string | null
          expected_count: number | null
          group_id: string | null
          paid_at: string | null
          payout_amount: number | null
          receipt_id: string | null
          status: Database["public"]["Enums"]["turn_status"] | null
          turn_id: string | null
          turn_number: number | null
        }
        Insert: {
          beneficiary_user_id?: string | null
          collected_amount?: never
          confirmed_count?: never
          cycle_id?: string | null
          due_date?: string | null
          expected_count?: never
          group_id?: string | null
          paid_at?: string | null
          payout_amount?: number | null
          receipt_id?: never
          status?: Database["public"]["Enums"]["turn_status"] | null
          turn_id?: string | null
          turn_number?: number | null
        }
        Update: {
          beneficiary_user_id?: string | null
          collected_amount?: never
          confirmed_count?: never
          cycle_id?: string | null
          due_date?: string | null
          expected_count?: never
          group_id?: string | null
          paid_at?: string | null
          payout_amount?: number | null
          receipt_id?: never
          status?: Database["public"]["Enums"]["turn_status"] | null
          turn_id?: string | null
          turn_number?: number | null
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
    }
    Functions: {
      _generate_invite_code: { Args: never; Returns: string }
      append_ledger: {
        Args: {
          _amount: number
          _contribution_id: string
          _cycle_id: string
          _entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          _group_id: string
          _memo: string
          _payment_id: string
          _turn_id: string
          _user_id: string
        }
        Returns: string
      }
      approve_member: { Args: { _member_id: string }; Returns: undefined }
      create_group_with_invitation: { Args: { _payload: Json }; Returns: Json }
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
      is_group_participant: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      join_group_with_code: {
        Args: { _code: string; _message?: string; _operator?: string }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      notify: {
        Args: {
          _body?: string
          _data?: Json
          _group_id?: string
          _kind: Database["public"]["Enums"]["notification_kind"]
          _link?: string
          _title: string
          _turn_id?: string
          _user_id: string
        }
        Returns: string
      }
      preview_group_by_code: { Args: { _code: string }; Returns: Json }
      recompute_reliability: {
        Args: { _user_id?: string }
        Returns: {
          avg_delay_days: number
          cycles_completed: number
          last_computed_at: string
          score: number
          tier: Database["public"]["Enums"]["reliability_tier"]
          total_due: number
          total_late: number
          total_on_time: number
          total_paid: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_reliability_scores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_mock_payment: {
        Args: {
          _contribution_id: string
          _provider?: Database["public"]["Enums"]["payment_provider"]
        }
        Returns: string
      }
      reject_member: { Args: { _member_id: string }; Returns: undefined }
      release_payout: {
        Args: {
          _provider?: Database["public"]["Enums"]["payment_provider"]
          _turn_id: string
        }
        Returns: string
      }
      shares_group_with: {
        Args: { _me: string; _other: string }
        Returns: boolean
      }
      start_cycle: { Args: { _group_id: string }; Returns: string }
      update_group_settings: {
        Args: { _group_id: string; _payload: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "organisateur" | "participant"
      contribution_status: "pending" | "submitted" | "confirmed" | "rejected"
      group_frequency: "hebdomadaire" | "quinzaine" | "mensuelle"
      group_status: "draft" | "open" | "active" | "completed" | "cancelled"
      group_visibility: "private" | "public-link" | "directory"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      ledger_entry_type:
        | "contribution_in"
        | "payout_out"
        | "fee"
        | "refund"
        | "penalty"
        | "adjustment"
      member_role: "organisateur" | "membre"
      member_status: "active" | "invited" | "removed" | "left" | "pending"
      notification_kind:
        | "invitation_received"
        | "invitation_accepted"
        | "cycle_started"
        | "contribution_due"
        | "contribution_received"
        | "turn_paid"
        | "group_completed"
        | "system"
        | "payout_released"
        | "turn_started"
        | "receipt_ready"
        | "reliability_changed"
        | "member_joined"
        | "contribution_confirmed"
      payment_provider: "orange_money" | "mtn_money" | "cash" | "simulation"
      payment_status:
        | "initiated"
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
      reliability_tier: "nouveau" | "risque" | "moyen" | "bon" | "excellent"
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
      group_visibility: ["private", "public-link", "directory"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      ledger_entry_type: [
        "contribution_in",
        "payout_out",
        "fee",
        "refund",
        "penalty",
        "adjustment",
      ],
      member_role: ["organisateur", "membre"],
      member_status: ["active", "invited", "removed", "left", "pending"],
      notification_kind: [
        "invitation_received",
        "invitation_accepted",
        "cycle_started",
        "contribution_due",
        "contribution_received",
        "turn_paid",
        "group_completed",
        "system",
        "payout_released",
        "turn_started",
        "receipt_ready",
        "reliability_changed",
        "member_joined",
        "contribution_confirmed",
      ],
      payment_provider: ["orange_money", "mtn_money", "cash", "simulation"],
      payment_status: [
        "initiated",
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ],
      reliability_tier: ["nouveau", "risque", "moyen", "bon", "excellent"],
      rotation_order: ["random", "fixed", "choice"],
      turn_status: ["upcoming", "collecting", "paid", "skipped"],
    },
  },
} as const
