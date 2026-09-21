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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          email: string
          first_name: string
          github_url: string | null
          id: string
          last_name: string
          linkedin_url: string | null
          portfolio_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          github_url?: string | null
          id?: string
          last_name: string
          linkedin_url?: string | null
          portfolio_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          github_url?: string | null
          id?: string
          last_name?: string
          linkedin_url?: string | null
          portfolio_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          category_id: string
          file_path: string
          id: string
          member_id: string
          uploaded_at: string
        }
        Insert: {
          category_id: string
          file_path: string
          id?: string
          member_id: string
          uploaded_at?: string
        }
        Update: {
          category_id?: string
          file_path?: string
          id?: string
          member_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_with_term"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_category_access: {
        Row: {
          category_id: string
          created_at: string
          sponsor_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          sponsor_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_category_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_category_access_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          sponsor_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          must_change_password?: boolean
          sponsor_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          sponsor_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_emails_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_invite_requests: {
        Row: {
          created_at: string
          id: string
          invited_email: string
          requested_by: string
          sponsor_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email: string
          requested_by: string
          sponsor_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string
          requested_by?: string
          sponsor_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_invite_requests_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_perks: {
        Row: {
          created_at: string
          description: string
          id: string
          sponsor_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          sponsor_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          sponsor_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_perks_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          created_at: string
          id: string
          logo_source: string
          logo_url: string | null
          name: string
          slug: string
          website_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_source?: string
          logo_url?: string | null
          name: string
          slug: string
          website_url: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_source?: string
          logo_url?: string | null
          name?: string
          slug?: string
          website_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      members_with_term: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          github_url: string | null
          id: string | null
          last_name: string | null
          linkedin_url: string | null
          portfolio_url: string | null
          term_basis_date: string | null
          term_season: string | null
          term_year: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_sponsor: {
        Args: {
          p_category_ids: string[]
          p_emails: string[]
          p_logo_source?: string
          p_logo_url?: string
          p_name: string
          p_perks: string[]
          p_website_url: string
        }
        Returns: {
          created_at: string
          id: string
          logo_source: string
          logo_url: string | null
          name: string
          slug: string
          website_url: string
        }
        SetofOptions: {
          from: "*"
          to: "sponsors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_member_id: { Args: never; Returns: string }
      current_sponsor_id: { Args: never; Returns: string }
      debug_whoami: {
        Args: never
        Returns: {
          direct_compare: boolean
          email_hex: string
          email_length: number
          is_admin_result: boolean
          parsed_email: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_blueprint: { Args: never; Returns: boolean }
      is_sponsor_contact: { Args: never; Returns: boolean }
      jwt_email: { Args: never; Returns: string }
      sponsor_visible_member_ids: { Args: never; Returns: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
