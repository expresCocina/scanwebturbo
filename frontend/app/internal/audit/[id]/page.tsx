'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Audit, AuditCategory, AuditIssue } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink, Download } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { generateAuditPDF } from '@/lib/pdf/generateReport'

// ─── Helpers ──────────────────────────────────────────────────
function scoreInfo(score: number) {
  if (score >= 80) return { label: 'Excelente', color: 'text-green-400', ring: 'border-green-500/40', bg: 'bg-green-500/10' }
  if (score >= 60) return { label: 'Bueno',     color: 'text-yellow-400', ring: 'border-yellow-500/40', bg: 'bg-yellow-500/10' }
  if (score >= 40) return { label: 'Mejorable', color: 'text-orange-400', ring: 'border-orange-500/40', bg: 'bg-orange-500/10' }
  return             { label: 'Crítico',    color: 'text-red-400',    ring: 'border-red-500/40',    bg: 'bg-red-500/10' }
}

function Gauge({ score, size = 120, stroke = 10 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
    </svg>
  )
}

const CAT_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  performance:   { name: 'Velocidad',      icon: '⚡', color: 'text-blue-400' },
  seo:           { name: 'SEO',            icon: '📈', color: 'text-purple-400' },
  security:      { name: 'Seguridad',      icon: '🛡️', color: 'text-green-400' },
  accessibility: { name: 'Accesibilidad',  icon: '♿', color: 'text-yellow-400' },
  ux:            { name: 'Experiencia',    icon: '👁️', color: 'text-pink-400' },
  conversion:    { name: 'Conversión',     icon: '💰', color: 'text-emerald-400' },
}

const SEV: Record<string, { label: string; bg: string; border: string; text: string; band: string }> = {
  critico: { label: 'URGENTE',      bg: 'bg-red-950/60',    border: 'border-red-500/40',    text: 'text-red-400',    band: 'bg-red-900/50' },
  alto:    { label: 'IMPORTANTE',   bg: 'bg-orange-950/60', border: 'border-orange-500/40', text: 'text-orange-400', band: 'bg-orange-900/40' },
  medio:   { label: 'RECOMENDADO',  bg: 'bg-yellow-950/40', border: 'border-yellow-500/30', text: 'text-yellow-400', band: 'bg-yellow-900/30' },
  bajo:    { label: 'OPCIONAL',     bg: 'bg-blue-950/40',   border: 'border-blue-500/30',   text: 'text-blue-400',   band: 'bg-blue-900/20' },
}

