'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Audit } from '@/lib/supabase/client'
import { formatDate, getScoreColor } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

// ─── Particle Canvas ──────────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let particles: Array<{
      x: number; y: number; vx: number; vy: number
      size: number; opacity: number; color: string
    }> = []

    const colors = ['#3b82f6', '#6366f1', '#06b6d4', '#8b5cf6', '#0ea5e9']

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    const initParticles = () => {
      particles = []
      const count = Math.floor((canvas.width * canvas.height) / 12000)
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.6 + 0.1,
          color: colors[Math.floor(Math.random() * colors.length)]
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw particles
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(p.opacity * 255).toString(16).padStart(2, '0')
        ctx.fill()

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })

      animId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  )
}

// ─── Score badge ──────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : score >= 40 ? 'text-orange-400' : 'text-red-400'
  const bg = score >= 80 ? 'bg-green-500/10 border-green-500/20' : score >= 60 ? 'bg-yellow-500/10 border-yellow-500/20' : score >= 40 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'
  return (
    <div className={`text-right px-4 py-2 rounded-xl border ${bg}`}>
      <div className={`text-3xl font-black ${color}`}>{score}</div>
      <div className="text-slate-500 text-xs">/100</div>
    </div>
  )
}

// ─── Status pill ──────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="px-2.5 py-1 bg-green-500/15 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
      ✓ Completada
    </span>
  )
  if (status === 'processing') return (
    <span className="px-2.5 py-1 bg-blue-500/15 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/20 animate-pulse">
      ⟳ Procesando...
    </span>
  )
  return (
    <span className="px-2.5 py-1 bg-red-500/15 text-red-400 text-xs font-semibold rounded-full border border-red-500/20">
      ✗ Error
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function DashboardPage() {
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const supabase = getSupabaseClient()

  async function handleDownloadPDF(audit: Audit) {
    if (downloadingId) return
    setDownloadingId(audit.id)
    toast.loading('Generando PDF...', { id: 'pdf' })
    try {
      const { generateAuditPDF } = await import('@/lib/pdf/generateReport')
      const [{ data: cats }, { data: iss }] = await Promise.all([
        supabase.from('audit_categories').select('*').eq('audit_id', audit.id),
        supabase.from('audit_issues').select('*').eq('audit_id', audit.id),
      ])
      await generateAuditPDF(
        { domain: audit.domain, client_name: audit.client_name, score_global: audit.score_global || 0, created_at: audit.created_at, public_slug: audit.public_slug },
        cats || [],
        iss || []
      )
      toast.success('PDF descargado correctamente', { id: 'pdf' })
    } catch (err) {
      console.error(err)
      toast.error('Error al generar PDF', { id: 'pdf' })
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => { loadAudits() }, [filter])

  async function loadAudits() {
    setLoading(true)
    try {
      let query = supabase.from('audits').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') query = query.eq('status', filter)
      const { data, error } = await query
      if (error) throw error
      setAudits(data || [])
    } catch {
      toast.error('Error al cargar auditorías')
    } finally {
      setLoading(false)
    }
  }

  const filtered = audits.filter(a =>
    a.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const completedCount = audits.filter(a => a.status === 'completed').length
  const processingCount = audits.filter(a => a.status === 'processing').length
  const avgScore = completedCount > 0
    ? Math.round(audits.filter(a => a.score_global).reduce((acc, a) => acc + (a.score_global || 0), 0) / completedCount)
    : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden">
      <ParticleBackground />

      {/* ── NAV ── */}
      <header className="relative z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo area */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-600 shadow-lg shadow-blue-600/30 flex-shrink-0">
              <img
                src="/logo.png"
                alt="WebScan"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none tracking-tight">WebScan</h1>
              <p className="text-slate-500 text-xs leading-none mt-0.5">by TurboBrand Colombia</p>
            </div>
          </div>

          <Link href="/internal/new">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 text-sm">
              <span className="text-base leading-none">+</span>
              Nueva Auditoría
            </button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        {/* ── HERO ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            Sistema de Auditoría Web Automatizada
          </div>
          <h2 className="text-4xl font-black text-white mb-2">
            Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Auditorías</span>
          </h2>
          <p className="text-slate-400 text-sm">Analiza, detecta y corrige problemas de cualquier sitio web con inteligencia artificial</p>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total', value: audits.length, color: 'text-white', icon: '📊' },
            { label: 'Completadas', value: completedCount, color: 'text-green-400', icon: '✅' },
            { label: 'En proceso', value: processingCount, color: 'text-blue-400', icon: '⚡' },
            { label: 'Score promedio', value: avgScore, color: avgScore >= 80 ? 'text-green-400' : avgScore >= 60 ? 'text-yellow-400' : 'text-orange-400', icon: '🎯' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.06] transition-colors">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
              <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar por dominio o cliente..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'completed', 'processing'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'completed' ? 'Completadas' : 'En Proceso'}
              </button>
            ))}
          </div>
        </div>

        {/* ── LIST ── */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-white/[0.03] border border-white/[0.05] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white/[0.02] border border-white/[0.05] rounded-3xl">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-white font-bold text-lg">No hay auditorías</p>
            <p className="text-slate-500 text-sm mt-1 mb-6">Crea tu primera auditoría para empezar</p>
            <Link href="/internal/new">
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all">
                + Nueva Auditoría
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(audit => (
              <div
                key={audit.id}
                className="group bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-blue-500/20 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-white text-base">{audit.domain}</h3>
                      <StatusPill status={audit.status} />
                    </div>
                    {audit.client_name && (
                      <p className="text-slate-400 text-sm">Cliente: <span className="text-slate-300">{audit.client_name}</span></p>
                    )}
                    <p className="text-slate-600 text-xs mt-1">{formatDate(audit.created_at)}</p>
                  </div>
                  {audit.status === 'completed' && audit.score_global !== null && (
                    <ScoreBadge score={audit.score_global} />
                  )}
                  {audit.status === 'processing' && (
                    <div className="flex items-center gap-1.5 text-blue-400 text-xs">
                      <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      Analizando...
                    </div>
                  )}
                </div>

                {audit.status === 'completed' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/internal/audit/${audit.id}`}>
                      <button className="px-4 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-all">
                        Ver Detalles →
                      </button>
                    </Link>
                    <a
                      href={`/a/${audit.public_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <button className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-xs font-medium rounded-lg transition-all">
                        Reporte Público ↗
                      </button>
                    </a>
                    <button
                      onClick={() => handleDownloadPDF(audit)}
                      disabled={downloadingId === audit.id}
                      className="px-4 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {downloadingId === audit.id ? (
                        <><span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> Generando...</>
                      ) : (
                        <><span>⬇</span> Descargar PDF</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-slate-700 text-xs mt-8">
        WebScan · TurboBrand Colombia 2026 · <a href="https://turbobrandcol.com" className="hover:text-slate-500 transition-colors">turbobrandcol.com</a>
      </footer>
    </div>
  )
}
