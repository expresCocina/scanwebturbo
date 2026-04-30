'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Audit } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Search, Filter, Download } from 'lucide-react'
import { formatDate, getScoreColor } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

export default function DashboardPage() {
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadAudits()
  }, [filter])

  async function loadAudits() {
    setLoading(true)
    try {
      let query = supabase
        .from('audits')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setAudits(data || [])
    } catch (error) {
      console.error('Error loading audits:', error)
      toast.error('Error al cargar auditorías')
    } finally {
      setLoading(false)
    }
  }

  const filteredAudits = audits.filter(audit => 
    audit.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    audit.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WebScan</h1>
              <p className="text-gray-600 mt-1">Sistema de Auditoría TurboBrand</p>
            </div>
            <Link href="/internal/new">
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nueva Auditoría
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-600">Total Auditorías</div>
            <div className="text-3xl font-bold mt-2">{audits.length}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600">Completadas</div>
            <div className="text-3xl font-bold mt-2 text-green-600">
              {audits.filter(a => a.status === 'completed').length}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600">En Proceso</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {audits.filter(a => a.status === 'processing').length}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600">Score Promedio</div>
            <div className="text-3xl font-bold mt-2">
              {audits.filter(a => a.score_global).length > 0
                ? Math.round(
                    audits
                      .filter(a => a.score_global)
                      .reduce((acc, a) => acc + (a.score_global || 0), 0) /
                      audits.filter(a => a.score_global).length
                  )
                : 0}
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por dominio o cliente..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Todas
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              onClick={() => setFilter('completed')}
            >
              Completadas
            </Button>
            <Button
              variant={filter === 'processing' ? 'default' : 'outline'}
              onClick={() => setFilter('processing')}
            >
              En Proceso
            </Button>
          </div>
        </div>

        {/* Audits List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse-slow text-gray-400">Cargando auditorías...</div>
          </div>
        ) : filteredAudits.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500">No hay auditorías que mostrar</p>
            <Link href="/internal/new">
              <Button className="mt-4">Crear Primera Auditoría</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAudits.map((audit) => (
              <Card key={audit.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {audit.domain}
                      </h3>
                      {audit.status === 'processing' && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Procesando...
                        </span>
                      )}
                      {audit.status === 'completed' && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Completada
                        </span>
                      )}
                      {audit.status === 'failed' && (
                        <span className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Error
                        </span>
                      )}
                    </div>
                    {audit.client_name && (
                      <p className="text-gray-600 mt-1">Cliente: {audit.client_name}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      Creada: {formatDate(audit.created_at)}
                    </p>
                  </div>

                  {audit.status === 'completed' && audit.score_global !== null && (
                    <div className="text-right">
                      <div className={`text-4xl font-bold ${getScoreColor(audit.score_global)}`}>
                        {audit.score_global}
                      </div>
                      <div className="text-sm text-gray-500">/ 100</div>
                    </div>
                  )}
                </div>

                {audit.status === 'completed' && (
                  <div className="mt-4 flex gap-2">
                    <Link href={`/internal/audit/${audit.id}`}>
                      <Button variant="outline" size="sm">
                        Ver Detalles
                      </Button>
                    </Link>
                    <Link 
                      href={`${process.env.NEXT_PUBLIC_AUDIT_URL}/a/${audit.public_slug}`}
                      target="_blank"
                    >
                      <Button variant="outline" size="sm">
                        Ver Reporte Público
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
