'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
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
    if (!domain) { toast.error('Ingresa un dominio'); return }
    setLoading(true)
    try {
      const cleanedDomain = cleanDomain(domain)
      const publicSlug = generateSlug()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: audit, error: auditError } = await supabase
        .from('audits').insert({
          domain: cleanedDomain,
          client_name: clientName || null,
          status: 'processing',
          public_slug: publicSlug,
          created_by: user?.id || null,
          report_data: {}
        }).select().single()
      if (auditError) throw auditError

      // Call through Next.js proxy to avoid CORS issues
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: audit.id, domain: cleanedDomain, analysisType })
      })
      if (!response.ok) throw new Error('Error al iniciar análisis')
      toast.success('¡Auditoría iniciada! Te avisamos cuando esté lista.')
      router.push('/')
    } catch (error) {
      console.error(error)
      toast.error('Error al crear auditoría')
    } finally {
      setLoading(false)
    }
  }

  const previewDomain = domain ? cleanDomain(domain) : ''

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden">
      {/* BG grid */}
      <div className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/3 left-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-600 flex-shrink-0 shadow-md shadow-blue-600/30">
              <img src="/logo.png" alt="WebScan" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-white">WebScan</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 text-sm">Nueva Auditoría</span>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Page title */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 text-sm transition-colors mb-4 group">
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Volver al Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Nueva Auditoría Web</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">Analiza la velocidad, SEO, seguridad y UX de cualquier sitio</p>
        </div>

        {/* Form card */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Domain */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Dominio a Auditar <span className="text-blue-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">🌐</span>
                <input
                  id="domain-input"
                  type="text"
                  placeholder="ejemplo.com"
                  className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-blue-950/10 transition-all text-sm sm:text-base"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <p className="text-xs text-slate-600 mt-1.5 ml-1">Con o sin https://, lo limpiamos automáticamente</p>
            </div>

            {/* Client name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Nombre del Cliente <span className="text-slate-600">(Opcional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">👤</span>
                <input
                  id="client-input"
                  type="text"
                  placeholder="Empresa o nombre del cliente"
                  className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-blue-950/10 transition-all text-sm sm:text-base"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Analysis type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Profundidad del Análisis
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  {
                    value: 'quick' as const,
                    icon: '⚡',
                    title: 'Rápida',
                    time: '2-3 minutos',
                    desc: 'Análisis básico de performance, SEO y seguridad',
                  },
                  {
                    value: 'complete' as const,
                    icon: '🔬',
                    title: 'Completa',
                    time: '5-7 minutos',
                    desc: 'Análisis profundo con recomendaciones detalladas y priorizadas',
                    recommended: true,
                  },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnalysisType(opt.value)}
                    disabled={loading}
                    className={`relative p-4 sm:p-5 rounded-xl border text-left transition-all ${
                      analysisType === opt.value
                        ? 'border-blue-500/60 bg-blue-600/10 shadow-lg shadow-blue-600/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                    }`}
                  >
                    {opt.recommended && (
                      <span className="absolute top-3 right-3 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                        Recomendada
                      </span>
                    )}
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <div className="font-bold text-white text-sm sm:text-base">{opt.title}</div>
                    <div className={`text-xs mt-0.5 ${analysisType === opt.value ? 'text-blue-300' : 'text-slate-500'}`}>{opt.time}</div>
                    <div className="text-xs text-slate-400 mt-2 leading-relaxed">{opt.desc}</div>
                    {analysisType === opt.value && (
                      <div className="absolute bottom-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px]">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {previewDomain && (
              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Vista previa</p>
                <p className="text-white font-mono text-sm">https://{previewDomain}</p>
                {clientName && <p className="text-slate-400 text-sm mt-1">👤 {clientName}</p>}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="start-audit-btn"
                type="submit"
                disabled={loading || !domain}
                className="flex-1 py-4 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Iniciando análisis...
                  </>
                ) : '🚀 Iniciar Auditoría'}
              </button>
              <Link href="/" className="sm:w-auto">
                <button
                  type="button"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-4 bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] text-slate-400 hover:text-white font-medium rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </Link>
            </div>
          </form>
        </div>

        {/* What we analyze */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 sm:p-6">
          <h3 className="font-bold text-white mb-4 text-sm sm:text-base">🔍 ¿Qué analizamos?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '⚡', title: 'Velocidad', desc: 'FCP, TTFB, carga total, peso de la página' },
              { icon: '📈', title: 'SEO Técnico', desc: 'Meta tags, estructura, indexabilidad' },
              { icon: '🛡️', title: 'Seguridad', desc: 'SSL, headers de seguridad, vulnerabilidades' },
              { icon: '👁️', title: 'Experiencia', desc: 'Responsive, accesibilidad, mobile-first' },
              { icon: '📋', title: 'Recomendaciones', desc: 'Plan de mejoras priorizado con pasos concretos', span: 'sm:col-span-2' },
            ].map(item => (
              <div key={item.title} className={`flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] ${(item as any).span || ''}`}>
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
