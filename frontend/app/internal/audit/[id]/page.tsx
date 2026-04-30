'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Audit, AuditCategory, AuditIssue } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, TrendingUp, Shield, Zap, Eye, ExternalLink } from 'lucide-react'
import { formatDate, getScoreColor, getSeverityColor } from '@/lib/utils'
import Link from 'next/link'

export default function AuditDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [audit, setAudit] = useState<Audit | null>(null)
  const [categories, setCategories] = useState<AuditCategory[]>([])
  const [issues, setIssues] = useState<AuditIssue[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (id) loadAudit()
  }, [id])

  async function loadAudit() {
    try {
      const { data: auditData, error } = await supabase
        .from('audits')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setAudit(auditData)

      const { data: catsData } = await supabase
        .from('audit_categories')
        .select('*')
        .eq('audit_id', id)

      setCategories(catsData || [])

      const { data: issuesData } = await supabase
        .from('audit_issues')
        .select('*')
        .eq('audit_id', id)
        .order('severity')

      setIssues(issuesData || [])
    } catch (error) {
      console.error('Error loading audit:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Cargando auditoría...</p>
        </div>
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Auditoría no encontrada</h1>
          <Link href="/"><Button>Volver al Dashboard</Button></Link>
        </Card>
      </div>
    )
  }

  const categoryIcons: Record<string, any> = {
    performance: Zap,
    seo: TrendingUp,
    security: Shield,
    ux: Eye
  }

  const categoryNames: Record<string, string> = {
    performance: 'Performance',
    seo: 'SEO',
    security: 'Seguridad',
    ux: 'Experiencia'
  }

  const severityOrder = ['critico', 'alto', 'medio', 'bajo']
  const sortedIssues = [...issues].sort((a, b) =>
    severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{audit.domain}</h1>
                {audit.client_name && (
                  <p className="text-sm text-gray-500">{audit.client_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/a/${audit.public_slug}`}
                target="_blank"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Reporte Público
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metadata */}
        <div className="mb-6 text-sm text-gray-500">
          Creada: {formatDate(audit.created_at)}
          {audit.completed_at && ` · Completada: ${formatDate(audit.completed_at)}`}
        </div>

        {/* Score Global + Categorías */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          {/* Score Global */}
          <Card className="p-6 text-center flex flex-col items-center justify-center md:col-span-1">
            <div className="text-sm text-gray-500 mb-1">Score Global</div>
            <div className={`text-6xl font-black ${getScoreColor(audit.score_global || 0)}`}>
              {audit.score_global ?? '—'}
            </div>
            <div className="text-gray-400 text-sm">/ 100</div>
          </Card>

          {/* Categorías */}
          <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.category]
              return (
                <Card key={cat.id} className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    {Icon && <Icon className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">{categoryNames[cat.category]}</div>
                  <div className={`text-3xl font-bold ${getScoreColor(cat.score)}`}>{cat.score}</div>
                  <div className="text-xs text-gray-400">/ 100</div>
                  <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        cat.score >= 80 ? 'bg-green-500' :
                        cat.score >= 60 ? 'bg-yellow-400' :
                        cat.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Issues */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            Issues Detectados ({issues.length})
          </h2>

          {sortedIssues.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay issues registrados para esta auditoría.</p>
          ) : (
            <div className="space-y-3">
              {sortedIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    issue.severity === 'critico' ? 'bg-red-50 border-red-500' :
                    issue.severity === 'alto' ? 'bg-orange-50 border-orange-500' :
                    issue.severity === 'medio' ? 'bg-yellow-50 border-yellow-500' :
                    'bg-blue-50 border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.category}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{issue.title}</h3>
                      <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                      {issue.how_to_fix && (
                        <p className="text-sm text-blue-800 bg-blue-100/60 px-3 py-2 rounded-lg">
                          💡 <span className="font-medium">Solución:</span> {issue.how_to_fix}
                        </p>
                      )}
                      {issue.impact && (
                        <p className="text-xs text-gray-500 mt-2">
                          📊 <span className="font-medium">Impacto:</span> {issue.impact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
