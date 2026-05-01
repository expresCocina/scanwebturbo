'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ───────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; size: number; opacity: number; color: string; life: number }
interface Burst { id: number; x: number; y: number; char: string; vx: number; vy: number; opacity: number; size: number }
interface Rocket { active: boolean; x: number; y: number; trail: Array<{x:number;y:number;o:number}> }

// ─── Canvas Background ────────────────────────────────────────
function StarField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    let raf: number
    const stars: Array<{x:number;y:number;r:number;o:number;v:number;color:string}> = []
    const cols = ['#3b82f6','#6366f1','#06b6d4','#8b5cf6','#a78bfa','#38bdf8']

    const resize = () => {
      c.width = window.innerWidth; c.height = window.innerHeight
      stars.length = 0
      for (let i = 0; i < 180; i++) stars.push({
        x: Math.random()*c.width, y: Math.random()*c.height,
        r: Math.random()*1.8+0.3, o: Math.random()*0.7+0.1,
        v: Math.random()*0.008+0.002,
        color: cols[Math.floor(Math.random()*cols.length)]
      })
    }

    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height)
      // Deep space gradient
      const grad = ctx.createRadialGradient(c.width/2,c.height/2,0,c.width/2,c.height/2,c.width*0.8)
      grad.addColorStop(0,'rgba(15,23,42,0)')
      grad.addColorStop(1,'rgba(2,6,23,0)')
      ctx.fillStyle = grad; ctx.fillRect(0,0,c.width,c.height)

      stars.forEach(s => {
        s.o += s.v
        if(s.o>0.9||s.o<0.1) s.v*=-1
        ctx.beginPath()
        ctx.arc(s.x,s.y,s.r,0,Math.PI*2)
        const hex = Math.floor(s.o*255).toString(16).padStart(2,'0')
        ctx.fillStyle = s.color+hex
        ctx.fill()
        // tiny glow
        ctx.beginPath()
        ctx.arc(s.x,s.y,s.r*2.5,0,Math.PI*2)
        ctx.fillStyle = s.color+'15'
        ctx.fill()
      })

      // Connections
      for(let i=0;i<stars.length;i++)
        for(let j=i+1;j<stars.length;j++){
          const dx=stars[i].x-stars[j].x,dy=stars[i].y-stars[j].y
          const d=Math.sqrt(dx*dx+dy*dy)
          if(d<110){
            ctx.beginPath()
            ctx.strokeStyle=`rgba(99,102,241,${0.08*(1-d/110)})`
            ctx.lineWidth=0.5
            ctx.moveTo(stars[i].x,stars[i].y)
            ctx.lineTo(stars[j].x,stars[j].y)
            ctx.stroke()
          }
        }
      raf = requestAnimationFrame(draw)
    }

    resize(); draw()
    window.addEventListener('resize',resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  },[])
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" />
}

// ─── Burst particles on type ──────────────────────────────────
const MAGIC_CHARS = ['✦','✧','⋆','★','◆','❋','⚡','🔮','✨','💫','⭐','🌟']

function useBursts() {
  const [bursts, setBursts] = useState<Burst[]>([])
  const idRef = useRef(0)

  const spawn = useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = rect.left + Math.random()*rect.width
    const y = rect.top + 8
    const newBursts: Burst[] = Array.from({length:4},()=>({
      id: ++idRef.current,
      x, y,
      char: MAGIC_CHARS[Math.floor(Math.random()*MAGIC_CHARS.length)],
      vx: (Math.random()-0.5)*3,
      vy: -(Math.random()*3+1.5),
      opacity: 1,
      size: Math.random()*12+10
    }))
    setBursts(prev => [...prev, ...newBursts])
    setTimeout(()=>{
      setBursts(prev=>prev.filter(b=>!newBursts.find(n=>n.id===b.id)))
    }, 1200)
  },[])

  return { bursts, spawn }
}

