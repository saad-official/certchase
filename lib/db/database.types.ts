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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          actor: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          model: string | null
          org_id: string
          output: Json | null
          prompt_version: string | null
          tokens_in: number | null
          tokens_out: number | null
          type: string
        }
        Insert: {
          actor: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          org_id: string
          output?: Json | null
          prompt_version?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          type: string
        }
        Update: {
          actor?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          org_id?: string
          output?: Json | null
          prompt_version?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          created_at: string
          earliest_expiration: string | null
          evaluation: Json | null
          extraction: Json | null
          extraction_meta: Json | null
          file_name: string
          id: string
          mime_type: string
          needs_review: boolean
          org_id: string
          reviewed_at: string | null
          size_bytes: number
          source: string
          status: Database["public"]["Enums"]["certificate_status"]
          storage_path: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          earliest_expiration?: string | null
          evaluation?: Json | null
          extraction?: Json | null
          extraction_meta?: Json | null
          file_name: string
          id?: string
          mime_type: string
          needs_review?: boolean
          org_id: string
          reviewed_at?: string | null
          size_bytes: number
          source?: string
          status?: Database["public"]["Enums"]["certificate_status"]
          storage_path: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          earliest_expiration?: string | null
          evaluation?: Json | null
          extraction?: Json | null
          extraction_meta?: Json | null
          file_name?: string
          id?: string
          mime_type?: string
          needs_review?: boolean
          org_id?: string
          reviewed_at?: string | null
          size_bytes?: number
          source?: string
          status?: Database["public"]["Enums"]["certificate_status"]
          storage_path?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_vendor_id_org_id_fkey"
            columns: ["vendor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "vendor_overview"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "certificates_vendor_id_org_id_fkey"
            columns: ["vendor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      chase_cadences: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["chase_kind"]
          next_run_at: string | null
          org_id: string
          pause_reason: string | null
          status: Database["public"]["Enums"]["cadence_status"]
          step: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["chase_kind"]
          next_run_at?: string | null
          org_id: string
          pause_reason?: string | null
          status?: Database["public"]["Enums"]["cadence_status"]
          step?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["chase_kind"]
          next_run_at?: string | null
          org_id?: string
          pause_reason?: string | null
          status?: Database["public"]["Enums"]["cadence_status"]
          step?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chase_cadences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chase_cadences_vendor_id_org_id_fkey"
            columns: ["vendor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "vendor_overview"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "chase_cadences_vendor_id_org_id_fkey"
            columns: ["vendor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      chase_touches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          certificate_id: string | null
          confidence: number
          created_at: string
          gaps: Json
          id: string
          kind: Database["public"]["Enums"]["chase_kind"]
          org_id: string
          provider_message_id: string | null
          rationale: string | null
          reject_reason: string | null
          sent_at: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["touch_status"]
          subject: string
          to_email: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          certificate_id?: string | null
          confidence?: number
          created_at?: string
          gaps?: Json
          id?: string
          kind: Database["public"]["Enums"]["chase_kind"]
          org_id: string
          provider_message_id?: string | null
          rationale?: string | null
          reject_reason?: string | null
          sent_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["touch_status"]
          subject: string
          to_email: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          certificate_id?: string | null
          confidence?: number
          created_at?: string
          gaps?: Json
          id?: string
          kind?: Database["public"]["Enums"]["chase_kind"]
          org_id?: string
          provider_message_id?: string | null
          rationale?: string | null
          reject_reason?: string | null
          sent_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["touch_status"]
          subject?: string
          to_email?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chase_touches_certificate_id_org_id_fkey"
            columns: ["certificate_id", "org_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "chase_touches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chase_touches_vendor_id_org_id_fkey"
            columns: ["vendor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "vendor_overview"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "chase_touches_vendor_id_org_id_fkey"
            columns: ["vendor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          autonomy: Database["public"]["Enums"]["autonomy"]
          created_at: string
          id: string
          legal_name: string | null
          name: string
          plan: Database["public"]["Enums"]["plan"]
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string
          updated_at: string
          voice: Json
        }
        Insert: {
          autonomy?: Database["public"]["Enums"]["autonomy"]
          created_at?: string
          id?: string
          legal_name?: string | null
          name: string
          plan?: Database["public"]["Enums"]["plan"]
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          updated_at?: string
          voice?: Json
        }
        Update: {
          autonomy?: Database["public"]["Enums"]["autonomy"]
          created_at?: string
          id?: string
          legal_name?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["plan"]
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          updated_at?: string
          voice?: Json
        }
        Relationships: []
      }
      outbox: {
        Row: {
          created_at: string
          html: string | null
          id: string
          org_id: string
          provider: string
          status: string
          subject: string
          text: string
          to_email: string
          touch_id: string
        }
        Insert: {
          created_at?: string
          html?: string | null
          id?: string
          org_id: string
          provider?: string
          status?: string
          subject: string
          text: string
          to_email: string
          touch_id: string
        }
        Update: {
          created_at?: string
          html?: string | null
          id?: string
          org_id?: string
          provider?: string
          status?: string
          subject?: string
          text?: string
          to_email?: string
          touch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_touch_id_org_id_fkey"
            columns: ["touch_id", "org_id"]
            isOneToOne: false
            referencedRelation: "chase_touches"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      requirement_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          rules: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          broker_email: string | null
          broker_name: string | null
          contact_email: string
          contract_value_cents: number
          created_at: string
          do_not_contact: boolean
          id: string
          name: string
          notes: string | null
          org_id: string
          template_id: string
          trade: string | null
          updated_at: string
        }
        Insert: {
          broker_email?: string | null
          broker_name?: string | null
          contact_email: string
          contract_value_cents?: number
          created_at?: string
          do_not_contact?: boolean
          id?: string
          name: string
          notes?: string | null
          org_id: string
          template_id: string
          trade?: string | null
          updated_at?: string
        }
        Update: {
          broker_email?: string | null
          broker_name?: string | null
          contact_email?: string
          contract_value_cents?: number
          created_at?: string
          do_not_contact?: boolean
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          template_id?: string
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_template_id_org_id_fkey"
            columns: ["template_id", "org_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
    }
    Views: {
      vendor_overview: {
        Row: {
          broker_email: string | null
          broker_name: string | null
          cadence_id: string | null
          cadence_kind: Database["public"]["Enums"]["chase_kind"] | null
          cadence_status: Database["public"]["Enums"]["cadence_status"] | null
          cadence_step: number | null
          certificate_created_at: string | null
          certificate_status:
            | Database["public"]["Enums"]["certificate_status"]
            | null
          contact_email: string | null
          contract_value_cents: number | null
          created_at: string | null
          do_not_contact: boolean | null
          earliest_expiration: string | null
          evaluation_status:
            | Database["public"]["Enums"]["evaluation_status"]
            | null
          id: string | null
          latest_certificate_id: string | null
          name: string | null
          needs_review: boolean | null
          next_run_at: string | null
          notes: string | null
          org_id: string | null
          template_id: string | null
          template_name: string | null
          trade: string | null
          updated_at: string | null
          vendor_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_template_id_org_id_fkey"
            columns: ["template_id", "org_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
    }
    Functions: {
      current_org_ids: { Args: never; Returns: string[] }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_org_owner: { Args: { org: string }; Returns: boolean }
      storage_object_org_id: { Args: { object_name: string }; Returns: string }
    }
    Enums: {
      autonomy: "manual" | "auto_renewals"
      cadence_status: "active" | "paused" | "stopped" | "completed"
      certificate_status: "pending" | "extracted" | "failed" | "superseded"
      chase_kind: "request_initial" | "deficiency" | "renewal"
      evaluation_status: "compliant" | "deficient" | "expiring" | "expired"
      plan: "free" | "pro"
      touch_status:
        | "draft"
        | "approved"
        | "snoozed"
        | "rejected"
        | "cancelled"
        | "sent"
        | "failed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      autonomy: ["manual", "auto_renewals"],
      cadence_status: ["active", "paused", "stopped", "completed"],
      certificate_status: ["pending", "extracted", "failed", "superseded"],
      chase_kind: ["request_initial", "deficiency", "renewal"],
      evaluation_status: ["compliant", "deficient", "expiring", "expired"],
      plan: ["free", "pro"],
      touch_status: [
        "draft",
        "approved",
        "snoozed",
        "rejected",
        "cancelled",
        "sent",
        "failed",
      ],
    },
  },
} as const
