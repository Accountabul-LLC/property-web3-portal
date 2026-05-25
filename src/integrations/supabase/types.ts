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
      action_item_events: {
        Row: {
          action_item_id: string
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action_item_id: string
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action_item_id?: string
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "action_item_events_action_item_id_fkey"
            columns: ["action_item_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
        ]
      }
      action_items: {
        Row: {
          acceptance_criteria: string | null
          assigned_to: string | null
          completion_signal: string | null
          created_at: string
          created_by: string
          description: string
          expected_outcome: string | null
          files_json: Json | null
          github_issue_number: number | null
          github_issue_url: string | null
          github_labels: string[] | null
          github_repo: string | null
          github_sync_status: string | null
          id: string
          priority: string
          pushed_at: string | null
          source_thread_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          assigned_to?: string | null
          completion_signal?: string | null
          created_at?: string
          created_by: string
          description?: string
          expected_outcome?: string | null
          files_json?: Json | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          github_labels?: string[] | null
          github_repo?: string | null
          github_sync_status?: string | null
          id?: string
          priority?: string
          pushed_at?: string | null
          source_thread_id?: string | null
          source_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          assigned_to?: string | null
          completion_signal?: string | null
          created_at?: string
          created_by?: string
          description?: string
          expected_outcome?: string | null
          files_json?: Json | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          github_labels?: string[] | null
          github_repo?: string | null
          github_sync_status?: string | null
          id?: string
          priority?: string
          pushed_at?: string | null
          source_thread_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "ai_debate_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_integrations: {
        Row: {
          agent_id: string
          config: Json | null
          connected_at: string | null
          enabled: boolean
          id: string
          integration_type: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          config?: Json | null
          connected_at?: string | null
          enabled?: boolean
          id?: string
          integration_type?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          config?: Json | null
          connected_at?: string | null
          enabled?: boolean
          id?: string
          integration_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          key: string
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          key: string
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          key?: string
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      ai_debate_sessions: {
        Row: {
          context: string | null
          created_at: string
          id: string
          mode: string
          rounds: number
          topic: string
          transcript: Json
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          mode?: string
          rounds?: number
          topic: string
          transcript?: Json
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          mode?: string
          rounds?: number
          topic?: string
          transcript?: Json
          user_id?: string
        }
        Relationships: []
      }
      campaign_donations: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          currency: string
          donor_display_name: string | null
          donor_message: string | null
          donor_user_id: string | null
          donor_wallet_address: string
          escrow_finish_tx_hash: string | null
          escrow_sequence: number | null
          escrow_status: string
          escrow_tx_hash: string | null
          id: string
          is_anonymous: boolean
          release_date: string
          updated_at: string
          xaman_payload_uuid: string | null
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          currency?: string
          donor_display_name?: string | null
          donor_message?: string | null
          donor_user_id?: string | null
          donor_wallet_address: string
          escrow_finish_tx_hash?: string | null
          escrow_sequence?: number | null
          escrow_status?: string
          escrow_tx_hash?: string | null
          id?: string
          is_anonymous?: boolean
          release_date: string
          updated_at?: string
          xaman_payload_uuid?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          donor_display_name?: string | null
          donor_message?: string | null
          donor_user_id?: string | null
          donor_wallet_address?: string
          escrow_finish_tx_hash?: string | null
          escrow_sequence?: number | null
          escrow_status?: string
          escrow_tx_hash?: string | null
          id?: string
          is_anonymous?: boolean
          release_date?: string
          updated_at?: string
          xaman_payload_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          accepted_assets: string[]
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          campaign_mode: string
          created_at: string
          currency: string
          default_release_offset_days: number | null
          description: string
          donor_count: number
          gallery_urls: string[]
          goal_amount: number | null
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          image_url: string | null
          network: string
          recipient_wallet_address: string
          rejection_reason: string | null
          release_date: string
          slug: string
          status: string
          submission_notes: string | null
          submitted_by_email: string | null
          submitted_by_user_id: string | null
          title: string
          total_raised: number
          updated_at: string
          video_url: string | null
          visibility: string
        }
        Insert: {
          accepted_assets?: string[]
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_mode?: string
          created_at?: string
          currency?: string
          default_release_offset_days?: number | null
          description: string
          donor_count?: number
          gallery_urls?: string[]
          goal_amount?: number | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          image_url?: string | null
          network?: string
          recipient_wallet_address: string
          rejection_reason?: string | null
          release_date: string
          slug: string
          status?: string
          submission_notes?: string | null
          submitted_by_email?: string | null
          submitted_by_user_id?: string | null
          title: string
          total_raised?: number
          updated_at?: string
          video_url?: string | null
          visibility?: string
        }
        Update: {
          accepted_assets?: string[]
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_mode?: string
          created_at?: string
          currency?: string
          default_release_offset_days?: number | null
          description?: string
          donor_count?: number
          gallery_urls?: string[]
          goal_amount?: number | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          image_url?: string | null
          network?: string
          recipient_wallet_address?: string
          rejection_reason?: string | null
          release_date?: string
          slug?: string
          status?: string
          submission_notes?: string | null
          submitted_by_email?: string | null
          submitted_by_user_id?: string | null
          title?: string
          total_raised?: number
          updated_at?: string
          video_url?: string | null
          visibility?: string
        }
        Relationships: []
      }
      credential_applications: {
        Row: {
          accepted_at: string | null
          applied_at: string
          credential_key: string
          expires_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          revocation_reason: string | null
          revoked_at: string | null
          status: string
          user_id: string
          wallet_address: string
          wallet_credential_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          applied_at?: string
          credential_key: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: string
          user_id: string
          wallet_address: string
          wallet_credential_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          applied_at?: string
          credential_key?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          status?: string
          user_id?: string
          wallet_address?: string
          wallet_credential_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_applications_credential_key_fkey"
            columns: ["credential_key"]
            isOneToOne: false
            referencedRelation: "credential_catalog"
            referencedColumns: ["credential_key"]
          },
          {
            foreignKeyName: "credential_applications_wallet_credential_id_fkey"
            columns: ["wallet_credential_id"]
            isOneToOne: false
            referencedRelation: "wallet_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_catalog: {
        Row: {
          allowed_account_types: string[]
          application_mode: string
          credential_key: string
          credential_name: string
          description: string
          is_active: boolean
          maps_to_xrpl_code: string | null
          requires_kyc: boolean
          requires_wallet: boolean
          sort_order: number
          user_benefit: string | null
          user_cta: string | null
        }
        Insert: {
          allowed_account_types?: string[]
          application_mode?: string
          credential_key: string
          credential_name: string
          description?: string
          is_active?: boolean
          maps_to_xrpl_code?: string | null
          requires_kyc?: boolean
          requires_wallet?: boolean
          sort_order?: number
          user_benefit?: string | null
          user_cta?: string | null
        }
        Update: {
          allowed_account_types?: string[]
          application_mode?: string
          credential_key?: string
          credential_name?: string
          description?: string
          is_active?: boolean
          maps_to_xrpl_code?: string | null
          requires_kyc?: boolean
          requires_wallet?: boolean
          sort_order?: number
          user_benefit?: string | null
          user_cta?: string | null
        }
        Relationships: []
      }
      integration_audit_log: {
        Row: {
          action: string
          actor_id: string
          agent_id: string | null
          created_at: string | null
          id: string
          integration_type: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          agent_id?: string | null
          created_at?: string | null
          id?: string
          integration_type: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          agent_id?: string | null
          created_at?: string | null
          id?: string
          integration_type?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      kyc_cases: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          stripe_last_event_at: string | null
          stripe_verification_session_id: string | null
          stripe_verification_status: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          stripe_last_event_at?: string | null
          stripe_verification_session_id?: string | null
          stripe_verification_status?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          stripe_last_event_at?: string | null
          stripe_verification_session_id?: string | null
          stripe_verification_status?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string | null
          file_size_bytes: number | null
          id: string
          kyc_case_id: string
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          kyc_case_id: string
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          kyc_case_id?: string
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_form_data: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          country_of_residence: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          kyc_case_id: string
          legal_first_name: string | null
          legal_last_name: string | null
          nationality: string | null
          postal_code: string | null
          source_of_funds: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          kyc_case_id: string
          legal_first_name?: string | null
          legal_last_name?: string | null
          nationality?: string | null
          postal_code?: string | null
          source_of_funds?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          country_of_residence?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          kyc_case_id?: string
          legal_first_name?: string | null
          legal_last_name?: string | null
          nationality?: string | null
          postal_code?: string | null
          source_of_funds?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_form_data_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: true
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          from_status: string | null
          id: string
          kyc_case_id: string
          metadata: Json | null
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          kyc_case_id: string
          metadata?: Json | null
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          kyc_case_id?: string
          metadata?: Json | null
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_status_history_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
        ]
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
      permission_profiles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          label?: string
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
          property_id: string | null
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
          property_id?: string | null
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
          property_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "token_mints_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      trustline_sponsorships: {
        Row: {
          completed_at: string | null
          created_at: string
          currency: string
          funded_amount_xrp: number
          funding_tx_hash: string | null
          id: string
          issuer: string
          network: string
          status: string
          trustline_tx_hash: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          currency: string
          funded_amount_xrp?: number
          funding_tx_hash?: string | null
          id?: string
          issuer: string
          network: string
          status?: string
          trustline_tx_hash?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          currency?: string
          funded_amount_xrp?: number
          funding_tx_hash?: string | null
          id?: string
          issuer?: string
          network?: string
          status?: string
          trustline_tx_hash?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          amount: number | null
          body: string | null
          campaign_id: string | null
          created_at: string
          currency: string | null
          donation_id: string | null
          id: string
          kind: string
          metadata: Json
          network: string | null
          read_at: string | null
          title: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string | null
          donation_id?: string | null
          id?: string
          kind: string
          metadata?: Json
          network?: string | null
          read_at?: string | null
          title: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string | null
          donation_id?: string | null
          id?: string
          kind?: string
          metadata?: Json
          network?: string | null
          read_at?: string | null
          title?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
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
      wallet_credentials: {
        Row: {
          accepted_at: string | null
          created_at: string
          credential_type: string
          credential_type_hex: string | null
          id: string
          issued_at: string | null
          issuer_address: string
          issuer_wallet_id: string | null
          ledger_status: string
          revoked_at: string | null
          tx_hash: string | null
          updated_at: string
          wallet_id: string
          wallet_registration_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          credential_type?: string
          credential_type_hex?: string | null
          id?: string
          issued_at?: string | null
          issuer_address: string
          issuer_wallet_id?: string | null
          ledger_status?: string
          revoked_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          wallet_id: string
          wallet_registration_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          credential_type?: string
          credential_type_hex?: string | null
          id?: string
          issued_at?: string | null
          issuer_address?: string
          issuer_wallet_id?: string | null
          ledger_status?: string
          revoked_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          wallet_id?: string
          wallet_registration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_credentials_issuer_wallet_id_fkey"
            columns: ["issuer_wallet_id"]
            isOneToOne: false
            referencedRelation: "xrpl_issuer_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_credentials_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_credentials_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_credentials_wallet_registration_id_fkey"
            columns: ["wallet_registration_id"]
            isOneToOne: false
            referencedRelation: "wallet_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_permission_assignments: {
        Row: {
          expires_at: string | null
          granted_by: string | null
          id: string
          permission_profile_code: string
          starts_at: string
          status: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          permission_profile_code: string
          starts_at?: string
          status?: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          permission_profile_code?: string
          starts_at?: string
          status?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_permission_assignments_permission_profile_code_fkey"
            columns: ["permission_profile_code"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "wallet_permission_assignments_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_permission_assignments_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets_safe"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_registrations: {
        Row: {
          created_at: string
          id: string
          kyc_case_id: string | null
          kyc_snapshot: Json | null
          notes: string | null
          registration_status: string
          reviewed_at: string | null
          reviewer_id: string | null
          revocation_reason: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kyc_case_id?: string | null
          kyc_snapshot?: Json | null
          notes?: string | null
          registration_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kyc_case_id?: string | null
          kyc_snapshot?: Json | null
          notes?: string | null
          registration_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_registrations_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_registrations_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: true
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_registrations_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: true
            referencedRelation: "user_wallets_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      xaman_payloads: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          network: string | null
          signed_at: string | null
          status: string
          uuid: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          network?: string | null
          signed_at?: string | null
          status?: string
          uuid: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          network?: string | null
          signed_at?: string | null
          status?: string
          uuid?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      xrpl_issuer_wallets: {
        Row: {
          created_at: string
          id: string
          issuer_address: string
          label: string | null
          network: string
          secret_env_key: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issuer_address: string
          label?: string | null
          network?: string
          secret_env_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issuer_address?: string
          label?: string | null
          network?: string
          secret_env_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_wallets_safe: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string | null
          label: string | null
          last_seen_at: string | null
          network: string | null
          provider: string | null
          revoked_at: string | null
          status: string | null
          user_id: string | null
          wallet_address: string | null
          xaman_account_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          label?: string | null
          last_seen_at?: string | null
          network?: string | null
          provider?: string | null
          revoked_at?: string | null
          status?: string | null
          user_id?: string | null
          wallet_address?: string | null
          xaman_account_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          label?: string | null
          last_seen_at?: string | null
          network?: string | null
          provider?: string | null
          revoked_at?: string | null
          status?: string | null
          user_id?: string | null
          wallet_address?: string | null
          xaman_account_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_kyc_status: { Args: { p_user_id: string }; Returns: string }
      get_public_campaign_donations: {
        Args: { p_campaign_id: string }
        Returns: {
          amount: number
          campaign_id: string
          created_at: string
          currency: string
          donor_display_name: string
          donor_message: string
          donor_wallet_address: string
          escrow_status: string
          id: string
          is_anonymous: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_wallet_trade_enabled: {
        Args: { p_wallet_address: string }
        Returns: boolean
      }
      owns_wallet: { Args: { _wallet_address: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "compliance_officer"
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
      app_role: ["admin", "moderator", "user", "compliance_officer"],
    },
  },
} as const
