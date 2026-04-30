# WebScan Backend — Railway Deploy
# Usa Node.js con Chrome instalado via apt (más confiable en Railway)
FROM node:18-bullseye-slim

# Instalar Chrome y dependencias necesarias para Puppeteer y Lighthouse
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxshmfence1 \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar e instalar dependencias (sin descargar Chromium de Puppeteer)
COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN npm install --omit=dev --ignore-scripts

# Copiar código fuente
COPY src/ ./src/

# Puerto
EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
