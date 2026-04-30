# WebScan - Sistema de Auditoría Web TurboBrand

## 🎯 Descripción
Sistema interno de TurboBrand para generar auditorías web automatizadas con IA. Analiza dominios y genera reportes profesionales para clientes.

## 🏗️ Arquitectura

```
turbobrandcol.com                    → Sitio principal
webscan.turbobrandcol.com            → App interna (protegida)
auditoria.turbobrandcol.com/[slug]   → Reportes públicos
```

## 📦 Estructura del Proyecto

```
webscan/
├── frontend/              # Next.js 15 + Tailwind
│   ├── app/              
│   │   ├── (internal)/   # webscan.turbobrandcol.com
│   │   └── (public)/     # auditoria.turbobrandcol.com
│   ├── components/
│   ├── lib/
│   └── public/
├── backend/              # Railway Worker (Node.js)
│   ├── src/
│   │   ├── analyzer/     # Motor de análisis
│   │   ├── ai/           # Integración Claude API
│   │   └── workers/      # Queue processing
│   └── Dockerfile
├── database/             # Supabase
│   ├── schema.sql
│   └── migrations/
└── docs/                 # Documentación
```

## 🚀 Stack Tecnológico

- **Frontend:** Next.js 15, React, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express, BullMQ
- **Database:** Supabase (PostgreSQL)
- **Worker:** Puppeteer, Lighthouse, Cheerio
- **IA:** Claude API (Anthropic)
- **Deploy:** Vercel (frontend) + Railway (backend worker)
- **Auth:** Supabase Auth

## ⚙️ Variables de Entorno

### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key
BACKEND_WORKER_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Backend (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key
REDIS_URL=redis://localhost:6379
PORT=4000
```

## 📥 Instalación

### 1. Clonar y Setup
```bash
cd webscan/frontend
npm install

cd ../backend
npm install
```

### 2. Configurar Supabase
```bash
# Ejecutar schema en tu proyecto Supabase
psql -h your-supabase-host -U postgres -d postgres -f database/schema.sql
```

### 3. Configurar variables de entorno
```bash
# Copiar y editar .env.example
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

### 4. Ejecutar en desarrollo
```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend Worker
cd backend
npm run dev
```

## 🎨 Subdominios (Vercel Config)

En tu proyecto Vercel de turbobrandcol.com:

### vercel.json
```json
{
  "routes": [
    {
      "src": "/webscan/(.*)",
      "dest": "/"
    },
    {
      "src": "/auditoria/(.*)",
      "dest": "/"
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

### Dominios en Vercel:
1. `webscan.turbobrandcol.com` → `/app/(internal)`
2. `auditoria.turbobrandcol.com` → `/app/(public)`

## 📊 Base de Datos

### Tablas principales:

1. **audits** - Auditorías realizadas
2. **audit_categories** - Categorías (Performance, SEO, etc)
3. **audit_issues** - Issues específicos detectados
4. **audit_recommendations** - Recomendaciones generadas por IA

Ver `database/schema.sql` para schema completo.

## 🔄 Flow de Auditoría

```
1. Usuario entra a webscan.turbobrandcol.com
2. Ingresa dominio + nombre cliente
3. Frontend crea registro en Supabase (status: 'processing')
4. Frontend llama a Backend Worker API
5. Worker ejecuta análisis:
   - Lighthouse (performance)
   - Puppeteer (crawling)
   - Cheerio (SEO tags)
   - Security checks
6. Worker envía resultados a Claude API para:
   - Explicaciones personalizadas
   - Recomendaciones priorizadas
   - Análisis de impacto
7. Worker guarda resultados en Supabase
8. Frontend genera landing pública en:
   auditoria.turbobrandcol.com/[slug]
```

## 🧩 Módulos de Análisis

### Performance (Lighthouse)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Speed Index

### SEO
- Meta tags (title, description)
- Headings structure
- Open Graph tags
- Schema.org markup
- robots.txt
- sitemap.xml
- Canonical tags
- Mobile-friendly

### Seguridad
- SSL/HTTPS
- Security headers
- Mixed content
- XSS vulnerabilities básicas

### UX/Usabilidad
- Responsive design
- Contraste de colores
- Formularios accesibles
- Links rotos (404)

## 🤖 Integración IA (Claude)

El sistema usa Claude API para:

1. **Explicar issues técnicos en lenguaje simple**
```javascript
Input: "meta-description missing"
Output: "Tu página no tiene descripción para Google. 
         Esto reduce 30% los clics desde búsquedas."
```

2. **Generar recomendaciones priorizadas**
- Ordena por impacto vs esfuerzo
- Crea plan de acción en fases

3. **Análisis de contenido**
- Evalúa claridad del mensaje
- Detecta CTAs
- Valora trust signals

## 📱 Endpoints API

### Backend Worker

```
POST /api/analyze
Body: { domain: string, auditId: string }
Response: { status: 'processing' }

GET /api/analyze/:auditId
Response: { status: 'completed', results: {...} }

GET /health
Response: { status: 'ok' }
```

## 🎯 Roadmap

### v1.0 (MVP - 4 semanas) ✅
- [x] Sistema básico de análisis
- [x] Dashboard interno
- [x] Landing pública de reportes
- [x] Integración IA

### v1.1 (Mejoras)
- [ ] Descarga PDF del reporte
- [ ] Comparativas antes/después
- [ ] Historial de auditorías por cliente
- [ ] Alertas por email

### v2.0 (Avanzado)
- [ ] Monitoreo continuo (re-análisis automático)
- [ ] Análisis de competencia
- [ ] Integración con Google Analytics
- [ ] API pública para integraciones

## 🔐 Seguridad

- Auth con Supabase (Row Level Security)
- API Keys para backend worker
- Rate limiting en endpoints públicos
- CORS configurado para dominios TurboBrand
- Sanitización de inputs

## 📄 Licencia

Uso interno exclusivo de TurboBrand.
Prohibida distribución o uso comercial externo.

## 👥 Equipo

Desarrollado por: Ing. Cristhian Salguero
Para: TurboBrand Colombia
Año: 2026

---

**Contacto:**
- Web: turbobrandcol.com
- Email: info@turbobrandcol.com
