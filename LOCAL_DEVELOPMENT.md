# Guía de Desarrollo Local - WebScan

## 🛠️ Setup Inicial (Primera Vez)

### Prerequisitos
Asegúrate de tener instalado:
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- Git
- Editor de código (VS Code recomendado)

### 1. Clonar o Abrir Proyecto
```bash
# Si es un repo nuevo
git init
git add .
git commit -m "Initial commit - WebScan"

# Abrir en VS Code
code .
```

### 2. Configurar Supabase

#### Crear Proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. "New Project"
   - Name: `webscan-turbobrand`
   - Database Password: (guarda esto)
   - Region: South America (São Paulo)
4. Espera 2-3 minutos a que se cree

#### Ejecutar Schema
1. En Supabase Dashboard → SQL Editor
2. Copia todo el contenido de `database/schema.sql`
3. Pega y ejecuta ("Run")
4. Verifica que las tablas se crearon: Table Editor

#### Obtener Credenciales
En Project Settings → API, copia:
- `URL` → Para SUPABASE_URL
- `anon public` → Para SUPABASE_ANON_KEY
- `service_role` → Para SUPABASE_SERVICE_ROLE_KEY ⚠️

### 3. Obtener API Key de Anthropic (Claude)

1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Crea cuenta o inicia sesión
3. Get API Keys → Create Key
4. Copia la key (sk-ant-api03-...)
5. Guárdala en lugar seguro

### 4. Configurar Variables de Entorno

#### Frontend
```bash
cd frontend
cp .env.example .env.local
```

Edita `.env.local` con tus valores reales:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-api03-...
BACKEND_WORKER_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Backend
```bash
cd ../backend
cp .env.example .env
```

Edita `.env` con tus valores reales:
```env
SUPABASE_URL=https://tuproyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-api03-...
REDIS_URL=redis://localhost:6379
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

### 5. Instalar Dependencias

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd ../backend
npm install
```

### 6. Instalar Redis (Opcional para desarrollo)

#### macOS
```bash
brew install redis
brew services start redis
```

#### Windows
Descarga desde [redis.io/download](https://redis.io/download) o usa Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

---

## 🚀 Ejecutar en Desarrollo

### Opción 1: Dos Terminales (Recomendado)

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
```
Abre: http://localhost:3000

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```
Backend corriendo en: http://localhost:4000

### Opción 2: VS Code Tasks

Presiona `Cmd/Ctrl + Shift + P` → "Tasks: Run Task" → "Start All"

---

## 🧪 Testing Local

### 1. Verificar Backend
```bash
curl http://localhost:4000/health
```
Debe responder JSON con `"status": "ok"`

### 2. Crear Primera Auditoría

1. Abre http://localhost:3000
2. Click "Nueva Auditoría"
3. Ingresa dominio: `example.com`
4. Click "Iniciar Auditoría"
5. Espera 2-5 minutos
6. Debe aparecer en dashboard con score

### 3. Ver Logs

**Frontend (terminal):**
Verás los requests y errores

**Backend (terminal):**
```
[uuid] Iniciando análisis de example.com
[uuid] Analizando Performance...
[uuid] Analizando SEO...
[uuid] Procesamiento IA completado
[uuid] Auditoría completada exitosamente
```

---

## 📁 Estructura del Proyecto

```
webscan/
├── frontend/               # Next.js app
│   ├── app/               # Pages
│   │   ├── page.tsx      # Dashboard principal
│   │   └── internal/
│   │       └── new/
│   │           └── page.tsx  # Nueva auditoría
│   ├── components/        # Componentes React
│   │   └── ui/           # UI components
│   ├── lib/              # Utilidades
│   │   ├── supabase/     # Cliente Supabase
│   │   └── utils.ts      # Helpers
│   └── package.json
│
├── backend/               # Worker Node.js
│   ├── src/
│   │   ├── analyzer/     # WebAnalyzer.js (Lighthouse + Puppeteer)
│   │   ├── ai/           # AIProcessor.js (Claude API)
│   │   ├── routes/       # Express routes
│   │   └── index.js      # Server principal
│   ├── Dockerfile        # Para Railway
│   └── package.json
│
├── database/
│   └── schema.sql        # Schema completo Supabase
│
├── README.md             # Documentación principal
├── DEPLOYMENT.md         # Guía de deployment
└── LOCAL_DEVELOPMENT.md  # Este archivo
```

---

## 🐛 Debugging

### Frontend no carga
1. Verifica que `npm run dev` esté corriendo
2. Chequea `.env.local` existe y tiene valores correctos
3. Limpia cache: `rm -rf .next && npm run dev`

### Backend no responde
1. Verifica puerto 4000 esté libre: `lsof -i :4000`
2. Chequea `.env` tiene valores correctos
3. Verifica Supabase credentials son correctas

### Error "Cannot connect to database"
1. Verifica SUPABASE_URL es correcto
2. Chequea que schema.sql se ejecutó
3. Verifica RLS policies en Supabase

### Error "Lighthouse failed"
1. Verifica dominio es accesible públicamente
2. Chequea que Chrome/Chromium esté instalado
3. Aumenta timeout si el sitio es lento

### Error "AI processing failed"
1. Verifica ANTHROPIC_API_KEY es correcta
2. Chequea que tienes créditos en Anthropic
3. Revisa logs para ver error específico

---

## 💡 Tips de Desarrollo

### Hot Reload
Ambos frontend y backend tienen hot reload activado. Los cambios se reflejan automáticamente.

### Ver Base de Datos
Usa Supabase Dashboard → Table Editor para ver datos en tiempo real.

### Debug API Calls
Abre DevTools → Network para ver requests entre frontend y backend.

### Limpiar Todo y Empezar de Nuevo
```bash
# Frontend
cd frontend
rm -rf node_modules .next
npm install
npm run dev

# Backend
cd backend
rm -rf node_modules
npm install
npm run dev
```

---

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Puppeteer Docs](https://pptr.dev)
- [Lighthouse Docs](https://developer.chrome.com/docs/lighthouse)

---

## ✅ Checklist Desarrollo

- [ ] Node.js 18+ instalado
- [ ] Proyecto Supabase creado
- [ ] Schema SQL ejecutado
- [ ] API Key de Anthropic obtenida
- [ ] `.env.local` configurado (frontend)
- [ ] `.env` configurado (backend)
- [ ] Redis corriendo (opcional)
- [ ] `npm install` en frontend ✅
- [ ] `npm install` en backend ✅
- [ ] Frontend corriendo en :3000
- [ ] Backend corriendo en :4000
- [ ] Primera auditoría exitosa

---

**¿Necesitas ayuda?**

Revisa los logs, busca el error en Google, o contacta a:
- Email: info@turbobrandcol.com
- Desarrollador: Ing. Cristhian Salguero
