'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { generateSlug, cleanDomain } from '@/lib/utils'
import Link from 'next/link'

export default function NewAuditPage() {
  const [domain, setDomain] = useState('')
  const [clientName, setClientName] = useState('')
  const [analysisType, setAnalysisType] = useState<'quick' | 'complete'>('complete')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = getSupabaseClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!domain) {
      toast.error('Por favor ingresa un dominio')
      return
    }

    setLoading(true)

    try {
      // Limpiar dominio
      const cleanedDomain = cleanDomain(domain)
      
      // Generar slug único
      const publicSlug = generateSlug()

      // Crear auditoría en Supabase
      // Obtener el usuario autenticado si existe
      const { data: { user } } = await supabase.auth.getUser()

      const { data: audit, error: auditError } = await supabase
        .from('audits')
        .insert({
          domain: cleanedDomain,
          client_name: clientName || null,
          status: 'processing',
          public_slug: publicSlug,
          created_by: user?.id || null, // null si no hay sesión activa
          report_data: {}
        })
        .select()
        .single()

      if (auditError) throw auditError

      // Llamar al backend worker para iniciar análisis
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_WORKER_URL || 'http://localhost:4000'}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auditId: audit.id,
          domain: cleanedDomain,
          analysisType
        })
      })

      if (!response.ok) {
        throw new Error('Error al iniciar análisis')
      }

      toast.success('Auditoría iniciada correctamente')
      router.push('/')
      
    } catch (error) {
      console.error('Error creating audit:', error)
      toast.error('Error al crear auditoría')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Nueva Auditoría Web</h1>
          <p className="text-gray-600 mt-1">
            Ingresa el dominio del sitio web que deseas analizar
          </p>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dominio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dominio a Auditar *
              </label>
              <input
                type="text"
                placeholder="ejemplo.com"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={loading}
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                Puedes ingresar con o sin https://, lo limpiaremos automáticamente
              </p>
            </div>

            {/* Nombre del Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Cliente (Opcional)
              </label>
              <input
                type="text"
                placeholder="Empresa XYZ"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Tipo de Análisis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Profundidad del Análisis
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAnalysisType('quick')}
                  disabled={loading}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    analysisType === 'quick'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">Rápida</div>
                  <div className="text-sm text-gray-600 mt-1">2-3 minutos</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Análisis básico de performance, SEO y seguridad
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalysisType('complete')}
                  disabled={loading}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    analysisType === 'complete'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">Completa</div>
                  <div className="text-sm text-gray-600 mt-1">5-7 minutos</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Análisis profundo + recomendaciones con IA
                  </div>
                </button>
              </div>
            </div>

            {/* Preview */}
            {domain && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Vista Previa:</div>
                <div className="text-gray-900">
                  Dominio: <span className="font-mono">{cleanDomain(domain)}</span>
                </div>
                {clientName && (
                  <div className="text-gray-900 mt-1">
                    Cliente: <span className="font-medium">{clientName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !domain}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando Análisis...
                  </>
                ) : (
                  'Iniciar Auditoría'
                )}
              </Button>
              <Link href="/">
                <Button type="button" variant="outline" disabled={loading}>
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </Card>

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">¿Qué analizamos?</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ Performance (velocidad de carga, métricas Core Web Vitals)</li>
            <li>✓ SEO técnico (meta tags, estructura, indexabilidad)</li>
            <li>✓ Seguridad (SSL, headers, vulnerabilidades)</li>
            <li>✓ Experiencia de usuario (responsive, accesibilidad)</li>
            <li>✓ Recomendaciones priorizadas generadas con IA</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
