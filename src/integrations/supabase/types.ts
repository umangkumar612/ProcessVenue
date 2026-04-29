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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          extension: string | null
          filename: string
          id: string
          mime_type: string | null
          original_name: string
          size: number
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extension?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          original_name: string
          size?: number
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extension?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          original_name?: string
          size?: number
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          document_id: string
          error_message: string | null
          id: string
          logs: Json
          progress: number
          retry_count: number
          stage: Database["public"]["Enums"]["job_stage"]
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_id: string
          error_message?: string | null
          id?: string
          logs?: Json
          progress?: number
          retry_count?: number
          stage?: Database["public"]["Enums"]["job_stage"]
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error_message?: string | null
          id?: string
          logs?: Json
          progress?: number
          retry_count?: number
          stage?: Database["public"]["Enums"]["job_stage"]
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          created_at: string
          document_id: string
          extracted_json: Json
          finalized: boolean
          finalized_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          extracted_json?: Json
          finalized?: boolean
          finalized_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          extracted_json?: Json
          finalized?: boolean
          finalized_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
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
      app_role: "admin" | "user"
      doc_status: "queued" | "processing" | "completed" | "failed" | "finalized"
      job_stage:
        | "queued"
        | "started"
        | "parsing_started"
        | "parsing_completed"
        | "extraction_started"
        | "extraction_completed"
        | "storing_result"
        | "completed"
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
      doc_status: ["queued", "processing", "completed", "failed", "finalized"],
      job_stage: [
        "queued",
        "started",
        "parsing_started",
        "parsing_completed",
        "extraction_started",
        "extraction_completed",
        "storing_result",
        "completed",
        "failed",
      ],
    },
  },
} as const
