# 🚀 Quick Start - WebScan

## Setup Rápido (5 minutos)

### 1. Instalar Dependencias
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Configurar Supabase

1. Crea proyecto en [supabase.com](https://supabase.com)
2. Ejecuta `database/schema.sql` en SQL Editor
3. Copia credenciales de Project Settings → API

### 3. Obtener Claude API Key

1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Get API Keys → Create Key
3. Copia la key

### 4. Configurar Variables

**Frontend (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_key_aqui
ANTHROPIC_API_KEY=sk-ant-api03-tu_key_aqui
BACKEND_WORKER_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Backend (.env):**
```env
SUPABASE_URL=tu_url_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_key_aqui
ANTHROPIC_API_KEY=sk-ant-api03-tu_key_aqui
REDIS_URL=redis://localhost:6379
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

### 5. Ejecutar

**Terminal 1:**
```bash
cd frontend
npm run dev
```

**Terminal 2:**
```bash
cd backend
npm run dev
```

### 6. Probar

1. Abre http://localhost:3000
2. Click "Nueva Auditoría"
3. Ingresa dominio: `example.com`
4. Espera 2-5 minutos
5. ✅ Listo!

---

## 📚 Documentación Completa

- **Setup Local Completo**: Ver `LOCAL_DEVELOPMENT.md`
- **Deploy a Producción**: Ver `DEPLOYMENT.md`
- **Arquitectura y Detalles**: Ver `README.md`

---

## ⚠️ Problemas Comunes

**Error "Cannot connect to Supabase"**
→ Verifica las credenciales en .env

**Error "Backend not responding"**
→ Asegúrate de que backend esté corriendo en :4000

**Error "Lighthouse failed"**
→ El dominio debe ser accesible públicamente

---

## 🎯 Siguiente Paso

Una vez funcionando local → Lee `DEPLOYMENT.md` para subir a producción

**TurboBrand Colombia** 🇨🇴
