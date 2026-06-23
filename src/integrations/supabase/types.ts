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
      app_terms_versions: {
        Row: {
          content: string
          published_at: string
          version: string
        }
        Insert: {
          content: string
          published_at?: string
          version: string
        }
        Update: {
          content?: string
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          group_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_purge_history: {
        Row: {
          id: string
          purged_at: string
          rows_deleted: number
        }
        Insert: {
          id?: string
          purged_at?: string
          rows_deleted: number
        }
        Update: {
          id?: string
          purged_at?: string
          rows_deleted?: number
        }
        Relationships: []
      }
      beneficiary_balances: {
        Row: {
          available_amount: number
          created_at: string
          group_id: string
          id: string
          total_credited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_amount?: number
          created_at?: string
          group_id: string
          id?: string
          total_credited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_amount?: number
          created_at?: string
          group_id?: string
          id?: string
          total_credited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_balances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_balances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_balances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          is_muted: boolean
          joined_at: string
          left_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_id: string
          is_muted?: boolean
          joined_at?: string
          left_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_id?: string
          is_muted?: boolean
          joined_at?: string
          left_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_requests: {
        Row: {
          created_at: string
          ended_at: string | null
          group_id: string
          id: string
          recording_consent_user_ids: string[]
          recording_duration_seconds: number | null
          recording_size: number | null
          recording_url: string | null
          requested_by: string
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_request_status"]
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          group_id: string
          id?: string
          recording_consent_user_ids?: string[]
          recording_duration_seconds?: number | null
          recording_size?: number | null
          recording_url?: string | null
          requested_by: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_request_status"]
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          group_id?: string
          id?: string
          recording_consent_user_ids?: string[]
          recording_duration_seconds?: number | null
          recording_size?: number | null
          recording_url?: string | null
          requested_by?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_request_status"]
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string
          group_id: string
          hash_sha256: string
          id: string
          ip: string | null
          otp_ref: string | null
          signed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          contract_id: string
          group_id: string
          hash_sha256: string
          id?: string
          ip?: string | null
          otp_ref?: string | null
          signed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          contract_id?: string
          group_id?: string
          hash_sha256?: string
          id?: string
          ip?: string | null
          otp_ref?: string | null
          signed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "group_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_otp_ref_fkey"
            columns: ["otp_ref"]
            isOneToOne: false
            referencedRelation: "phone_otp_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_disputes: {
        Row: {
          contribution_id: string
          created_at: string
          evidence_url: string | null
          group_id: string
          id: string
          organizer_response: string | null
          raised_by: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contribution_id: string
          created_at?: string
          evidence_url?: string | null
          group_id: string
          id?: string
          organizer_response?: string | null
          raised_by: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contribution_id?: string
          created_at?: string
          evidence_url?: string | null
          group_id?: string
          id?: string
          organizer_response?: string | null
          raised_by?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "contribution_disputes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "contribution_disputes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_disputes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_disputes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          default_days: number
          defaulted_at: string | null
          group_id: string
          id: string
          payer_user_id: string
          penalty_adjust_reason: string | null
          penalty_adjusted_at: string | null
          penalty_adjusted_by: string | null
          penalty_adjusted_from: number | null
          penalty_amount: number
          penalty_waive_reason: string | null
          penalty_waived_at: string | null
          penalty_waived_by: string | null
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
          default_days?: number
          defaulted_at?: string | null
          group_id: string
          id?: string
          payer_user_id: string
          penalty_adjust_reason?: string | null
          penalty_adjusted_at?: string | null
          penalty_adjusted_by?: string | null
          penalty_adjusted_from?: number | null
          penalty_amount?: number
          penalty_waive_reason?: string | null
          penalty_waived_at?: string | null
          penalty_waived_by?: string | null
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
          default_days?: number
          defaulted_at?: string | null
          group_id?: string
          id?: string
          payer_user_id?: string
          penalty_adjust_reason?: string | null
          penalty_adjusted_at?: string | null
          penalty_adjusted_by?: string | null
          penalty_adjusted_from?: number | null
          penalty_amount?: number
          penalty_waive_reason?: string | null
          penalty_waived_at?: string | null
          penalty_waived_by?: string | null
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
      dispute_exports: {
        Row: {
          created_at: string
          error_message: string | null
          expires_at: string | null
          group_id: string
          id: string
          member_id: string
          pdf_path: string | null
          reason: string
          requested_by: string
          sha256: string | null
          signed_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          member_id: string
          pdf_path?: string | null
          reason: string
          requested_by: string
          sha256?: string | null
          signed_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          member_id?: string
          pdf_path?: string | null
          reason?: string
          requested_by?: string
          sha256?: string | null
          signed_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_exports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_exports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_exports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      djomy_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload: Json
          received_at: string
          signature_valid: boolean
          transaction_id: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          payload: Json
          received_at?: string
          signature_valid: boolean
          transaction_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json
          received_at?: string
          signature_valid?: boolean
          transaction_id?: string | null
        }
        Relationships: []
      }
      external_payment_proofs: {
        Row: {
          amount: number
          contribution_id: string
          group_id: string
          id: string
          member_user_id: string
          method: Database["public"]["Enums"]["payment_method_external"]
          note: string | null
          proof_url: string | null
          recorded_at: string
          recorded_by: string
          reference: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["external_proof_status"]
        }
        Insert: {
          amount: number
          contribution_id: string
          group_id: string
          id?: string
          member_user_id: string
          method: Database["public"]["Enums"]["payment_method_external"]
          note?: string | null
          proof_url?: string | null
          recorded_at?: string
          recorded_by: string
          reference?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["external_proof_status"]
        }
        Update: {
          amount?: number
          contribution_id?: string
          group_id?: string
          id?: string
          member_user_id?: string
          method?: Database["public"]["Enums"]["payment_method_external"]
          note?: string | null
          proof_url?: string | null
          recorded_at?: string
          recorded_by?: string
          reference?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["external_proof_status"]
        }
        Relationships: [
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "external_payment_proofs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "external_payment_proofs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payment_proofs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_payment_proofs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admin_permissions: {
        Row: {
          can_approve_members: boolean
          can_confirm_payments: boolean
          can_edit_settings: boolean
          can_kick_member: boolean
          can_manage_invitations: boolean
          can_pause_cycle: boolean
          can_report_defaulter: boolean
          can_send_announcements: boolean
          can_suspend_member: boolean
          can_waive_penalty: boolean
          granted_at: string
          granted_by: string | null
          group_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_approve_members?: boolean
          can_confirm_payments?: boolean
          can_edit_settings?: boolean
          can_kick_member?: boolean
          can_manage_invitations?: boolean
          can_pause_cycle?: boolean
          can_report_defaulter?: boolean
          can_send_announcements?: boolean
          can_suspend_member?: boolean
          can_waive_penalty?: boolean
          granted_at?: string
          granted_by?: string | null
          group_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_approve_members?: boolean
          can_confirm_payments?: boolean
          can_edit_settings?: boolean
          can_kick_member?: boolean
          can_manage_invitations?: boolean
          can_pause_cycle?: boolean
          can_report_defaulter?: boolean
          can_send_announcements?: boolean
          can_suspend_member?: boolean
          can_waive_penalty?: boolean
          granted_at?: string
          granted_by?: string | null
          group_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_admin_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_admin_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_admin_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_announcements: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          group_id: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          group_id: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_announcements_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_announcements_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_consent_log: {
        Row: {
          accepted_at: string
          group_id: string
          id: string
          ip_hash: string | null
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          group_id: string
          id?: string
          ip_hash?: string | null
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          group_id?: string
          id?: string
          ip_hash?: string | null
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_consent_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_consent_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_consent_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_consent_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_consent_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_contracts: {
        Row: {
          body_md: string
          created_at: string
          created_by: string | null
          group_id: string | null
          id: string
          is_default: boolean
          published_at: string
          version: string
        }
        Insert: {
          body_md: string
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          is_default?: boolean
          published_at?: string
          version: string
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          is_default?: boolean
          published_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_contracts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_contracts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_contracts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_deletion_requests: {
        Row: {
          admin_decision_at: string | null
          admin_decision_by: string | null
          admin_decision_reason: string | null
          created_at: string
          group_id: string
          id: string
          members_deadline: string
          reason: string
          requested_by: string
          status: Database["public"]["Enums"]["deletion_request_status"]
          updated_at: string
        }
        Insert: {
          admin_decision_at?: string | null
          admin_decision_by?: string | null
          admin_decision_reason?: string | null
          created_at?: string
          group_id: string
          id?: string
          members_deadline: string
          reason: string
          requested_by: string
          status?: Database["public"]["Enums"]["deletion_request_status"]
          updated_at?: string
        }
        Update: {
          admin_decision_at?: string | null
          admin_decision_by?: string | null
          admin_decision_reason?: string | null
          created_at?: string
          group_id?: string
          id?: string
          members_deadline?: string
          reason?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["deletion_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_deletion_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deletion_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deletion_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_deletion_votes: {
        Row: {
          request_id: string
          user_id: string
          vote: Database["public"]["Enums"]["deletion_vote_choice"]
          voted_at: string
        }
        Insert: {
          request_id: string
          user_id: string
          vote: Database["public"]["Enums"]["deletion_vote_choice"]
          voted_at?: string
        }
        Update: {
          request_id?: string
          user_id?: string
          vote?: Database["public"]["Enums"]["deletion_vote_choice"]
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_deletion_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "deletion_requests_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deletion_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "group_deletion_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          applicant_message: string | null
          can_bid: boolean
          can_chat: boolean
          can_invite: boolean
          can_swap: boolean
          deposit_status: string
          group_id: string
          id: string
          joined_after_start: boolean
          joined_at: string
          position: number | null
          preferred_operator: string | null
          removed_at: string | null
          removed_by: string | null
          removed_reason: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          user_id: string
          was_late_at_turn_number: number[] | null
          was_late_in_cycle: boolean
        }
        Insert: {
          applicant_message?: string | null
          can_bid?: boolean
          can_chat?: boolean
          can_invite?: boolean
          can_swap?: boolean
          deposit_status?: string
          group_id: string
          id?: string
          joined_after_start?: boolean
          joined_at?: string
          position?: number | null
          preferred_operator?: string | null
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          user_id: string
          was_late_at_turn_number?: number[] | null
          was_late_in_cycle?: boolean
        }
        Update: {
          applicant_message?: string | null
          can_bid?: boolean
          can_chat?: boolean
          can_invite?: boolean
          can_swap?: boolean
          deposit_status?: string
          group_id?: string
          id?: string
          joined_after_start?: boolean
          joined_at?: string
          position?: number | null
          preferred_operator?: string | null
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          user_id?: string
          was_late_at_turn_number?: number[] | null
          was_late_in_cycle?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "group_members_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
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
      group_message_reads: {
        Row: {
          group_id: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          author_user_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          group_id: string
          id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          author_user_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_id: string
          id?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          author_user_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          archived_reason: string | null
          category: string | null
          co_organizers: string[]
          contribution_amount: number
          created_at: string
          created_by: string
          deleted_at: string | null
          deletion_request_id: string | null
          deposit_months: number
          deposit_required: boolean
          description: string | null
          frequency: Database["public"]["Enums"]["group_frequency"]
          id: string
          late_penalty_after_days: number
          late_penalty_percent: number
          max_members: number
          name: string
          new_member_lock_last_third: boolean
          paused_at: string | null
          paused_by: string | null
          paused_reason: string | null
          rotation_order_kind: Database["public"]["Enums"]["rotation_order"]
          status: Database["public"]["Enums"]["group_status"]
          swap_policy: Database["public"]["Enums"]["swap_policy"]
          total_paused_days: number
          updated_at: string
          visibility: Database["public"]["Enums"]["group_visibility"]
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          category?: string | null
          co_organizers?: string[]
          contribution_amount: number
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deletion_request_id?: string | null
          deposit_months?: number
          deposit_required?: boolean
          description?: string | null
          frequency?: Database["public"]["Enums"]["group_frequency"]
          id?: string
          late_penalty_after_days?: number
          late_penalty_percent?: number
          max_members: number
          name: string
          new_member_lock_last_third?: boolean
          paused_at?: string | null
          paused_by?: string | null
          paused_reason?: string | null
          rotation_order_kind?: Database["public"]["Enums"]["rotation_order"]
          status?: Database["public"]["Enums"]["group_status"]
          swap_policy?: Database["public"]["Enums"]["swap_policy"]
          total_paused_days?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          category?: string | null
          co_organizers?: string[]
          contribution_amount?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deletion_request_id?: string | null
          deposit_months?: number
          deposit_required?: boolean
          description?: string | null
          frequency?: Database["public"]["Enums"]["group_frequency"]
          id?: string
          late_penalty_after_days?: number
          late_penalty_percent?: number
          max_members?: number
          name?: string
          new_member_lock_last_third?: boolean
          paused_at?: string | null
          paused_by?: string | null
          paused_reason?: string | null
          rotation_order_kind?: Database["public"]["Enums"]["rotation_order"]
          status?: Database["public"]["Enums"]["group_status"]
          swap_policy?: Database["public"]["Enums"]["swap_policy"]
          total_paused_days?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
      kyc_documents: {
        Row: {
          country_code: string | null
          created_at: string
          doc_type: string
          document_number: string | null
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          target_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          doc_type: string
          document_number?: string | null
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          target_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          doc_type?: string
          document_number?: string | null
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          target_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_levels_config: {
        Row: {
          description: string | null
          label: string
          level: number
          max_contribution_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          label: string
          level: number
          max_contribution_amount: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          label?: string
          level?: number
          max_contribution_amount?: number
          updated_at?: string
          updated_by?: string | null
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
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "ledger_entries_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
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
            foreignKeyName: "ledger_entries_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "ledger_entries_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "ledger_entries_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
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
            referencedRelation: "admin_group_overview"
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
            referencedRelation: "admin_payment_overview"
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
            referencedRelation: "turn_assignment_audit"
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
      manual_reminders_log: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          group_id: string
          id: string
          message: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          group_id: string
          id?: string
          message?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          group_id?: string
          id?: string
          message?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_reminders_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_reminders_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_reminders_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      member_default_reports: {
        Row: {
          contribution_id: string | null
          created_at: string
          group_id: string
          id: string
          internal_notes: string | null
          reason: string | null
          reported_by: string
          reported_user_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          tontine_handler_id: string | null
          updated_at: string
        }
        Insert: {
          contribution_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          internal_notes?: string | null
          reason?: string | null
          reported_by: string
          reported_user_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          tontine_handler_id?: string | null
          updated_at?: string
        }
        Update: {
          contribution_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          internal_notes?: string | null
          reason?: string | null
          reported_by?: string
          reported_user_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          tontine_handler_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "member_default_reports_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "member_default_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_default_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_default_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      member_deposits: {
        Row: {
          amount: number
          created_at: string
          djomy_transaction_id: string | null
          forfeit_reason: string | null
          forfeited_at: string | null
          group_id: string
          id: string
          initiated_by: string
          months: number
          paid_at: string | null
          payer_phone: string | null
          payment_method: string | null
          redirect_url: string | null
          refund_reason: string | null
          refunded_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          djomy_transaction_id?: string | null
          forfeit_reason?: string | null
          forfeited_at?: string | null
          group_id: string
          id?: string
          initiated_by: string
          months: number
          paid_at?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          redirect_url?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          djomy_transaction_id?: string | null
          forfeit_reason?: string | null
          forfeited_at?: string | null
          group_id?: string
          id?: string
          initiated_by?: string
          months?: number
          paid_at?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          redirect_url?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_deposits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_deposits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_deposits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      member_reviews: {
        Row: {
          comment: string | null
          created_at: string
          cycle_id: string
          group_id: string
          id: string
          rating: number
          reviewed_user_id: string
          reviewer_user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          cycle_id: string
          group_id: string
          id?: string
          rating: number
          reviewed_user_id: string
          reviewer_user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          cycle_id?: string
          group_id?: string
          id?: string
          rating?: number
          reviewed_user_id?: string
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "member_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          notif_type: Database["public"]["Enums"]["notification_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          notif_type: Database["public"]["Enums"]["notification_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          notif_type?: Database["public"]["Enums"]["notification_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
      payment_links: {
        Row: {
          amount: number
          contribution_id: string | null
          created_at: string
          created_by: string
          djomy_reference: string
          djomy_url: string
          expires_at: string | null
          group_id: string
          id: string
          metadata: Json | null
          purpose: string
          status: string
          usage_type: string
        }
        Insert: {
          amount: number
          contribution_id?: string | null
          created_at?: string
          created_by: string
          djomy_reference: string
          djomy_url: string
          expires_at?: string | null
          group_id: string
          id?: string
          metadata?: Json | null
          purpose: string
          status?: string
          usage_type?: string
        }
        Update: {
          amount?: number
          contribution_id?: string | null
          created_at?: string
          created_by?: string
          djomy_reference?: string
          djomy_url?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          metadata?: Json | null
          purpose?: string
          status?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_links_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_pause_requests: {
        Row: {
          contribution_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          expires_at: string
          group_id: string
          id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          contribution_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          expires_at?: string
          group_id: string
          id?: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          contribution_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          expires_at?: string
          group_id?: string
          id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_pause_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payment_pause_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_pause_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_pause_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contribution_id: string
          djomy_link_reference: string | null
          djomy_transaction_id: string | null
          error_message: string | null
          group_id: string
          id: string
          initiated_at: string
          metadata: Json | null
          payer_phone: string | null
          payment_method: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          redirect_url: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          contribution_id: string
          djomy_link_reference?: string | null
          djomy_transaction_id?: string | null
          error_message?: string | null
          group_id: string
          id?: string
          initiated_at?: string
          metadata?: Json | null
          payer_phone?: string | null
          payment_method?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          redirect_url?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          contribution_id?: string
          djomy_link_reference?: string | null
          djomy_transaction_id?: string | null
          error_message?: string | null
          group_id?: string
          id?: string
          initiated_at?: string
          metadata?: Json | null
          payer_phone?: string | null
          payment_method?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          redirect_url?: string | null
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
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
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
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
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
      payout_hold_config: {
        Row: {
          frequency: Database["public"]["Enums"]["group_frequency"]
          penalty_extra_days: number
          standard_days: number
        }
        Insert: {
          frequency: Database["public"]["Enums"]["group_frequency"]
          penalty_extra_days?: number
          standard_days?: number
        }
        Update: {
          frequency?: Database["public"]["Enums"]["group_frequency"]
          penalty_extra_days?: number
          standard_days?: number
        }
        Relationships: []
      }
      phone_otp_challenges: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone_e164: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone_e164: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone_e164?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          full_name: string
          id: string
          kyc_level: number
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at: string | null
          phone_number: string | null
          phone_verified_at: string | null
          phone_visible_in_groups: boolean
          reliability_score: number
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          full_name: string
          id: string
          kyc_level?: number
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at?: string | null
          phone_number?: string | null
          phone_verified_at?: string | null
          phone_visible_in_groups?: boolean
          reliability_score?: number
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          full_name?: string
          id?: string
          kyc_level?: number
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at?: string | null
          phone_number?: string | null
          phone_verified_at?: string | null
          phone_visible_in_groups?: boolean
          reliability_score?: number
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
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
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
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
            referencedRelation: "admin_group_overview"
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
            referencedRelation: "admin_payment_overview"
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
            referencedRelation: "turn_assignment_audit"
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
      reminder_log: {
        Row: {
          bucket: string
          contribution_id: string
          created_at: string
          sent_on: string
        }
        Insert: {
          bucket: string
          contribution_id: string
          created_at?: string
          sent_on?: string
        }
        Update: {
          bucket?: string
          contribution_id?: string
          created_at?: string
          sent_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "reminder_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          body: string
          created_at: string
          error: string | null
          group_id: string | null
          id: string
          kind: string
          provider: string
          provider_cost: number | null
          provider_message_id: string | null
          recipient: string
          recipient_normalized: string | null
          status: string
          triggered_by: string | null
          turn_id: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          provider?: string
          provider_cost?: number | null
          provider_message_id?: string | null
          recipient: string
          recipient_normalized?: string | null
          status?: string
          triggered_by?: string | null
          turn_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          provider?: string
          provider_cost?: number | null
          provider_message_id?: string | null
          recipient?: string
          recipient_normalized?: string | null
          status?: string
          triggered_by?: string | null
          turn_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "sms_logs_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "sms_logs_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "sms_logs_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_alerts: {
        Row: {
          code: string
          contribution_id: string | null
          created_at: string
          group_id: string
          id: string
          message: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          turn_id: string | null
        }
        Insert: {
          code: string
          contribution_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          turn_id?: string | null
        }
        Update: {
          code?: string
          contribution_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_contributions_due"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "my_late_contributions"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "tontine_alerts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "tontine_alerts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_alerts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_alerts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_alerts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "tontine_alerts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "tontine_alerts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "tontine_alerts_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      turn_bids: {
        Row: {
          amount: number
          bidder_user_id: string
          created_at: string
          cycle_id: string
          group_id: string
          id: string
          status: Database["public"]["Enums"]["bid_status"]
          turn_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bidder_user_id: string
          created_at?: string
          cycle_id: string
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["bid_status"]
          turn_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bidder_user_id?: string
          created_at?: string
          cycle_id?: string
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["bid_status"]
          turn_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turn_bids_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "turn_bids_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
      turn_swap_requests: {
        Row: {
          created_at: string
          from_turn_id: string
          from_user_id: string
          group_id: string
          id: string
          reason: string | null
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["swap_status"]
          to_turn_id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_turn_id: string
          from_user_id: string
          group_id: string
          id?: string
          reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          to_turn_id: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_turn_id?: string
          from_user_id?: string
          group_id?: string
          id?: string
          reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          to_turn_id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
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
          payout_hold_until: string | null
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
          payout_hold_until?: string | null
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
          payout_hold_until?: string | null
          payout_reference?: string | null
          status?: Database["public"]["Enums"]["turn_status"]
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "turns_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
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
            referencedRelation: "admin_group_overview"
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
      user_call_presence: {
        Row: {
          status: Database["public"]["Enums"]["call_presence_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          status?: Database["public"]["Enums"]["call_presence_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: Database["public"]["Enums"]["call_presence_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_call_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_call_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reliability_scores: {
        Row: {
          avg_delay_days: number
          avg_rating: number
          cycles_completed: number
          last_computed_at: string
          reviews_count: number
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
          avg_rating?: number
          cycles_completed?: number
          last_computed_at?: string
          reviews_count?: number
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
          avg_rating?: number
          cycles_completed?: number
          last_computed_at?: string
          reviews_count?: number
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
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          destination: string | null
          djomy_payout_ref: string | null
          group_id: string
          id: string
          method: Database["public"]["Enums"]["withdrawal_method"]
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          destination?: string | null
          djomy_payout_ref?: string | null
          group_id: string
          id?: string
          method: Database["public"]["Enums"]["withdrawal_method"]
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          destination?: string | null
          djomy_payout_ref?: string | null
          group_id?: string
          id?: string
          method?: Database["public"]["Enums"]["withdrawal_method"]
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_group_overview: {
        Row: {
          archived_at: string | null
          contribution_amount: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          frequency: string | null
          id: string | null
          max_members: number | null
          members_count: number | null
          name: string | null
          organizer_name: string | null
          paused_at: string | null
          status: string | null
          volume_total: number | null
        }
        Insert: {
          archived_at?: string | null
          contribution_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          frequency?: never
          id?: string | null
          max_members?: number | null
          members_count?: never
          name?: string | null
          organizer_name?: never
          paused_at?: string | null
          status?: never
          volume_total?: never
        }
        Update: {
          archived_at?: string | null
          contribution_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          frequency?: never
          id?: string | null
          max_members?: number | null
          members_count?: never
          name?: string | null
          organizer_name?: never
          paused_at?: string | null
          status?: never
          volume_total?: never
        }
        Relationships: []
      }
      admin_payment_overview: {
        Row: {
          amount: number | null
          djomy_transaction_id: string | null
          error_message: string | null
          group_id: string | null
          group_name: string | null
          id: string | null
          initiated_at: string | null
          payer_name: string | null
          payment_method: string | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          settled_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          djomy_transaction_id?: string | null
          error_message?: string | null
          group_id?: string | null
          group_name?: never
          id?: string | null
          initiated_at?: string | null
          payer_name?: never
          payment_method?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          settled_at?: string | null
          status?: never
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          djomy_transaction_id?: string | null
          error_message?: string | null
          group_id?: string | null
          group_name?: never
          id?: string | null
          initiated_at?: string | null
          payer_name?: never
          payment_method?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          settled_at?: string | null
          status?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
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
      admin_platform_kpis: {
        Row: {
          cycles_open: number | null
          deletion_requests_open: number | null
          groups_active: number | null
          groups_total: number | null
          payment_failures_7d: number | null
          reliability_avg: number | null
          users_new_7d: number | null
          users_total: number | null
          volume_30d: number | null
        }
        Relationships: []
      }
      admin_user_overview: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          full_name: string | null
          groups_count: number | null
          id: string | null
          phone_number: string | null
          reliability_score: number | null
          roles: string[] | null
          suspended_at: string | null
        }
        Relationships: []
      }
      audit_log_view: {
        Row: {
          action: string | null
          actor_name: string | null
          actor_user_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          group_id: string | null
          id: string | null
          metadata: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_open_turn_check: {
        Row: {
          cycle_id: string | null
          cycle_number: number | null
          group_id: string | null
          open_turns: number | null
          paid_turns: number | null
          upcoming_turns: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
      deletion_requests_admin_view: {
        Row: {
          active_members: number | null
          admin_decision_at: string | null
          admin_decision_by: string | null
          admin_decision_reason: string | null
          contribution_amount: number | null
          created_at: string | null
          frequency: Database["public"]["Enums"]["group_frequency"] | null
          group_id: string | null
          group_name: string | null
          id: string | null
          max_members: number | null
          members_deadline: string | null
          no_votes: number | null
          reason: string | null
          requested_by: string | null
          requester_name: string | null
          status: Database["public"]["Enums"]["deletion_request_status"] | null
          yes_votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_deletion_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deletion_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deletion_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admin_permissions_view: {
        Row: {
          can_approve_members: boolean | null
          can_confirm_payments: boolean | null
          can_edit_settings: boolean | null
          can_kick_member: boolean | null
          can_manage_invitations: boolean | null
          can_pause_cycle: boolean | null
          can_send_announcements: boolean | null
          can_suspend_member: boolean | null
          can_waive_penalty: boolean | null
          full_name: string | null
          granted_at: string | null
          granted_by: string | null
          group_id: string | null
          phone_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_admin_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_admin_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_admin_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      group_defaulters: {
        Row: {
          amount: number | null
          contribution_id: string | null
          default_days: number | null
          defaulted_at: string | null
          due_date: string | null
          group_id: string | null
          has_open_report: boolean | null
          payer_name: string | null
          payer_user_id: string | null
          turn_id: string | null
          turn_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
            referencedRelation: "admin_group_overview"
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
            referencedRelation: "admin_payment_overview"
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
            referencedRelation: "turn_assignment_audit"
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
      group_members_safe_view: {
        Row: {
          can_bid: boolean | null
          can_chat: boolean | null
          can_invite: boolean | null
          can_swap: boolean | null
          full_name: string | null
          group_id: string | null
          id: string | null
          joined_at: string | null
          phone_number: string | null
          position: number | null
          role: Database["public"]["Enums"]["member_role"] | null
          status: Database["public"]["Enums"]["member_status"] | null
          suspended_at: string | null
          suspended_reason: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_user_overview"
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
      group_payments_history: {
        Row: {
          amount: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          contribution_id: string | null
          contribution_status:
            | Database["public"]["Enums"]["contribution_status"]
            | null
          due_date: string | null
          group_id: string | null
          payer_name: string | null
          payer_user_id: string | null
          penalty_amount: number | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          reference: string | null
          turn_id: string | null
          turn_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
      group_reliability: {
        Row: {
          avg_rating: number | null
          full_name: string | null
          group_id: string | null
          reviews_count: number | null
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_user_overview"
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
      kyc_admin_queue: {
        Row: {
          country_code: string | null
          created_at: string | null
          current_level: number | null
          doc_type: string | null
          document_id: string | null
          document_number: string | null
          full_name: string | null
          phone_number: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          storage_path: string | null
          target_level: number | null
          user_id: string | null
        }
        Relationships: []
      }
      member_review_global: {
        Row: {
          avg_rating: number | null
          reviews_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      member_review_summary: {
        Row: {
          avg_rating: number | null
          group_id: string | null
          reviews_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      my_balances: {
        Row: {
          available_amount: number | null
          group_id: string | null
          group_name: string | null
          id: string | null
          total_credited: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_balances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_balances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_balances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
            referencedRelation: "group_defaulters"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "group_payments_history"
            referencedColumns: ["contribution_id"]
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
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "pending_reminders_view"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["contribution_id"]
          },
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
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
            referencedRelation: "admin_group_overview"
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
            referencedRelation: "turn_assignment_audit"
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
          avg_rating: number | null
          cycles_completed: number | null
          last_computed_at: string | null
          reviews_count: number | null
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
          avg_rating?: number | null
          cycles_completed?: number | null
          last_computed_at?: string | null
          reviews_count?: number | null
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
          avg_rating?: number | null
          cycles_completed?: number | null
          last_computed_at?: string | null
          reviews_count?: number | null
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
      my_reviews_given: {
        Row: {
          comment: string | null
          created_at: string | null
          cycle_id: string | null
          group_id: string | null
          id: string | null
          rating: number | null
          reviewed_user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          cycle_id?: string | null
          group_id?: string | null
          id?: string | null
          rating?: number | null
          reviewed_user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          cycle_id?: string | null
          group_id?: string | null
          id?: string | null
          rating?: number | null
          reviewed_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "member_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
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
            referencedRelation: "admin_group_overview"
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
      pending_reminders_view: {
        Row: {
          amount: number | null
          bucket: string | null
          contribution_id: string | null
          days_late: number | null
          due_date: string | null
          expected_penalty: number | null
          group_id: string | null
          group_name: string | null
          late_penalty_after_days: number | null
          late_penalty_percent: number | null
          payer_user_id: string | null
          turn_id: string | null
          turn_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "turn_assignment_audit"
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
      turn_assignment_audit: {
        Row: {
          amount: number | null
          beneficiary_name: string | null
          beneficiary_user_id: string | null
          confirmed_at: string | null
          contribution_id: string | null
          contribution_status:
            | Database["public"]["Enums"]["contribution_status"]
            | null
          cycle_id: string | null
          cycle_number: number | null
          due_date: string | null
          flag_payer_is_beneficiary: boolean | null
          flag_payer_not_active: boolean | null
          group_id: string | null
          group_name: string | null
          paid_at: string | null
          payer_name: string | null
          payer_user_id: string | null
          turn_id: string | null
          turn_number: number | null
          turn_status: Database["public"]["Enums"]["turn_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "turns_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
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
            referencedRelation: "admin_group_overview"
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
      turn_bids_view: {
        Row: {
          amount: number | null
          bidder_name: string | null
          bidder_user_id: string | null
          created_at: string | null
          cycle_id: string | null
          due_date: string | null
          group_id: string | null
          id: string | null
          status: Database["public"]["Enums"]["bid_status"] | null
          turn_id: string | null
          turn_number: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turn_bids_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "turn_bids_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_bids_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
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
            referencedRelation: "cycle_open_turn_check"
            referencedColumns: ["cycle_id"]
          },
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
            referencedRelation: "admin_group_overview"
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
      turn_swap_requests_view: {
        Row: {
          created_at: string | null
          from_due_date: string | null
          from_turn_id: string | null
          from_turn_number: number | null
          from_user_id: string | null
          from_user_name: string | null
          group_id: string | null
          id: string | null
          reason: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["swap_status"] | null
          to_due_date: string | null
          to_turn_id: string | null
          to_turn_number: number | null
          to_user_id: string | null
          to_user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_group_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "my_groups_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "next_turn_per_group"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_assignment_audit"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "turn_settlement"
            referencedColumns: ["turn_id"]
          },
          {
            foreignKeyName: "turn_swap_requests_to_turn_id_fkey"
            columns: ["to_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _audit_confirm_test_user: { Args: { _email: string }; Returns: undefined }
      _generate_invite_code: { Args: never; Returns: string }
      adjust_penalty: {
        Args: {
          _contribution_id: string
          _new_amount: number
          _reason?: string
        }
        Returns: undefined
      }
      admin_complete_dispute_export: {
        Args: {
          _error?: string
          _expires_at?: string
          _id: string
          _pdf_path?: string
          _sha256?: string
          _signed_url?: string
          _status: string
        }
        Returns: undefined
      }
      admin_decide_deletion: {
        Args: { _approve: boolean; _reason?: string; _request_id: string }
        Returns: undefined
      }
      admin_force_deposit_status: {
        Args: { _deposit_id: string; _new_status: string; _reason: string }
        Returns: undefined
      }
      admin_force_group_status: {
        Args: { _action: string; _group_id: string; _reason?: string }
        Returns: undefined
      }
      admin_forfeit_member_deposit: {
        Args: { _deposit_id: string; _reason: string }
        Returns: undefined
      }
      admin_list_deposits: {
        Args: { _group_id?: string; _limit?: number; _status?: string }
        Returns: {
          amount: number
          created_at: string
          deposit_id: string
          djomy_transaction_id: string
          group_id: string
          group_name: string
          member_deposit_status: string
          months: number
          paid_at: string
          payment_method: string
          status: string
          updated_at: string
          user_full_name: string
          user_id: string
          user_phone: string
        }[]
      }
      admin_publish_contract_template: {
        Args: { _body_md: string; _version: string }
        Returns: string
      }
      admin_refund_member_deposit: {
        Args: { _deposit_id: string; _reason?: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      admin_suspend_user: {
        Args: { _reason?: string; _suspend: boolean; _target_user: string }
        Returns: undefined
      }
      admin_validate_kyc: {
        Args: { _approve: boolean; _document_id: string; _note?: string }
        Returns: undefined
      }
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
      apply_deposit_webhook: {
        Args: {
          _deposit_id: string
          _new_status: string
          _payment_method?: string
          _provider_ref?: string
        }
        Returns: undefined
      }
      apply_djomy_webhook: {
        Args: {
          _new_status: string
          _paid_amount: number
          _payment_id: string
          _payment_method: string
          _provider_ref: string
        }
        Returns: undefined
      }
      approve_member: { Args: { _member_id: string }; Returns: undefined }
      archive_group: {
        Args: { _group_id: string; _reason?: string }
        Returns: undefined
      }
      attach_deposit_djomy_reference: {
        Args: {
          _deposit_id: string
          _redirect_url: string
          _transaction_id: string
        }
        Returns: undefined
      }
      attach_djomy_reference: {
        Args: {
          _payment_id: string
          _redirect_url: string
          _transaction_id: string
        }
        Returns: undefined
      }
      auto_close_turn: { Args: { _turn_id: string }; Returns: boolean }
      cancel_my_bid: { Args: { _turn_id: string }; Returns: undefined }
      cancel_turn_swap: { Args: { _request_id: string }; Returns: undefined }
      close_auction: { Args: { _turn_id: string }; Returns: string }
      compute_hold_until: { Args: { _turn_id: string }; Returns: string }
      confirm_external_payment: {
        Args: { _proof_id: string }
        Returns: undefined
      }
      create_group_with_invitation: { Args: { _payload: Json }; Returns: Json }
      decide_payment_pause_request: {
        Args: { _approve: boolean; _reason?: string; _request_id: string }
        Returns: undefined
      }
      delete_account: { Args: { _reason?: string }; Returns: undefined }
      enqueue_payment_reminders: { Args: never; Returns: number }
      enqueue_tontine_sms: {
        Args: { _kind: string; _payload: Json }
        Returns: undefined
      }
      explain_contribution: {
        Args: { _contribution_id: string }
        Returns: Json
      }
      finalize_deletion_votes: { Args: never; Returns: number }
      frequency_to_days: {
        Args: { _freq: Database["public"]["Enums"]["group_frequency"] }
        Returns: number
      }
      get_active_contract: {
        Args: { _group_id: string }
        Returns: {
          body_md: string
          contract_id: string
          group_id: string
          is_default: boolean
          published_at: string
          version: string
        }[]
      }
      get_default_report_audit: {
        Args: { _report_id: string }
        Returns: {
          action: string
          actor_name: string
          actor_role: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
        }[]
      }
      get_member_position_info: {
        Args: { _group_id: string; _user_id?: string }
        Returns: {
          deposit_required: boolean
          deposit_status: string
          is_in_last_third: boolean
          joined_after_start: boolean
          last_third_start: number
          lock_reason: string
          max_members: number
          member_position: number
          total_active: number
          user_id: string
          withdrawal_locked: boolean
        }[]
      }
      get_user_default_history: {
        Args: { _user_id?: string }
        Returns: {
          amount: number
          contribution_id: string
          default_days: number
          defaulted_at: string
          dispute_status: string
          due_date: string
          group_id: string
          group_name: string
          notifications_count: number
          paid_at: string
          penalty_amount: number
          report_status: string
          status: Database["public"]["Enums"]["contribution_status"]
          turn_number: number
        }[]
      }
      give_call_recording_consent: {
        Args: { p_call_id: string }
        Returns: undefined
      }
      grant_admin_permissions: {
        Args: { _group_id: string; _perms: Json; _user_id: string }
        Returns: undefined
      }
      group_edit_window: { Args: { _group_id: string }; Returns: string }
      group_is_started: { Args: { _group_id: string }; Returns: boolean }
      has_admin_permission: {
        Args: { _group: string; _perm: string; _user: string }
        Returns: boolean
      }
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
      is_group_owner: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_participant: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_rpc_context: { Args: never; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      join_call: { Args: { p_call_id: string }; Returns: undefined }
      join_group_with_code: {
        Args: {
          _accepted_terms_version?: string
          _code: string
          _message?: string
          _operator?: string
        }
        Returns: string
      }
      kick_member: {
        Args: { _member_id: string; _reason?: string }
        Returns: undefined
      }
      leave_call: { Args: { p_call_id: string }; Returns: undefined }
      list_group_disputes: {
        Args: { _group_id: string }
        Returns: {
          amount: number
          contribution_id: string
          created_at: string
          due_date: string
          evidence_url: string
          id: string
          organizer_response: string
          raised_by: string
          raised_by_name: string
          reason: string
          resolved_at: string
          status: string
          turn_number: number
        }[]
      }
      log_audit: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type?: string
          _group_id: string
          _metadata?: Json
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_defaulted_contributions: { Args: never; Returns: number }
      mark_group_read: { Args: { p_group_id: string }; Returns: undefined }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      mark_phone_verified: { Args: never; Returns: number }
      mask_phone: { Args: { _phone: string }; Returns: string }
      member_can: {
        Args: { _flag: string; _group: string; _user: string }
        Returns: boolean
      }
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
      open_next_turn: { Args: { _cycle_id: string }; Returns: string }
      pause_cycle: {
        Args: { _group_id: string; _reason?: string }
        Returns: undefined
      }
      place_bid: {
        Args: { _amount: number; _turn_id: string }
        Returns: string
      }
      preview_group_by_code: { Args: { _code: string }; Returns: Json }
      purge_audit_log: { Args: never; Returns: number }
      raise_contribution_dispute: {
        Args: {
          _contribution_id: string
          _evidence_url?: string
          _reason: string
        }
        Returns: string
      }
      reactivate_member: { Args: { _member_id: string }; Returns: undefined }
      recompute_reliability: {
        Args: { _user_id?: string }
        Returns: {
          avg_delay_days: number
          avg_rating: number
          cycles_completed: number
          last_computed_at: string
          reviews_count: number
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
      reject_external_payment: {
        Args: { _proof_id: string; _reason?: string }
        Returns: undefined
      }
      reject_member: { Args: { _member_id: string }; Returns: undefined }
      release_payout: {
        Args: {
          _provider?: Database["public"]["Enums"]["payment_provider"]
          _turn_id: string
        }
        Returns: string
      }
      report_defaulter: {
        Args: { _contribution_id: string; _reason?: string }
        Returns: string
      }
      request_dispute_export: {
        Args: { _group_id: string; _member_id: string; _reason: string }
        Returns: string
      }
      request_group_call: {
        Args: { p_group_id: string; p_scheduled_at: string; p_topic: string }
        Returns: string
      }
      request_group_deletion: {
        Args: { _group_id: string; _reason: string }
        Returns: string
      }
      request_payment_during_pause: {
        Args: { _contribution_id: string }
        Returns: string
      }
      request_turn_swap: {
        Args: { _from_turn: string; _reason?: string; _to_turn: string }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          _amount: number
          _destination?: string
          _group_id: string
          _method: Database["public"]["Enums"]["withdrawal_method"]
        }
        Returns: string
      }
      resolve_contribution_dispute: {
        Args: { _dispute_id: string; _response?: string; _status: string }
        Returns: undefined
      }
      resolve_tontine_alert: { Args: { _alert_id: string }; Returns: undefined }
      respond_call_request: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["call_request_status"]
        }
        Returns: undefined
      }
      respond_turn_swap: {
        Args: { _accept: boolean; _request_id: string }
        Returns: undefined
      }
      resume_cycle: { Args: { _group_id: string }; Returns: number }
      revoke_admin_permissions: {
        Args: { _group_id: string; _user_id: string }
        Returns: undefined
      }
      seed_notification_preferences: {
        Args: { _user_id: string }
        Returns: undefined
      }
      send_manual_reminder: {
        Args: {
          _channel: Database["public"]["Enums"]["reminder_channel"]
          _member_id: string
          _message?: string
        }
        Returns: string
      }
      set_call_mute: {
        Args: { p_call_id: string; p_muted: boolean }
        Returns: undefined
      }
      set_call_recording: {
        Args: {
          p_call_id: string
          p_duration: number
          p_size: number
          p_url: string
        }
        Returns: undefined
      }
      set_member_permissions: {
        Args: { _member_id: string; _perms: Json }
        Returns: undefined
      }
      shares_group_with: {
        Args: { _me: string; _other: string }
        Returns: boolean
      }
      shift_due_date: {
        Args: { _new_date: string; _reason?: string; _turn_id: string }
        Returns: undefined
      }
      should_notify: {
        Args: {
          _channel: Database["public"]["Enums"]["notification_channel"]
          _type: Database["public"]["Enums"]["notification_kind"]
          _user_id: string
        }
        Returns: boolean
      }
      sign_contract: {
        Args: {
          _group_id: string
          _hash_sha256: string
          _ip?: string
          _otp_challenge_id: string
          _user_agent?: string
        }
        Returns: string
      }
      start_cycle: { Args: { _group_id: string }; Returns: string }
      start_djomy_payment: {
        Args: {
          _contribution_id: string
          _method?: string
          _payer_phone?: string
        }
        Returns: string
      }
      start_member_deposit: {
        Args: { _group_id: string; _payer_phone?: string }
        Returns: Json
      }
      submit_external_payment: {
        Args: {
          _amount: number
          _contribution_id: string
          _method: Database["public"]["Enums"]["payment_method_external"]
          _note?: string
          _proof_url?: string
          _reference?: string
        }
        Returns: string
      }
      submit_kyc_document: {
        Args: {
          _country_code?: string
          _doc_type: string
          _document_number?: string
          _storage_path: string
        }
        Returns: string
      }
      submit_review: {
        Args: {
          _comment?: string
          _group_id: string
          _rating: number
          _reviewed_user_id: string
        }
        Returns: string
      }
      suspend_member: {
        Args: { _member_id: string; _reason?: string }
        Returns: undefined
      }
      transfer_ownership: {
        Args: { _group_id: string; _new_owner_user_id: string }
        Returns: undefined
      }
      update_defaulter_report:
        | {
            Args: {
              _internal_notes?: string
              _report_id: string
              _resolution_note?: string
              _status?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _internal_notes?: string
              _note_only?: boolean
              _report_id: string
              _resolution_note?: string
              _status?: string
            }
            Returns: undefined
          }
      update_group_settings: {
        Args: { _group_id: string; _payload: Json }
        Returns: undefined
      }
      update_notification_preferences: {
        Args: { _payload: Json }
        Returns: number
      }
      update_phone_visibility: {
        Args: { _visible: boolean }
        Returns: undefined
      }
      vote_group_deletion: {
        Args: {
          _request_id: string
          _vote: Database["public"]["Enums"]["deletion_vote_choice"]
        }
        Returns: undefined
      }
      waive_penalty: {
        Args: { _contribution_id: string; _reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "organisateur" | "participant" | "super_admin"
      bid_status: "active" | "won" | "lost" | "cancelled"
      call_presence_status: "available" | "busy" | "dnd"
      call_request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
        | "missed"
        | "ended"
      contribution_status:
        | "pending"
        | "submitted"
        | "confirmed"
        | "rejected"
        | "defaulted"
      deletion_request_status:
        | "pending_members"
        | "pending_admin"
        | "approved"
        | "rejected"
        | "cancelled"
      deletion_vote_choice: "yes" | "no"
      external_proof_status: "pending" | "confirmed" | "rejected"
      group_frequency:
        | "hebdomadaire"
        | "quinzaine"
        | "mensuelle"
        | "quotidienne"
      group_status:
        | "draft"
        | "open"
        | "active"
        | "completed"
        | "cancelled"
        | "paused"
      group_visibility: "private" | "public-link" | "directory"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      kyc_status: "none" | "pending" | "verified" | "rejected"
      ledger_entry_type:
        | "contribution_in"
        | "payout_out"
        | "fee"
        | "refund"
        | "penalty"
        | "adjustment"
      member_role: "organisateur" | "membre"
      member_status:
        | "active"
        | "invited"
        | "removed"
        | "left"
        | "pending"
        | "suspended"
      notification_channel: "in_app" | "email" | "sms"
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
        | "announcement"
        | "swap_requested"
        | "swap_responded"
        | "swap_executed"
        | "auction_outbid"
        | "auction_won"
        | "auction_lost"
        | "auction_closed"
        | "review_received"
        | "member_suspended"
        | "member_reactivated"
        | "member_kicked"
        | "permissions_changed"
        | "ownership_transferred"
        | "payment_confirmed_by_admin"
        | "payment_rejected_by_admin"
        | "external_payment_submitted"
        | "penalty_waived"
        | "penalty_adjusted"
        | "cycle_paused"
        | "cycle_resumed"
        | "due_date_shifted"
        | "group_archived"
        | "manual_reminder"
        | "account_deleted"
        | "phone_visibility_changed"
        | "group_deletion_requested"
        | "group_deletion_vote_recorded"
        | "group_deletion_rejected_by_member"
        | "group_deletion_pending_admin"
        | "group_deletion_approved"
        | "group_deletion_refused"
        | "contribution_defaulted"
        | "defaulter_reported"
        | "defaulter_report_resolved"
        | "dispute_raised"
        | "dispute_resolved"
        | "payment_pause_request_created"
        | "payment_pause_request_approved"
        | "payment_pause_request_rejected"
        | "cycle_completed"
        | "deposit_status"
        | "payout_hold_extended"
      payment_method_external:
        | "cash"
        | "bank_transfer"
        | "om_external"
        | "mtn_external"
        | "other"
      payment_provider:
        | "orange_money"
        | "mtn_money"
        | "cash"
        | "simulation"
        | "djomy"
      payment_status:
        | "initiated"
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
      reliability_tier:
        | "nouveau"
        | "risque"
        | "moyen"
        | "bon"
        | "excellent"
        | "blocked"
      reminder_channel: "in_app" | "sms" | "whatsapp" | "email"
      rotation_order: "random" | "fixed" | "choice" | "auction"
      swap_policy: "none" | "with_consent" | "organizer_only"
      swap_status: "pending" | "accepted" | "rejected" | "cancelled"
      turn_status: "upcoming" | "collecting" | "paid" | "skipped"
      withdrawal_method: "OM" | "MOMO" | "CARD" | "BANK" | "CASH"
      withdrawal_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
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
      app_role: ["admin", "organisateur", "participant", "super_admin"],
      bid_status: ["active", "won", "lost", "cancelled"],
      call_presence_status: ["available", "busy", "dnd"],
      call_request_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "missed",
        "ended",
      ],
      contribution_status: [
        "pending",
        "submitted",
        "confirmed",
        "rejected",
        "defaulted",
      ],
      deletion_request_status: [
        "pending_members",
        "pending_admin",
        "approved",
        "rejected",
        "cancelled",
      ],
      deletion_vote_choice: ["yes", "no"],
      external_proof_status: ["pending", "confirmed", "rejected"],
      group_frequency: [
        "hebdomadaire",
        "quinzaine",
        "mensuelle",
        "quotidienne",
      ],
      group_status: [
        "draft",
        "open",
        "active",
        "completed",
        "cancelled",
        "paused",
      ],
      group_visibility: ["private", "public-link", "directory"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      kyc_status: ["none", "pending", "verified", "rejected"],
      ledger_entry_type: [
        "contribution_in",
        "payout_out",
        "fee",
        "refund",
        "penalty",
        "adjustment",
      ],
      member_role: ["organisateur", "membre"],
      member_status: [
        "active",
        "invited",
        "removed",
        "left",
        "pending",
        "suspended",
      ],
      notification_channel: ["in_app", "email", "sms"],
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
        "announcement",
        "swap_requested",
        "swap_responded",
        "swap_executed",
        "auction_outbid",
        "auction_won",
        "auction_lost",
        "auction_closed",
        "review_received",
        "member_suspended",
        "member_reactivated",
        "member_kicked",
        "permissions_changed",
        "ownership_transferred",
        "payment_confirmed_by_admin",
        "payment_rejected_by_admin",
        "external_payment_submitted",
        "penalty_waived",
        "penalty_adjusted",
        "cycle_paused",
        "cycle_resumed",
        "due_date_shifted",
        "group_archived",
        "manual_reminder",
        "account_deleted",
        "phone_visibility_changed",
        "group_deletion_requested",
        "group_deletion_vote_recorded",
        "group_deletion_rejected_by_member",
        "group_deletion_pending_admin",
        "group_deletion_approved",
        "group_deletion_refused",
        "contribution_defaulted",
        "defaulter_reported",
        "defaulter_report_resolved",
        "dispute_raised",
        "dispute_resolved",
        "payment_pause_request_created",
        "payment_pause_request_approved",
        "payment_pause_request_rejected",
        "cycle_completed",
        "deposit_status",
        "payout_hold_extended",
      ],
      payment_method_external: [
        "cash",
        "bank_transfer",
        "om_external",
        "mtn_external",
        "other",
      ],
      payment_provider: [
        "orange_money",
        "mtn_money",
        "cash",
        "simulation",
        "djomy",
      ],
      payment_status: [
        "initiated",
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ],
      reliability_tier: [
        "nouveau",
        "risque",
        "moyen",
        "bon",
        "excellent",
        "blocked",
      ],
      reminder_channel: ["in_app", "sms", "whatsapp", "email"],
      rotation_order: ["random", "fixed", "choice", "auction"],
      swap_policy: ["none", "with_consent", "organizer_only"],
      swap_status: ["pending", "accepted", "rejected", "cancelled"],
      turn_status: ["upcoming", "collecting", "paid", "skipped"],
      withdrawal_method: ["OM", "MOMO", "CARD", "BANK", "CASH"],
      withdrawal_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
