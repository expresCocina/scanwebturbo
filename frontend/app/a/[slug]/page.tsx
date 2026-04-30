'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Audit, AuditCategory, AuditIssue } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

// ─── Tooltip wrapper ──────────────────────────────────────────
function Tip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl z-50 leading-relaxed pointer-events-none border border-white/10">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}

// ─── Circular gauge ───────────────────────────────────────────
function Gauge({ score, size = 140, stroke = 12 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }}
      />
    </svg>
  )
}

// ─── Score label helper ───────────────────────────────────────
function scoreInfo(score: number) {
  if (score >= 80) return { label: 'Excelente', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' }
  if (score >= 60) return { label: 'Bueno', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' }
  if (score >= 40) return { label: 'Mejorable', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' }
  return { label: 'Crítico', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' }
}

// ─── Category config ──────────────────────────────────────────
const CAT_CONFIG: Record<string, { name: string; icon: string; tip: string }> = {
  performance: {
    name: 'Velocidad',
    icon: '⚡',
    tip: 'Mide qué tan rápido carga tu sitio web. Un sitio lento hace que los visitantes se vayan antes de ver tu contenido. Google también penaliza los sitios lentos en los resultados de búsqueda.',
  },
  seo: {
    name: 'SEO',
    icon: '📈',
    tip: 'Indica qué tan fácil es que Google encuentre y muestre tu sitio en las búsquedas. Un buen SEO significa más visitas orgánicas sin pagar publicidad.',
  },
  security: {
    name: 'Seguridad',
    icon: '🛡️',
    tip: 'Evalúa si tu sitio protege correctamente la información de tus visitantes. Un sitio inseguro puede ser hackeado o marcado como peligroso por los navegadores.',
  },
  ux: {
    name: 'Experiencia',
    icon: '👁️',
    tip: 'Mide qué tan cómodo y fácil es navegar tu sitio, especialmente desde el celular. Una mala experiencia hace que los visitantes no vuelvan.',
  },
}

const SEV_CONFIG: Record<string, { icon: string; label: string; bg: string; border: string; text: string; tip: string }> = {
  critico: {
    icon: '🔴', label: 'URGENTE',
    bg: 'bg-red-950/60', border: 'border-red-500/40', text: 'text-red-400',
    tip: 'Problema grave que afecta directamente a tus visitas y clientes. Necesita solución inmediata.',
  },
  alto: {
    icon: '🟠', label: 'IMPORTANTE',
    bg: 'bg-orange-950/60', border: 'border-orange-500/40', text: 'text-orange-400',
    tip: 'Problema significativo que vale la pena resolver pronto para mejorar el rendimiento.',
  },
  medio: {
    icon: '🟡', label: 'RECOMENDADO',
    bg: 'bg-yellow-950/40', border: 'border-yellow-500/30', text: 'text-yellow-400',
    tip: 'Mejora recomendada que ayudará a posicionar mejor tu sitio a largo plazo.',
  },
  bajo: {
    icon: '🔵', label: 'OPCIONAL',
    bg: 'bg-blue-950/40', border: 'border-blue-500/30', text: 'text-blue-400',
    tip: 'Pequeño detalle que puede mejorar la experiencia, pero no es urgente.',
  },
}

// ─── Main page ────────────────────────────────────────────────
export default function PublicReportPage() {
  const params = useParams()
  const slug = params.slug as string
  const [audit, setAudit] = useState<Audit | null>(null)
  const [categories, setCategories] = useState<AuditCategory[]>([])
  const [issues, setIssues] = useState<AuditIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'issues'>('overview')
  const supabase = getSupabaseClient()

  useEffect(() => { if (slug) load() }, [slug])

  async function load() {
    try {
      const { data: a, error } = await supabase
        .from('audits').select('*').eq('public_slug', slug).eq('status', 'completed').single()
      if (error) throw error
      setAudit(a)
      const { data: cats } = await supabase.from('audit_categories').select('*').eq('audit_id', a.id)
      setCategories(cats || [])
      const { data: iss } = await supabase.from('audit_issues').select('*').eq('audit_id', a.id)
      setIssues(iss || [])
    } catch { /* not found */ } finally { setLoading(false) }
  }

  // ── loading ──
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-blue-300 text-lg">Cargando tu reporte...</p>
      </div>
    </div>
  )

  // ── not found ──
  if (!audit) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center p-12 bg-white/5 rounded-3xl border border-white/10 max-w-md">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-white mb-2">Reporte no encontrado</h1>
        <p className="text-slate-400">Esta auditoría no existe o todavía está en proceso. Intenta en unos minutos.</p>
      </div>
    </div>
  )

  const globalInfo = scoreInfo(audit.score_global || 0)
  const sortedIssues = [...issues].sort((a, b) => {
    const order = ['critico', 'alto', 'medio', 'bajo']
    return order.indexOf(a.severity) - order.indexOf(b.severity)
  })
  const urgentCount = issues.filter(i => i.severity === 'critico').length
  const importantCount = issues.filter(i => i.severity === 'alto').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">

      {/* ── NAV ── */}
      <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-sm">TB</div>
            <span className="font-bold text-white">WebScan</span>
            <span className="text-slate-500 hidden sm:inline">por TurboBrand</span>
          </div>
          <div className="text-sm text-slate-400">{formatDate(audit.created_at)}</div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* ── HERO ── */}
        <div className="text-center mb-12">
          <p className="text-blue-400 text-sm uppercase tracking-widest mb-2">Reporte de Auditoría</p>
          <h1 className="text-4xl font-black text-white mb-1">{audit.domain}</h1>
          {audit.client_name && <p className="text-slate-400 mb-8">{audit.client_name}</p>}

          {/* Global gauge */}
          <div className="inline-flex flex-col items-center">
            <div className="relative">
              <Gauge score={audit.score_global || 0} size={180} stroke={16} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-black ${globalInfo.color}`}>{audit.score_global}</span>
                <span className="text-slate-400 text-sm">/100</span>
              </div>
            </div>
            <Tip text="Este número resume el estado general de tu sitio web. Cuanto más alto, mejor. Un score por encima de 80 indica un sitio saludable y bien optimizado.">
              <span className={`mt-3 px-4 py-1.5 rounded-full text-sm font-bold border ${globalInfo.bg} ${globalInfo.border} ${globalInfo.color} flex items-center gap-1`}>
                {globalInfo.label} <span className="text-xs opacity-60">ⓘ</span>
              </span>
            </Tip>
          </div>

          {/* Alert badges */}
          {(urgentCount > 0 || importantCount > 0) && (
            <div className="flex gap-3 justify-center mt-6 flex-wrap">
              {urgentCount > 0 && (
                <Tip text="Estos problemas son urgentes y pueden estar alejando a tus clientes ahora mismo.">
                  <span className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-sm font-medium cursor-help">
                    🔴 {urgentCount} {urgentCount === 1 ? 'problema urgente' : 'problemas urgentes'}
                  </span>
                </Tip>
              )}
              {importantCount > 0 && (
                <Tip text="Estos problemas son importantes para mejorar la visibilidad y el rendimiento de tu sitio.">
                  <span className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-400 text-sm font-medium cursor-help">
                    🟠 {importantCount} {importantCount === 1 ? 'problema importante' : 'problemas importantes'}
                  </span>
                </Tip>
              )}
            </div>
          )}
        </div>

        {/* ── CATEGORY CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {categories.map(cat => {
            const cfg = CAT_CONFIG[cat.category] || { name: cat.category, icon: '📊', tip: '' }
            const info = scoreInfo(cat.score)
            return (
              <Tip key={cat.id} text={cfg.tip}>
                <div className={`p-5 rounded-2xl border ${info.bg} ${info.border} text-center cursor-help hover:scale-105 transition-transform duration-200`}>
                  <div className="text-3xl mb-2">{cfg.icon}</div>
                  <div className="text-slate-300 text-xs mb-1">{cfg.name}</div>
                  <div className={`text-4xl font-black ${info.color}`}>{cat.score}</div>
                  <div className="text-slate-500 text-xs">/100</div>

                  {/* Bar */}
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.score >= 80 ? 'bg-green-500' : cat.score >= 60 ? 'bg-yellow-400' : cat.score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${cat.score}%`, transition: 'width 1s ease' }}
                    />
                  </div>

                  <div className={`text-xs mt-2 font-semibold ${info.color}`}>{info.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5 opacity-70">Pasa el cursor ⓘ</div>
                </div>
              </Tip>
            )
          })}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 mb-6">
          {(['overview', 'issues'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {tab === 'overview' ? '📊 Resumen' : `🔍 Problemas (${issues.length})`}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Visual comparison bar */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <h2 className="font-bold text-white mb-5">📊 Comparativa por área</h2>
              <div className="space-y-4">
                {categories.map(cat => {
                  const cfg = CAT_CONFIG[cat.category] || { name: cat.category, icon: '📊', tip: '' }
                  const info = scoreInfo(cat.score)
                  return (
                    <Tip key={cat.id} text={cfg.tip}>
                      <div className="flex items-center gap-4 cursor-help">
                        <span className="text-xl w-8">{cfg.icon}</span>
                        <div className="w-24 text-sm text-slate-300 flex-shrink-0">{cfg.name}</div>
                        <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cat.score >= 80 ? 'bg-green-500' : cat.score >= 60 ? 'bg-yellow-400' : cat.score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                            style={{ width: `${cat.score}%`, transition: 'width 1.2s ease' }}
                          />
                        </div>
                        <span className={`w-12 text-right font-bold ${info.color}`}>{cat.score}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${info.bg} ${info.border} ${info.color} flex-shrink-0 hidden sm:inline`}>
                          {info.label}
                        </span>
                      </div>
                    </Tip>
                  )
                })}
              </div>
            </div>

            {/* What does it mean */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <h2 className="font-bold text-white mb-4">💡 ¿Qué significa este score?</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { range: '80–100', label: 'Excelente', desc: 'Tu sitio está en gran forma. Pequeños ajustes pueden llevarlo al máximo.', color: 'border-green-500/30 bg-green-500/10 text-green-400' },
                  { range: '60–79', label: 'Bueno', desc: 'Hay oportunidades claras de mejora que pueden darte más visitas.', color: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' },
                  { range: '40–59', label: 'Mejorable', desc: 'Varios problemas importantes afectan la visibilidad y experiencia.', color: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
                  { range: '0–39', label: 'Crítico', desc: 'El sitio necesita atención urgente. Está perdiendo clientes potenciales.', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
                ].map(item => (
                  <div key={item.range} className={`p-4 rounded-xl border ${item.color} ${audit.score_global !== null && audit.score_global >= parseInt(item.range) && audit.score_global <= parseInt(item.range.split('–')[1]) ? 'ring-2 ring-white/30' : ''}`}>
                    <div className="font-bold text-lg">{item.range}</div>
                    <div className="font-semibold text-sm mb-1">{item.label}</div>
                    <div className="text-xs opacity-80">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Urgency summary */}
            {sortedIssues.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h2 className="font-bold text-white mb-4">🚦 Resumen de problemas</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['critico', 'alto', 'medio', 'bajo'] as const).map(sev => {
                    const cnt = issues.filter(i => i.severity === sev).length
                    const s = SEV_CONFIG[sev]
                    return (
                      <Tip key={sev} text={s.tip}>
                        <div className={`p-4 rounded-xl border text-center cursor-help ${s.bg} ${s.border}`}>
                          <div className="text-2xl mb-1">{s.icon}</div>
                          <div className={`text-3xl font-black ${s.text}`}>{cnt}</div>
                          <div className={`text-xs font-bold ${s.text}`}>{s.label}</div>
                        </div>
                      </Tip>
                    )
                  })}
                </div>
                <button
                  onClick={() => setActiveTab('issues')}
                  className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm transition-colors"
                >
                  Ver todos los problemas detallados →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ISSUES TAB ── */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            {sortedIssues.length === 0 ? (
              <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-white font-bold text-lg">¡Sin problemas detectados!</p>
                <p className="text-slate-400 text-sm">Tu sitio está en excelentes condiciones.</p>
              </div>
            ) : (
              sortedIssues.map(issue => {
                const s = SEV_CONFIG[issue.severity] || SEV_CONFIG.bajo
                const catCfg = CAT_CONFIG[issue.category] || { icon: '📋', name: issue.category, tip: '' }
                return (
                  <div key={issue.id} className={`rounded-2xl border p-5 ${s.bg} ${s.border}`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">{s.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Tip text={s.tip}>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-help ${s.bg} ${s.border} ${s.text}`}>
                              {s.label} ⓘ
                            </span>
                          </Tip>
                          <Tip text={catCfg.tip}>
                            <span className="text-xs text-slate-400 cursor-help">{catCfg.icon} {catCfg.name}</span>
                          </Tip>
                        </div>

                        <h3 className="font-bold text-white text-base mb-1">{issue.title}</h3>
                        <p className="text-slate-300 text-sm mb-3 leading-relaxed">{issue.description}</p>

                        {/* Impact */}
                        {issue.impact && (
                          <div className="mb-3 flex gap-2 items-start">
                            <span className="text-base flex-shrink-0">📊</span>
                            <div>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-0.5">¿Por qué importa?</span>
                              <span className="text-sm text-slate-300">{issue.impact}</span>
                            </div>
                          </div>
                        )}

                        {/* Fix */}
                        {issue.how_to_fix && (
                          <div className="bg-blue-950/60 border border-blue-500/20 rounded-xl p-3 flex gap-2 items-start">
                            <span className="text-base flex-shrink-0">🔧</span>
                            <div>
                              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide block mb-0.5">Cómo solucionarlo</span>
                              <span className="text-sm text-blue-200">{issue.how_to_fix}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── CTA ── */}
        <div className="mt-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-10 text-center shadow-2xl shadow-blue-900/40">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-2xl font-black text-white mb-3">¿Quieres arreglar estos problemas?</h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
            Nuestro equipo en TurboBrand puede implementar todas las mejoras para ti. Más visitas, más clientes, más ventas.
            Agenda una llamada gratuita de 30 minutos.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => window.open('https://turbobrandcol.com/contacto', '_blank')}
              className="px-8 py-3 bg-white text-blue-700 font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Agendar llamada gratis →
            </button>
            <button
              onClick={() => window.open('https://turbobrandcol.com', '_blank')}
              className="px-8 py-3 bg-white/10 border border-white/30 text-white font-medium rounded-2xl hover:bg-white/20 transition-all"
            >
              Conocer TurboBrand
            </button>
          </div>
        </div>

        <footer className="mt-10 text-center text-slate-600 text-xs pb-6">
          Reporte generado por WebScan — TurboBrand Colombia 2026
        </footer>
      </div>
    </div>
  )
}
