import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Cliente para server components (solo usar en Server Components / API Routes)
export const getSupabaseServer = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cliente para client components
export const getSupabaseClient = () => {
  return createClientComponentClient()
}

// Tipos de la base de datos
export type Audit = {
  id: string
  domain: string
  client_name: string | null
  status: 'processing' | 'completed' | 'failed'
  score_global: number | null
  created_by: string
  created_at: string
  completed_at: string | null
  public_slug: string
  report_data: any
}

export type AuditCategory = {
  id: string
  audit_id: string
  category: 'performance' | 'seo' | 'security' | 'ux'
  score: number
  issues: any[]
  recommendations: any[]
}

export type AuditIssue = {
  id: string
  audit_id: string
  category: string
  severity: 'critico' | 'alto' | 'medio' | 'bajo'
  title: string
  description: string
  how_to_fix: string
  impact: string
  code_example: string | null
}

export type Database = {
  public: {
    Tables: {
      audits: {
        Row: Audit
        Insert: Omit<Audit, 'id' | 'created_at'>
        Update: Partial<Audit>
      }
      audit_categories: {
        Row: AuditCategory
        Insert: Omit<AuditCategory, 'id'>
        Update: Partial<AuditCategory>
      }
      audit_issues: {
        Row: AuditIssue
        Insert: Omit<AuditIssue, 'id'>
        Update: Partial<AuditIssue>
      }
    }
  }
}
