# Guía de Deployment - WebScan

## 🚀 Deployment en Producción

### 1. Frontend (Vercel)

#### Setup Inicial
```bash
cd frontend
vercel login
vercel
```

#### Variables de Entorno en Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
ANTHROPIC_API_KEY=sk-ant-api03-tu_key
BACKEND_WORKER_URL=https://tu-worker.railway.app
NEXT_PUBLIC_APP_URL=https://turbobrandcol.com
NEXT_PUBLIC_WEBSCAN_URL=https://webscan.turbobrandcol.com
NEXT_PUBLIC_AUDIT_URL=https://auditoria.turbobrandcol.com
```

#### Configurar Dominios en Vercel
1. Ve a tu proyecto en Vercel → Settings → Domains
2. Agrega los siguientes dominios:
   - `turbobrandcol.com` (si no lo tienes ya)
   - `webscan.turbobrandcol.com`
   - `auditoria.turbobrandcol.com`

#### DNS (en tu proveedor de dominio)
Agrega estos registros CNAME:
```
webscan.turbobrandcol.com    CNAME    cname.vercel-dns.com
auditoria.turbobrandcol.com  CNAME    cname.vercel-dns.com
```

---

### 2. Backend Worker (Railway)

#### Setup Inicial
```bash
cd backend

# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init

# Link proyecto
railway link
```

#### Variables de Entorno en Railway
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
ANTHROPIC_API_KEY=sk-ant-api03-tu_key
REDIS_URL=redis://default:password@redis.railway.internal:6379
PORT=4000
NODE_ENV=production
ALLOWED_ORIGINS=https://turbobrandcol.com,https://webscan.turbobrandcol.com
```

#### Agregar Redis en Railway
1. En Railway Dashboard → New → Database → Redis
2. Conectar al proyecto
3. Copiar REDIS_URL a variables de entorno

#### Deploy
```bash
railway up
```

#### Obtener URL del Worker
```bash
railway domain
```
Copia la URL y úsala como `BACKEND_WORKER_URL` en el frontend

---

### 3. Base de Datos (Supabase)

#### Setup
1. Ve a [supabase.com](https://supabase.com)
2. Crea nuevo proyecto (o usa existente de TurboBrand)
3. Ve a SQL Editor
4. Ejecuta el contenido de `database/schema.sql`

#### Obtener Credenciales
En Project Settings → API:
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: anon public
- `SUPABASE_SERVICE_ROLE_KEY`: service_role (⚠️ secreto)

---

## 🔄 Workflow de Deploy

### Desarrollo Local
```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

### Deploy a Producción
```bash
# Frontend (Vercel auto-deploys desde Git)
git push origin main

# Backend (Railway)
cd backend
railway up
```

---

## 🧪 Testing Post-Deploy

### 1. Health Check Backend
```bash
curl https://tu-worker.railway.app/health
```
Debe responder:
```json
{
  "status": "ok",
  "timestamp": "2026-04-30T...",
  "uptime": 123.45,
  ...
}
```

### 2. Test Análisis Completo
```bash
# Crear auditoría desde frontend
https://webscan.turbobrandcol.com

# O via API
curl -X POST https://tu-worker.railway.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "auditId": "uuid-desde-supabase",
    "domain": "ejemplo.com",
    "analysisType": "complete"
  }'
```

### 3. Ver Reporte Público
```
https://auditoria.turbobrandcol.com/a/[slug]
```

---

## 🔐 Seguridad

### Secrets que NUNCA commitear:
- ❌ `SUPABASE_SERVICE_ROLE_KEY`
- ❌ `ANTHROPIC_API_KEY`
- ❌ `.env` files

### Usar .gitignore
```
.env
.env.local
.env.production
node_modules/
.next/
```

---

## 📊 Monitoreo

### Logs Backend (Railway)
```bash
railway logs
```

### Logs Frontend (Vercel)
Dashboard → Deployments → [latest] → Logs

### Supabase
Dashboard → Logs → Todos los queries

---

## 🆘 Troubleshooting

### Error: "Cannot connect to Supabase"
- Verifica que las credenciales sean correctas
- Revisa RLS policies en Supabase
- Chequea que el service_role_key esté en backend

### Error: "Lighthouse failed"
- Aumenta timeout en Railway: 10 minutos
- Verifica que Chrome se instale correctamente en Docker

### Error: "AI processing failed"
- Verifica ANTHROPIC_API_KEY
- Chequea límites de rate en Anthropic console

### Frontend no se conecta a Backend
- Verifica CORS en backend
- Confirma BACKEND_WORKER_URL en frontend
- Chequea que Railway app esté corriendo

---

## 📈 Escalabilidad

### Si crece el tráfico:

1. **Railway**: Upgrade plan para más CPU/RAM
2. **Vercel**: Automáticamente escala
3. **Supabase**: Considera upgrade si > 500 auditorías/día
4. **Redis**: Habilita persistencia en Railway

### Optimizaciones:
- Cachear resultados de Lighthouse (24h)
- Queue system con BullMQ (ya incluido)
- CDN para reportes estáticos

---

## 🎯 Checklist Pre-Launch

- [ ] Schema SQL ejecutado en Supabase
- [ ] Frontend deployed en Vercel
- [ ] Backend deployed en Railway
- [ ] Dominios configurados (webscan, auditoria)
- [ ] Variables de entorno configuradas
- [ ] Health checks pasando
- [ ] Test de auditoría completa exitoso
- [ ] Reporte público accesible
- [ ] Logs monitoreados

---

**¿Problemas?** 
Contacta a Ing. Cristhian Salguero
Email: info@turbobrandcol.com