// ─── Rocket launch animation ──────────────────────────────────
function RocketLaunch({ onDone }: { onDone: () => void }) {
  const [pos, setPos] = useState({ x: window.innerWidth/2, y: window.innerHeight/2 })
  const [trail, setTrail] = useState<Array<{x:number;y:number;o:number}>>([])
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    let y = window.innerHeight/2
    const x = window.innerWidth/2
    const interval = setInterval(() => {
      y -= 18
      setPos({ x, y })
      setTrail(prev => [...prev.slice(-20), {x, y: y+30, o:0.8}])
      if (y < -100) { clearInterval(interval); setOpacity(0); setTimeout(onDone,300) }
    }, 16)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay flash */}
      <div className="absolute inset-0 bg-blue-900/30 animate-pulse" />
      {/* Trail */}
      {trail.map((t,i) => (
        <div key={i} className="absolute text-2xl" style={{
          left: t.x-12, top: t.y,
          opacity: (i/trail.length)*0.7,
          transform: `scale(${0.3+i/trail.length*0.7})`
        }}>🔥</div>
      ))}
      {/* Rocket */}
      <div className="absolute text-5xl transition-none" style={{
        left: pos.x-24, top: pos.y-24, opacity,
        filter: 'drop-shadow(0 0 20px #3b82f6) drop-shadow(0 0 40px #6366f1)',
        transform: 'rotate(-45deg)'
      }}>🚀</div>
    </div>
  )
}

