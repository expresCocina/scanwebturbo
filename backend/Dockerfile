# WebScan Backend — Railway Deploy
# Usa la imagen oficial de Puppeteer que ya incluye Chromium
FROM ghcr.io/puppeteer/puppeteer:21.11.0

# Railway usa el usuario pptruser por defecto en esta imagen
WORKDIR /app

# Copiar dependencias
COPY --chown=pptruser:pptruser package*.json ./

# Instalar solo producción (sin devDependencies)
RUN npm ci --only=production --ignore-scripts

# Copiar código fuente
COPY --chown=pptruser:pptruser src/ ./src/

# Puerto que Railway expone
EXPOSE 4000

# Puppeteer ya tiene Chromium en esta imagen
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Inicio
CMD ["node", "src/index.js"]
