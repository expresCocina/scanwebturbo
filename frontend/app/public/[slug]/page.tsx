'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Audit, AuditCategory, AuditIssue } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, TrendingUp, Shield, Zap, Eye, AlertCircle } from 'lucide-react'
import { formatDate, getScoreColor, getSeverityIcon, getSeverityColor } from '@/lib/utils'
import Image from 'next/image'

export default function PublicReportPage() {
  const params = useParams()
  const slug = params.slug as string
  const [audit, setAudit] = useState<Audit | null>(null)
  const [categories, setCategories] = useState<AuditCategory[]>([])
  const [issues, setIssues] = useState<AuditIssue[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadReport()
  }, [slug])

  async function loadReport() {
    try {
      // Cargar auditoría
      const { data: auditData, error: auditError } = await supabase
        .from('audits')
        .select('*')
        .eq('public_slug', slug)
        .eq('status', 'completed')
        .single()

      if (auditError) throw auditError
      setAudit(auditData)

      // Cargar categorías
      const { data: categoriesData } = await supabase
        .from('audit_categories')
        .select('*')
        .eq('audit_id', auditData.id)

      setCategories(categoriesData || [])

      // Cargar issues
      const { data: issuesData } = await supabase
        .from('audit_issues')
        .select('*')
        .eq('audit_id', auditData.id)
        .order('severity', { ascending: false })

      setIssues(issuesData || [])

    } catch (error) {
      console.error('Error loading report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse-slow text-gray-400 mb-4">Cargando reporte...</div>
        </div>
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Reporte no encontrado</h1>
          <p className="text-gray-600">Esta auditoría no existe o aún no está disponible.</p>
        </Card>
      </div>
    )
  }

  const criticalIssues = issues.filter(i => i.severity === 'critico')
  const highIssues = issues.filter(i => i.severity === 'alto')
  const mediumIssues = issues.filter(i => i.severity === 'medio')
  const lowIssues = issues.filter(i => i.severity === 'bajo')

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">TB</span>
              </div>
              <div>
                <div className="text-sm text-gray-500">Powered by</div>
                <div className="font-bold text-gray-900">TurboBrand</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(audit.created_at)}
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Análisis Web - {audit.domain}
          </h1>
          {audit.client_name && (
            <p className="text-gray-600">Cliente: {audit.client_name}</p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Score Global */}
        <Card className="p-8 mb-8 text-center bg-white">
          <div className="mb-4 text-gray-600 font-medium">SCORE GLOBAL</div>
          <div className={`text-7xl font-bold mb-2 ${getScoreColor(audit.score_global || 0)}`}>
            {audit.score_global}
          </div>
          <div className="text-gray-500 text-xl">/ 100</div>
        </Card>

        {/* Categorías */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {categories.map((category) => {
            const Icon = categoryIcons[category.category]
            return (
              <Card key={category.id} className="p-6 bg-white hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  {Icon && <Icon className="w-5 h-5 text-gray-600" />}
                  <div className="font-medium text-gray-900">
                    {categoryNames[category.category]}
                  </div>
                </div>
                <div className={`text-4xl font-bold ${getScoreColor(category.score)}`}>
                  {category.score}
                </div>
                <div className="text-sm text-gray-500 mt-1">/ 100</div>
                
                {/* Barra de progreso */}
                <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      category.score >= 80 ? 'bg-green-500' :
                      category.score >= 60 ? 'bg-yellow-500' :
                      category.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${category.score}%` }}
                  />
                </div>
              </Card>
            )
          })}
        </div>

        {/* Issues por Severidad */}
        <div className="space-y-6 mb-8">
          {/* Críticos */}
          {criticalIssues.length > 0 && (
            <Card className="p-6 bg-white border-l-4 border-red-500">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🔴 CRÍTICO ({criticalIssues.length} {criticalIssues.length === 1 ? 'issue' : 'issues'})
              </h2>
              <div className="space-y-4">
                {criticalIssues.map((issue) => (
                  <div key={issue.id} className="border-l-2 border-red-300 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{issue.title}</h3>
                    <p className="text-gray-700 mb-2 text-sm">{issue.description}</p>
                    <div className="bg-red-50 p-3 rounded-lg mb-2">
                      <div className="text-xs font-medium text-red-800 mb-1">Impacto:</div>
                      <div className="text-sm text-red-900">{issue.impact}</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs font-medium text-blue-800 mb-1">Cómo Solucionarlo:</div>
                      <div className="text-sm text-blue-900">{issue.how_to_fix}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Altos */}
          {highIssues.length > 0 && (
            <Card className="p-6 bg-white border-l-4 border-orange-500">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🟠 ALTO ({highIssues.length} {highIssues.length === 1 ? 'issue' : 'issues'})
              </h2>
              <div className="space-y-4">
                {highIssues.slice(0, 5).map((issue) => (
                  <div key={issue.id} className="border-l-2 border-orange-300 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{issue.title}</h3>
                    <p className="text-gray-700 text-sm mb-2">{issue.description}</p>
                    <p className="text-sm text-blue-800 bg-blue-50 p-2 rounded">
                      💡 {issue.how_to_fix}
                    </p>
                  </div>
                ))}
                {highIssues.length > 5 && (
                  <p className="text-sm text-gray-500 italic">
                    Y {highIssues.length - 5} issues más de prioridad alta...
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Resumen de Medios y Bajos */}
          {(mediumIssues.length > 0 || lowIssues.length > 0) && (
            <Card className="p-6 bg-white">
              <div className="grid grid-cols-2 gap-4 text-center">
                {mediumIssues.length > 0 && (
                  <div>
                    <div className="text-3xl font-bold text-yellow-600">{mediumIssues.length}</div>
                    <div className="text-sm text-gray-600">Issues Prioridad Media</div>
                  </div>
                )}
                {lowIssues.length > 0 && (
                  <div>
                    <div className="text-3xl font-bold text-blue-600">{lowIssues.length}</div>
                    <div className="text-sm text-gray-600">Issues Prioridad Baja</div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* CTA */}
        <Card className="p-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">
            ¿Quieres arreglar estos problemas?
          </h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Agenda una asesoría gratuita con nuestro equipo. Te ayudamos a implementar las
            mejoras prioritarias y potenciar tu presencia digital.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-100"
              onClick={() => window.open('https://turbobrandcol.com/contacto', '_blank')}
            >
              Agendar Llamada Gratis
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-blue-800"
              onClick={() => window.open('https://turbobrandcol.com', '_blank')}
            >
              Conocer TurboBrand
            </Button>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Análisis generado por WebScan - TurboBrand Colombia</p>
          <p className="mt-2">
            <a href="https://turbobrandcol.com" className="text-blue-600 hover:underline">
              turbobrandcol.com
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