// ─── Main Login ───────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [launching, setLaunching] = useState(false)
  const [mode, setMode] = useState<'login'|'forgot'>('login')
  const [forgotSent, setForgotSent] = useState(false)
  const [focused, setFocused] = useState<'email'|'pass'|null>(null)

  const emailRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const { bursts, spawn } = useBursts()

  useEffect(() => {
    supabase.auth.getSession().then(({data})=>{
      if(data.session) router.replace('/')
    })
  },[])

  // Floating burst effect
  useEffect(() => {
    const t = setInterval(()=>{
      if(focused==='email') spawn(emailRef.current)
      if(focused==='pass') spawn(passRef.current)
    }, 300)
    return ()=>clearInterval(t)
  },[focused, spawn])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setLaunching(true)
    } catch(err:any) {
      const m = err.message||''
      if(m.includes('Invalid login')) setError('Email o contraseña incorrectos.')
      else setError('Error al ingresar. Intenta de nuevo.')
      setLoading(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email,{
        redirectTo: `${window.location.origin}/internal/reset-password`
      })
      if(error) throw error
      setForgotSent(true)
    } catch { setError('No se pudo enviar el correo.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0a0f2e] to-[#020617] flex items-center justify-center px-4 overflow-hidden">
      <StarField />

      {/* Burst particles on type */}
      {bursts.map(b => (
        <div key={b.id} className="fixed z-40 pointer-events-none select-none"
          style={{
            left: b.x, top: b.y,
            fontSize: b.size,
            opacity: b.opacity,
            animation: 'floatUp 1.2s ease-out forwards',
            transform: `translateX(${b.vx*20}px)`
          }}>
          {b.char}
        </div>
      ))}

      {/* Rocket */}
      {launching && <RocketLaunch onDone={()=>{
        // Si hay una URL destino guardada, ir allí; sino al dashboard
        const params = new URLSearchParams(window.location.search)
        const next = params.get('next') || '/'
        router.replace(next)
      }} />}

      {/* Glow orbs */}
      <div className="fixed top-10 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed bottom-10 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" style={{animationDelay:'1s',animation:'pulse 4s ease-in-out infinite'}} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo — prominente */}
        <div className="text-center mb-8">
          <div className="inline-block relative mb-5">
            {/* Rotating ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/40 animate-spin" style={{animationDuration:'8s',borderStyle:'dashed'}} />
            {/* Pulsing glow */}
            <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl shadow-blue-600/50 flex items-center justify-center">
              <img src="/logo.png" alt="WebScan"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display='none' }}
              />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight" style={{textShadow:'0 0 40px rgba(59,130,246,0.5)'}}>
            WebScan
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            <span className="text-blue-400">✦</span> by TurboBrand Colombia <span className="text-blue-400">✦</span>
          </p>
        </div>

        {/* Card glassmorphism */}
        <div className="relative">
          {/* Card glow border */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/30 via-purple-500/20 to-cyan-500/30 rounded-3xl blur-sm" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

            {mode === 'login' ? (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white">Bienvenido de vuelta</h2>
                  <p className="text-slate-400 text-sm mt-1">Escribe y observa la magia ✨</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                      Correo electrónico
                    </label>
                    <div className={`relative transition-all duration-300 ${focused==='email' ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]' : ''}`}>
                      <input
                        ref={emailRef}
                        id="email"
                        type="email"
                        required
                        value={email}
                        onFocus={()=>setFocused('email')}
                        onBlur={()=>setFocused(null)}
                        onChange={e=>{ setEmail(e.target.value); if(focused==='email') spawn(emailRef.current) }}
                        placeholder="tu@correo.com"
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-blue-950/20 transition-all"
                      />
                      {focused==='email' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 animate-bounce text-lg">✦</div>
                      )}
                    </div>
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                      Contraseña
                    </label>
                    <div className={`relative transition-all duration-300 ${focused==='pass' ? 'drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]' : ''}`}>
                      <input
                        ref={passRef}
                        id="password"
                        type="password"
                        required
                        value={password}
                        onFocus={()=>setFocused('pass')}
                        onBlur={()=>setFocused(null)}
                        onChange={e=>{ setPassword(e.target.value); if(focused==='pass') spawn(passRef.current) }}
                        placeholder="••••••••"
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-950/20 transition-all"
                      />
                      {focused==='pass' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 animate-bounce text-lg">⋆</div>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                      <span>⚠️</span> {error}
                    </div>
                  )}

                  {/* Login button */}
                  <button
                    id="login-btn"
                    type="submit"
                    disabled={loading || launching}
                    className="w-full relative overflow-hidden py-4 px-6 font-bold rounded-xl text-white transition-all disabled:opacity-50 group"
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)',
                      boxShadow: '0 0 30px rgba(99,102,241,0.4), 0 4px 20px rgba(0,0,0,0.4)'
                    }}
                  >
                    {/* Shimmer */}
                    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verificando...
                      </span>
                    ) : launching ? (
                      <span className="flex items-center justify-center gap-2">🚀 ¡Despegando!</span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Ingresar al sistema <span className="text-xl">→</span>
                      </span>
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    onClick={()=>{ setMode('forgot'); setError('') }}
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white">Recuperar acceso</h2>
                  <p className="text-slate-400 text-sm mt-1">Te enviamos un link mágico 🔮</p>
                </div>

                {forgotSent ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4 animate-bounce">📬</div>
                    <p className="text-green-400 font-bold text-lg">¡Correo enviado!</p>
                    <p className="text-slate-400 text-sm mt-2">Revisa tu bandeja de entrada.</p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Correo</label>
                      <input
                        type="email" required value={email}
                        onChange={e=>setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-all"
                      />
                    </div>
                    {error && <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">⚠️ {error}</div>}
                    <button type="submit" disabled={loading}
                      className="w-full py-4 font-bold rounded-xl text-white disabled:opacity-50"
                      style={{ background:'linear-gradient(135deg,#2563eb,#7c3aed)', boxShadow:'0 0 30px rgba(99,102,241,0.3)' }}>
                      {loading ? 'Enviando...' : '✉️ Enviar link de recuperación'}
                    </button>
                  </form>
                )}

                <div className="mt-5 text-center">
                  <button onClick={()=>{ setMode('login'); setError(''); setForgotSent(false) }}
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                    ← Volver al login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          © 2026 TurboBrand Colombia · <a href="https://turbobrandcol.com" className="hover:text-slate-500 transition-colors">turbobrandcol.com</a>
        </p>
      </div>

      <style jsx global>{`
        @keyframes floatUp {
          0%   { opacity:1; transform: translateY(0) scale(1); }
          100% { opacity:0; transform: translateY(-80px) scale(0.5) rotate(20deg); }
        }
      `}</style>
    </div>
  )
}
