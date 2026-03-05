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
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          price_model: string | null
          price_text: string | null
          rating: number | null
          rating_count: number | null
          response_time: string | null
          role: string | null
          skills: string[] | null
          tasks_completed: number | null
          type: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_model?: string | null
          price_text?: string | null
          rating?: number | null
          rating_count?: number | null
          response_time?: string | null
          role?: string | null
          skills?: string[] | null
          tasks_completed?: number | null
          type?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_model?: string | null
          price_text?: string | null
          rating?: number | null
          rating_count?: number | null
          response_time?: string | null
          role?: string | null
          skills?: string[] | null
          tasks_completed?: number | null
          type?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          subscribed_at?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          average_purchase_price: number
          created_at: string
          id: string
          property_id: string
          tokens_owned: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          average_purchase_price?: number
          created_at?: string
          id?: string
          property_id: string
          tokens_owned?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          average_purchase_price?: number
          created_at?: string
          id?: string
          property_id?: string
          tokens_owned?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_transactions: {
        Row: {
          created_at: string
          id: string
          price_per_token: number
          property_id: string
          status: string
          tokens: number
          total_amount: number
          transaction_type: string
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_per_token: number
          property_id: string
          status?: string
          tokens: number
          total_amount: number
          transaction_type: string
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          price_per_token?: number
          property_id?: string
          status?: string
          tokens?: number
          total_amount?: number
          transaction_type?: string
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          completed_jobs: number | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          price_range: string | null
          rating: number | null
          response_time: string | null
          review_count: number | null
          service_type: string | null
          specialties: string[] | null
          title: string | null
          verified: boolean | null
          wallet_address: string | null
        }
        Insert: {
          completed_jobs?: number | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          price_range?: string | null
          rating?: number | null
          response_time?: string | null
          review_count?: number | null
          service_type?: string | null
          specialties?: string[] | null
          title?: string | null
          verified?: boolean | null
          wallet_address?: string | null
        }
        Update: {
          completed_jobs?: number | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          price_range?: string | null
          rating?: number | null
          response_time?: string | null
          review_count?: number | null
          service_type?: string | null
          specialties?: string[] | null
          title?: string | null
          verified?: boolean | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_type?: string
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_type?: string
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          address_display: string | null
          address_json: Json | null
          amenities: string[] | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string
          description: string | null
          estimated_value: number | null
          id: string
          images: string[] | null
          market_cap: number | null
          owner_user_id: string | null
          owner_wallet: string | null
          price_per_token: number | null
          projected_annual_return: number | null
          projected_rental_yield: number | null
          property_type: string | null
          review_notes: string | null
          square_feet: number | null
          state: string | null
          status: string
          submitted_at: string | null
          title: string
          tokens_available: number | null
          total_tokens: number | null
          updated_at: string
          year_built: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_display?: string | null
          address_json?: Json | null
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          id?: string
          images?: string[] | null
          market_cap?: number | null
          owner_user_id?: string | null
          owner_wallet?: string | null
          price_per_token?: number | null
          projected_annual_return?: number | null
          projected_rental_yield?: number | null
          property_type?: string | null
          review_notes?: string | null
          square_feet?: number | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          tokens_available?: number | null
          total_tokens?: number | null
          updated_at?: string
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_display?: string | null
          address_json?: Json | null
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          id?: string
          images?: string[] | null
          market_cap?: number | null
          owner_user_id?: string | null
          owner_wallet?: string | null
          price_per_token?: number | null
          projected_annual_return?: number | null
          projected_rental_yield?: number | null
          property_type?: string | null
          review_notes?: string | null
          square_feet?: number | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          tokens_available?: number | null
          total_tokens?: number | null
          updated_at?: string
          year_built?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_wallet_fkey"
            columns: ["owner_wallet"]
            isOneToOne: false
            referencedRelation: "wallet_profiles"
            referencedColumns: ["wallet_address"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          name: string
          property_id: string
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          property_id: string
        }
        Update: {
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ownership_percentage: number | null
          property_id: string
          rating: number
          user_name: string | null
          wallet_address: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ownership_percentage?: number | null
          property_id: string
          rating: number
          user_name?: string | null
          wallet_address: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ownership_percentage?: number | null
          property_id?: string
          rating?: number
          user_name?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_properties: {
        Row: {
          created_at: string
          id: string
          property_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      service_bookings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          professional_id: string
          scheduled_at: string | null
          status: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          professional_id: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          professional_id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      token_mints: {
        Row: {
          created_at: string
          id: string
          network: string
          request_json: Json | null
          status: string
          token_type: string
          tx_hash: string | null
          tx_json: Json | null
          updated_at: string
          user_id: string
          wallet_address: string
          xaman_payload_uuid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          network?: string
          request_json?: Json | null
          status?: string
          token_type: string
          tx_hash?: string | null
          tx_json?: Json | null
          updated_at?: string
          user_id: string
          wallet_address: string
          xaman_payload_uuid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          network?: string
          request_json?: Json | null
          status?: string
          token_type?: string
          tx_hash?: string | null
          tx_json?: Json | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
          xaman_payload_uuid?: string | null
        }
        Relationships: []
      }
      token_orders: {
        Row: {
          created_at: string
          filled_quantity: number
          id: string
          price: number
          property_id: string
          quantity: number
          side: string
          status: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          filled_quantity?: number
          id?: string
          price: number
          property_id: string
          quantity: number
          side: string
          status?: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          filled_quantity?: number
          id?: string
          price?: number
          property_id?: string
          quantity?: number
          side?: string
          status?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      token_price_history: {
        Row: {
          id: string
          price: number
          property_id: string
          recorded_at: string
          volume: number | null
        }
        Insert: {
          id?: string
          price: number
          property_id: string
          recorded_at?: string
          volume?: number | null
        }
        Update: {
          id?: string
          price?: number
          property_id?: string
          recorded_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "token_price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          label: string | null
          last_seen_at: string
          network: string
          provider: string
          revoked_at: string | null
          status: string
          user_id: string
          wallet_address: string
          wallet_secret: string | null
          xaman_account_name: string | null
          xaman_user_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          network?: string
          provider?: string
          revoked_at?: string | null
          status?: string
          user_id: string
          wallet_address: string
          wallet_secret?: string | null
          xaman_account_name?: string | null
          xaman_user_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          network?: string
          provider?: string
          revoked_at?: string | null
          status?: string
          user_id?: string
          wallet_address?: string
          wallet_secret?: string | null
          xaman_account_name?: string | null
          xaman_user_token?: string | null
        }
        Relationships: []
      }
      wallet_audit_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hint: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hint?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hint?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      wallet_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_login: string | null
          wallet_address: string
          xaman_account_name: string | null
          xaman_user_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login?: string | null
          wallet_address: string
          xaman_account_name?: string | null
          xaman_user_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login?: string | null
          wallet_address?: string
          xaman_account_name?: string | null
          xaman_user_token?: string | null
        }
        Relationships: []
      }
      xaman_payloads: {
        Row: {
          created_at: string
          id: string
          signed_at: string | null
          status: string
          uuid: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          signed_at?: string | null
          status?: string
          uuid: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          signed_at?: string | null
          status?: string
          uuid?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
