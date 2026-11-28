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
      interacoes: {
        Row: {
          created_at: string
          data: string
          id: string
          lead_id: string
          notas: string | null
          tipo: Database["public"]["Enums"]["tipo_interacao"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          lead_id: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["tipo_interacao"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          lead_id?: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["tipo_interacao"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          abordagem_ia: string | null
          cidade: string | null
          created_at: string
          decisor: string | null
          email: string | null
          endereco: string | null
          id: string
          melhor_horario: string | null
          motivo_perda: string | null
          nicho: string | null
          nome_empresa: string
          observacoes: string | null
          origem: string
          place_id: string | null
          proxima_acao: string | null
          proximo_followup: string | null
          rating: number | null
          reuniao_at: string | null
          score_comercial: number
          score_prioridade: number
          score_seo: number | null
          servico_interesse: string | null
          status_funil: Database["public"]["Enums"]["status_funil"]
          temperatura: string
          telefone: string | null
          tentativas_contacto: number
          total_avaliacoes: number | null
          ultima_interacao_at: string | null
          updated_at: string
          user_id: string
          valor_estimado: number | null
          website: string | null
          website_status: string
          whatsapp_confirmado: boolean
        }
        Insert: {
          abordagem_ia?: string | null
          cidade?: string | null
          created_at?: string
          decisor?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          melhor_horario?: string | null
          motivo_perda?: string | null
          nicho?: string | null
          nome_empresa: string
          observacoes?: string | null
          origem?: string
          place_id?: string | null
          proxima_acao?: string | null
          proximo_followup?: string | null
          rating?: number | null
          reuniao_at?: string | null
          score_comercial?: number
          score_prioridade?: number
          score_seo?: number | null
          servico_interesse?: string | null
          status_funil?: Database["public"]["Enums"]["status_funil"]
          temperatura?: string
          telefone?: string | null
          tentativas_contacto?: number
          total_avaliacoes?: number | null
          ultima_interacao_at?: string | null
          updated_at?: string
          user_id: string
          valor_estimado?: number | null
          website?: string | null
          website_status?: string
          whatsapp_confirmado?: boolean
        }
        Update: {
          abordagem_ia?: string | null
          cidade?: string | null
          created_at?: string
          decisor?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          melhor_horario?: string | null
          motivo_perda?: string | null
          nicho?: string | null
          nome_empresa?: string
          observacoes?: string | null
          origem?: string
          place_id?: string | null
          proxima_acao?: string | null
          proximo_followup?: string | null
          rating?: number | null
          reuniao_at?: string | null
          score_comercial?: number
          score_prioridade?: number
          score_seo?: number | null
          servico_interesse?: string | null
          status_funil?: Database["public"]["Enums"]["status_funil"]
          temperatura?: string
          telefone?: string | null
          tentativas_contacto?: number
          total_avaliacoes?: number | null
          ultima_interacao_at?: string | null
          updated_at?: string
          user_id?: string
          valor_estimado?: number | null
          website?: string | null
          website_status?: string
          whatsapp_confirmado?: boolean
        }
        Relationships: []
      }
      site_projects: {
        Row: {
          briefing: string
          chamada_acao: string | null
          cidade: string | null
          cor_marca: string
          created_at: string
          descricao: string | null
          email: string | null
          github_path: string | null
          id: string
          lead_id: string
          logo_url: string | null
          nicho: string | null
          nome_empresa: string
          preview_url: string | null
          servicos: string | null
          slug: string
          status: string
          telefone: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          briefing: string
          chamada_acao?: string | null
          cidade?: string | null
          cor_marca?: string
          created_at?: string
          descricao?: string | null
          email?: string | null
          github_path?: string | null
          id?: string
          lead_id: string
          logo_url?: string | null
          nicho?: string | null
          nome_empresa: string
          preview_url?: string | null
          servicos?: string | null
          slug: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          briefing?: string
          chamada_acao?: string | null
          cidade?: string | null
          cor_marca?: string
          created_at?: string
          descricao?: string | null
          email?: string | null
          github_path?: string | null
          id?: string
          lead_id?: string
          logo_url?: string | null
          nicho?: string | null
          nome_empresa?: string
          preview_url?: string | null
          servicos?: string | null
          slug?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          empresa_vendedor: string | null
          google_api_key: string | null
          id: string
          nome: string | null
          nome_vendedor: string | null
          openai_api_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_vendedor?: string | null
          google_api_key?: string | null
          id: string
          nome?: string | null
          nome_vendedor?: string | null
          openai_api_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_vendedor?: string | null
          google_api_key?: string | null
          id?: string
          nome?: string | null
          nome_vendedor?: string | null
          openai_api_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      status_funil: "novo" | "contato" | "proposta" | "fechado" | "perdido"
      tipo_interacao: "chamada" | "mensagem" | "email" | "reuniao" | "nota"
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
  public: {
    Enums: {
      status_funil: ["novo", "contato", "proposta", "fechado", "perdido"],
      tipo_interacao: ["chamada", "mensagem", "email", "reuniao", "nota"],
    },
  },
} as const