// ─── CWV metric chip ──────────────────────────────────────────
function MetricChip({ label, value, good, warn }: { label: string; value: string; good: number; warn: number }) {
  const num = parseFloat(value)
  const color = isNaN(num) || value === 'N/A'
    ? 'text-slate-500'
    : num <= good ? 'text-green-400' : num <= warn ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`font-bold text-sm ${color}`}>{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function AuditDetailPage() {
  const params   = useParams()
  const id       = params.id as string
  const supabase = getSupabaseClient()

  const [audit,      setAudit]      = useState<Audit | null>(null)
  const [categories, setCategories] = useState<AuditCategory[]>([])
  const [issues,     setIssues]     = useState<AuditIssue[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'overview' | 'issues' | 'ai'>('overview')
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    try {
      const { data: a, error } = await supabase.from('audits').select('*').eq('id', id).single()
      if (error) throw error
      setAudit(a)
      const { data: cats }   = await supabase.from('audit_categories').select('*').eq('audit_id', id)
      const { data: iss }    = await supabase.from('audit_issues').select('*').eq('audit_id', id)
      setCategories(cats || [])
      setIssues(iss || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handlePDF() {
    if (!audit) return
    setPdfLoading(true)
    try { await generateAuditPDF({ ...audit, score_global: audit.score_global ?? 0 }, categories, issues) }
    finally { setPdfLoading(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Cargando auditoría...</p>
      </div>
    </div>
  )

  if (!audit) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center p-10 bg-white/5 rounded-2xl border border-white/10">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-white mb-3">Auditoría no encontrada</h1>
        <Link href="/"><Button variant="outline">Volver al Dashboard</Button></Link>
      </div>
    </div>
  )

  const globalInfo   = scoreInfo(audit.score_global || 0)
  const sortedIssues = [...issues].sort((a, b) =>
    ['critico','alto','medio','bajo'].indexOf(a.severity) - ['critico','alto','medio','bajo'].indexOf(b.severity)
  )
  const criticalCount = issues.filter(i => i.severity === 'critico').length
  const highCount     = issues.filter(i => i.severity === 'alto').length

  const perfMetrics = (audit.report_data as any)?.categories?.performance?.metrics
  const aiData      = (audit.report_data as any)?.ai
  const recommendations = aiData?.recommendations || []

  const tabs = [
    { id: 'overview', label: '📊 Resumen' },
    { id: 'issues',   label: `🔍 Problemas (${issues.length})` },
    { id: 'ai',       label: `🤖 Recomendaciones IA (${recommendations.length})` },
  ] as const

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white shrink-0">
                <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-white truncate">{audit.domain}</h1>
              {audit.client_name && <p className="text-xs text-slate-500 truncate">{audit.client_name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={pdfLoading}
              className="border-white/20 text-slate-300 hover:text-white hover:border-white/40">
              <Download className="w-4 h-4 mr-1" />
              {pdfLoading ? 'Generando...' : 'PDF'}
            </Button>
            <Link href={`/a/${audit.public_slug}`} target="_blank">
              <Button variant="outline" size="sm" className="border-white/20 text-slate-300 hover:text-white hover:border-white/40">
                <ExternalLink className="w-4 h-4 mr-1" /> Reporte público
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── HERO: score + categories ── */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

          {/* Global score */}
          <div className={`md:col-span-1 rounded-2xl border ${globalInfo.ring} ${globalInfo.bg} p-6 flex flex-col items-center justify-center text-center`}>
            <p className="text-slate-500 text-xs mb-2 uppercase tracking-wide">Score Global</p>
            <div className="relative mb-1">
              <Gauge score={audit.score_global || 0} size={100} stroke={9} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${globalInfo.color}`}>{audit.score_global ?? '—'}</span>
                <span className="text-slate-600 text-xs">/100</span>
              </div>
            </div>
            <span className={`text-xs font-bold ${globalInfo.color}`}>{globalInfo.label}</span>
            <p className="text-slate-600 text-xs mt-2">{formatDate(audit.created_at)}</p>
          </div>

          {/* Category scores */}
          <div className="md:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map(cat => {
              const cfg  = CAT_CONFIG[cat.category] || { name: cat.category, icon: '📊', color: 'text-slate-400' }
              const info = scoreInfo(cat.score)
              return (
                <div key={cat.id} className={`rounded-2xl border ${info.ring} ${info.bg} p-4 text-center`}>
                  <div className="text-2xl mb-1">{cfg.icon}</div>
                  <div className="text-slate-400 text-xs mb-1">{cfg.name}</div>
                  <div className={`text-3xl font-black ${info.color}`}>{cat.score}</div>
                  <div className="text-slate-600 text-xs mb-2">/100</div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.score >= 80 ? 'bg-green-500' : cat.score >= 60 ? 'bg-yellow-400' : cat.score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${cat.score}%`, transition: 'width 1s ease' }}
                    />
                  </div>
                  <div className={`text-xs mt-1 font-semibold ${info.color}`}>{info.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── ALERTS ── */}
        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex flex-wrap gap-3">
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full">
                <span className="text-red-400 font-bold text-sm">🔴 {criticalCount} problema{criticalCount > 1 ? 's' : ''} urgente{criticalCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {highCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full">
                <span className="text-orange-400 font-bold text-sm">🟠 {highCount} problema{highCount > 1 ? 's' : ''} importante{highCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* Screenshot + Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Screenshot */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-bold text-white mb-3">📸 Captura del sitio</h2>
                {(audit.report_data as any)?.screenshot ? (
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <img src={(audit.report_data as any).screenshot}
                      alt={`Captura de ${audit.domain}`}
                      className="w-full object-cover object-top max-h-64" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 bg-white/[0.03] rounded-xl border border-white/[0.07]">
                    <p className="text-slate-600 text-sm">Captura no disponible</p>
                  </div>
                )}
              </div>

              {/* AI Summary + priority actions */}
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col gap-4">
                <h2 className="text-sm font-bold text-white">🤖 Resumen ejecutivo (IA)</h2>
                {aiData?.summary ? (
                  <p className="text-slate-300 text-sm leading-relaxed">{aiData.summary}</p>
                ) : (
                  <p className="text-slate-600 text-sm">No disponible</p>
                )}
                {aiData?.priorityActions?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Acciones prioritarias</p>
                    <ol className="space-y-1.5">
                      {aiData.priorityActions.map((action: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                          <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>

            {/* Core Web Vitals */}
            {perfMetrics && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-white">⚡ Core Web Vitals & Métricas de Performance</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold border ${scoreInfo(perfMetrics.perfScore || 0).ring} ${scoreInfo(perfMetrics.perfScore || 0).bg} ${scoreInfo(perfMetrics.perfScore || 0).color}`}>
                    PSI: {perfMetrics.perfScore ?? '—'}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <MetricChip label="FCP"          value={perfMetrics.fcp         ? `${(perfMetrics.fcp/1000).toFixed(1)}s`         : 'N/A'} good={1.8} warn={3.0} />
                  <MetricChip label="LCP"          value={perfMetrics.lcp         ? `${(perfMetrics.lcp/1000).toFixed(1)}s`         : 'N/A'} good={2.5} warn={4.0} />
                  <MetricChip label="TBT"          value={perfMetrics.tbt         ? `${perfMetrics.tbt}ms`                          : 'N/A'} good={200} warn={600} />
                  <MetricChip label="CLS"          value={perfMetrics.cls         !== undefined ? String(perfMetrics.cls.toFixed ? perfMetrics.cls.toFixed(3) : perfMetrics.cls) : 'N/A'} good={0.1} warn={0.25} />
                  <MetricChip label="Speed Index"  value={perfMetrics.speedIndex  ? `${(perfMetrics.speedIndex/1000).toFixed(1)}s`  : 'N/A'} good={3.4} warn={5.8} />
                  <MetricChip label="TTFB"         value={perfMetrics.ttfb        ? `${perfMetrics.ttfb}ms`                         : 'N/A'} good={600} warn={1800} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <span className="text-slate-500 text-xs">Peso total</span>
                    <p className="font-bold text-sm text-white">{perfMetrics.totalTransferKB ? `${perfMetrics.totalTransferKB} KB` : 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <span className="text-slate-500 text-xs">Scripts JS</span>
                    <p className="font-bold text-sm text-white">{perfMetrics.jsCount ?? 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <span className="text-slate-500 text-xs">Recursos totales</span>
                    <p className="font-bold text-sm text-white">{perfMetrics.resourceCount ?? 'N/A'}</p>
                  </div>
                </div>

                {/* CWV thresholds legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Bueno</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Necesita mejorar</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Deficiente</span>
                </div>
              </div>
            )}

            {/* Scores comparison bars */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
              <h2 className="font-bold text-white mb-4">📊 Comparativa por área</h2>
              <div className="space-y-3">
                {categories.map(cat => {
                  const cfg  = CAT_CONFIG[cat.category] || { name: cat.category, icon: '📊', color: 'text-slate-400' }
                  const info = scoreInfo(cat.score)
                  return (
                    <div key={cat.id} className="flex items-center gap-3">
                      <span className="text-lg w-7 shrink-0">{cfg.icon}</span>
                      <span className="text-sm text-slate-300 w-28 shrink-0">{cfg.name}</span>
                      <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cat.score >= 80 ? 'bg-green-500' : cat.score >= 60 ? 'bg-yellow-400' : cat.score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${cat.score}%`, transition: 'width 1.2s ease' }}
                        />
                      </div>
                      <span className={`w-10 text-right font-bold text-sm ${info.color}`}>{cat.score}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Issues summary */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
              <h2 className="font-bold text-white mb-4">🚦 Resumen de problemas</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['critico','alto','medio','bajo'] as const).map(sev => {
                  const cnt = issues.filter(i => i.severity === sev).length
                  const s   = SEV[sev]
                  return (
                    <div key={sev} className={`p-4 rounded-xl border text-center ${s.bg} ${s.border}`}>
                      <div className={`text-3xl font-black ${s.text}`}>{cnt}</div>
                      <div className={`text-xs font-bold ${s.text} mt-1`}>{s.label}</div>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setActiveTab('issues')}
                className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white text-sm transition-colors">
                Ver todos los problemas →
              </button>
            </div>
          </div>
        )}

        {/* ══ ISSUES TAB ══ */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            {sortedIssues.length === 0 ? (
              <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-white font-bold text-lg">¡Sin problemas detectados!</p>
                <p className="text-slate-400 text-sm">Tu sitio está en excelentes condiciones.</p>
              </div>
            ) : (
              sortedIssues.map((issue, idx) => {
                const s      = SEV[issue.severity] || SEV.bajo
                const catCfg = CAT_CONFIG[issue.category] || { icon: '📋', name: issue.category, color: 'text-slate-400' }
                return (
                  <div key={issue.id} className={`rounded-2xl border overflow-hidden ${s.border}`}>
                    <div className={`px-5 py-3 flex items-center gap-3 ${s.band}`}>
                      <span className="text-white/30 font-black text-sm">#{idx + 1}</span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${s.bg} ${s.border} ${s.text}`}>
                        {s.label}
                      </span>
                      <span className="text-xs text-slate-400">{catCfg.icon} {catCfg.name}</span>
                    </div>
                    <div className={`p-5 ${s.bg}`}>
                      <h3 className="font-black text-white text-lg mb-2 leading-snug">{issue.title}</h3>
                      <p className="text-slate-200 text-sm leading-relaxed mb-3">{issue.description}</p>
                      {issue.impact && (
                        <div className="mb-3 rounded-xl border border-orange-500/20 bg-orange-950/30 p-3">
                          <p className="text-orange-400 text-xs font-bold uppercase tracking-wide mb-1">💸 Impacto en el negocio</p>
                          <p className="text-orange-100 text-sm">{issue.impact}</p>
                        </div>
                      )}
                      {issue.how_to_fix && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-3">
                          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wide mb-1">✅ Cómo solucionarlo</p>
                          <p className="text-emerald-100 text-sm">{issue.how_to_fix}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ══ AI RECOMMENDATIONS TAB ══ */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {recommendations.length === 0 ? (
              <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-slate-400">No hay recomendaciones de IA disponibles.</p>
              </div>
            ) : (
              recommendations.map((rec: any, idx: number) => {
                const effortColor = rec.effortLevel === 'bajo'
                  ? 'text-green-400 border-green-500/30 bg-green-500/10'
                  : rec.effortLevel === 'medio'
                    ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                    : 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                const catCfg = CAT_CONFIG[rec.category] || { icon: '📊', name: rec.category, color: 'text-slate-400' }
                return (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-black text-lg">#{idx + 1}</span>
                        <h3 className="font-bold text-white">{rec.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{catCfg.icon} {catCfg.name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${effortColor}`}>
                          Esfuerzo {rec.effortLevel}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed mb-3">{rec.description}</p>
                    <div className="flex flex-wrap gap-3">
                      {rec.expectedImpact && (
                        <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                          <span>📈</span> <span>{rec.expectedImpact}</span>
                        </div>
                      )}
                      {rec.timeToFix && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
                          <span>⏱️</span> <span>{rec.timeToFix}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>
    </div>
  )
}
