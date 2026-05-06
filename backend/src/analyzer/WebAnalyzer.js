const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

const PUPPETEER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox',
  '--disable-dev-shm-usage', '--disable-gpu',
  '--disable-extensions', '--disable-background-networking'
];

class WebAnalyzer {
  constructor(domain) {
    this.domain = this.cleanDomain(domain);
    this.url = `https://${this.domain}`;
    this._psiCache = null;
  }

  cleanDomain(domain) {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }

  async analyze(type = 'complete') {
    console.log(`Analizando ${this.url}...`);

    const results = {
      domain: this.domain,
      url: this.url,
      categories: {},
      issues: [],
      screenshot: null,
      timestamp: new Date().toISOString()
    };

    try {
      // Fetch PageSpeed data once and reuse
      this._psiCache = await this._fetchPageSpeed('mobile');

      // Parallel: screenshot + SEO + security
      const [screenshot, seoData, securityData] = await Promise.all([
        this.takeScreenshot(),
        this.analyzeSEO(),
        this.analyzeSecurity()
      ]);

      results.screenshot = screenshot;

      // Performance uses PSI cache
      const performanceData = await this.analyzePerformance();
      results.categories.performance = performanceData;

      // Accessibility from PSI
      const accessibilityData = await this.analyzeAccessibility();
      results.categories.accessibility = accessibilityData;

      results.categories.seo = seoData;
      results.categories.security = securityData;

      const uxData = await this.analyzeUX();
      results.categories.ux = uxData;

      results.issues = this.collectAllIssues(results.categories);

    } catch (error) {
      console.error('Error en análisis:', error);
      throw error;
    }

    return results;
  }

  // =====================================================
  // PAGE SPEED INSIGHTS - single fetch, reused
  // =====================================================
  async _fetchPageSpeed(strategy = 'mobile') {
    let url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(this.url)}&strategy=${strategy}`;
    if (process.env.PAGESPEED_API_KEY) {
      url += `&key=${process.env.PAGESPEED_API_KEY}`;
    }
    const res = await axios.get(url, { timeout: 70000 });
    return res.data;
  }

  // =====================================================
  // SCREENSHOT
  // =====================================================
  async takeScreenshot() {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: PUPPETEER_ARGS
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });
      const shot = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
      await browser.close();
      return `data:image/jpeg;base64,${shot.toString('base64')}`;
    } catch (e) {
      console.error('Screenshot error:', e.message);
      return null;
    }
  }

  // =====================================================
  // PERFORMANCE
  // =====================================================
  async analyzePerformance() {
    console.log('Analizando Performance...');

    if (!this._psiCache) {
      try { this._psiCache = await this._fetchPageSpeed('mobile'); } catch (_) {}
    }

    if (!this._psiCache) return await this._httpPerformance();

    if (this._psiCache.__rateLimited) {
      return {
        score: 0,
        metrics: {},
        issues: [{
          category: 'performance', severity: 'critico',
          title: 'Límite de Google PageSpeed excedido',
          description: 'El servidor alcanzó el límite de consultas gratuitas a la API de Google PageSpeed. Configura una API key para continuar.',
          howToFix: 'Agrega la variable PAGESPEED_API_KEY en tu servidor con tu clave de Google Cloud Console.',
          impact: 'No se puede medir la velocidad real hasta configurar la clave.'
        }],
        recommendations: []
      };
    }

    try {
      const lhr = this._psiCache.lighthouseResult;
      const audits = lhr.audits;

      const perfScore = Math.round((lhr.categories.performance?.score || 0) * 100);

      const fcpMs   = audits['first-contentful-paint']?.numericValue || 0;
      const lcpMs   = audits['largest-contentful-paint']?.numericValue || 0;
      const tbtMs   = audits['total-blocking-time']?.numericValue || 0;
      const clsVal  = audits['cumulative-layout-shift']?.numericValue || 0;
      const siMs    = audits['speed-index']?.numericValue || 0;
      const ttfbMs  = audits['server-response-time']?.numericValue || 0;
      const ttiMs   = audits['interactive']?.numericValue || 0;
      const totalBytes = audits['total-byte-weight']?.numericValue || 0;

      let jsCount = 0, imgCount = 0, resourceCount = 0;
      const resSummary = audits['resource-summary']?.details?.items;
      if (resSummary) {
        jsCount = resSummary.find(i => i.resourceType === 'Script')?.requestCount || 0;
        imgCount = resSummary.find(i => i.resourceType === 'Image')?.requestCount || 0;
        resourceCount = resSummary.reduce((a, c) => a + (c.requestCount || 0), 0);
      }

      void ttiMs;

      const issues = [];

      // FCP
      if (fcpMs > 1800) {
        const sev = fcpMs > 3000 ? 'critico' : 'alto';
        issues.push({
          category: 'performance', severity: sev,
          title: `Primer contenido visible tarda ${(fcpMs/1000).toFixed(1)}s (ideal: <1.8s)`,
          description: `El First Contentful Paint mide cuánto tarda en aparecer el primer texto o imagen. Tu sitio tarda ${(fcpMs/1000).toFixed(1)} segundos. Un segundo de retraso puede reducir conversiones hasta un 7%.`,
          howToFix: 'Elimina recursos que bloquean el renderizado, usa lazy loading para imágenes fuera de pantalla y sirve fuentes con font-display: swap.',
          impact: 'Google usa FCP como señal de experiencia. Sitios con FCP > 3s tienen tasas de rebote significativamente más altas.'
        });
      }

      // LCP
      if (lcpMs > 2500) {
        const sev = lcpMs > 4000 ? 'critico' : 'alto';
        issues.push({
          category: 'performance', severity: sev,
          title: `Elemento principal carga en ${(lcpMs/1000).toFixed(1)}s (Core Web Vital — ideal: <2.5s)`,
          description: `El Largest Contentful Paint es el Core Web Vital más importante para Google. Tu imagen o bloque de texto principal tarda ${(lcpMs/1000).toFixed(1)}s. Google penaliza sitios con LCP > 4s en el ranking.`,
          howToFix: 'Optimiza y pre-carga la imagen o elemento principal (usa <link rel="preload">), implementa CDN, comprime imágenes con WebP.',
          impact: 'LCP es factor directo de ranking en Google Search desde 2021. Mejorarlo puede subir posiciones inmediatamente.'
        });
      }

      // TBT
      if (tbtMs > 200) {
        const sev = tbtMs > 600 ? 'critico' : tbtMs > 300 ? 'alto' : 'medio';
        issues.push({
          category: 'performance', severity: sev,
          title: `Página bloqueada ${tbtMs}ms — los usuarios no pueden interactuar (ideal: <200ms)`,
          description: `El Total Blocking Time mide cuánto tiempo la página está "congelada" sin responder a clics. Tu sitio tiene ${tbtMs}ms de bloqueo, lo que significa que los botones y formularios no funcionan durante ese tiempo.`,
          howToFix: 'Divide el JavaScript pesado en chunks más pequeños, elimina código no usado, y difiere scripts de terceros (analytics, chat widgets).',
          impact: 'Un TBT alto frustra a los usuarios que intentan hacer clic en botones que aún no responden, aumentando la tasa de abandono.'
        });
      }

      // CLS
      if (clsVal > 0.1) {
        const sev = clsVal > 0.25 ? 'critico' : 'alto';
        issues.push({
          category: 'performance', severity: sev,
          title: `Los elementos saltan mientras carga — CLS de ${clsVal.toFixed(3)} (ideal: <0.1)`,
          description: `El Cumulative Layout Shift mide cuánto "brincan" los elementos mientras carga la página. Un CLS de ${clsVal.toFixed(3)} significa que el usuario puede hacer clic accidentalmente en el lugar equivocado mientras el contenido se reordena.`,
          howToFix: 'Define dimensiones width/height en imágenes y videos, reserva espacio para ads y banners, y evita insertar contenido dinámico sobre contenido existente.',
          impact: 'Un CLS alto es Core Web Vital que Google penaliza directamente en rankings. Los usuarios que hacen clic en el lugar equivocado abandonan frustrados.'
        });
      }

      // TTFB
      if (ttfbMs > 600) {
        issues.push({
          category: 'performance', severity: 'alto',
          title: `Servidor responde en ${Math.round(ttfbMs)}ms — muy lento (ideal: <600ms)`,
          description: `Tu servidor tarda ${Math.round(ttfbMs)}ms en empezar a responder. Esto se nota antes de que cargue cualquier contenido.`,
          howToFix: 'Activa caché del servidor, mejora tu plan de hosting, usa un CDN, o si es un sitio dinámico, optimiza las consultas a la base de datos.',
          impact: 'Google recomienda TTFB < 600ms para una buena experiencia. Un servidor lento arrastra todos los demás tiempos hacia arriba.'
        });
      }

      // Total weight
      if (totalBytes / 1024 > 2000) {
        const sev = totalBytes / 1024 > 5000 ? 'critico' : 'alto';
        issues.push({
          category: 'performance', severity: sev,
          title: `Página pesa ${Math.round(totalBytes/1024)}KB — demasiado pesada (ideal: <2000KB)`,
          description: `Tu sitio descarga ${Math.round(totalBytes/1024)}KB de datos. En redes móviles lentas esto puede tardar 10+ segundos en cargar completamente.`,
          howToFix: 'Comprime imágenes (usa TinyPNG o convierte a WebP), elimina plugins y scripts no utilizados, activa compresión GZIP/Brotli en el servidor.',
          impact: 'El 70% de los usuarios accede desde móvil. Una página pesada aumenta el tiempo de carga y la tasa de rebote directamente.'
        });
      }

      // Render-blocking resources
      const renderBlocking = audits['render-blocking-resources'];
      if (renderBlocking?.score !== null && renderBlocking?.score < 0.9 && renderBlocking?.details?.items?.length > 0) {
        const count = renderBlocking.details.items.length;
        const savings = renderBlocking.numericValue || 0;
        issues.push({
          category: 'performance', severity: 'alto',
          title: `${count} recurso${count > 1 ? 's' : ''} bloquea${count === 1 ? '' : 'n'} la carga inicial (ahorro potencial: ${Math.round(savings)}ms)`,
          description: `Hay ${count} archivo${count > 1 ? 's' : ''} CSS o JavaScript que deben descargarse y ejecutarse antes de que el usuario vea algo en pantalla. Esto genera un retraso innecesario de hasta ${Math.round(savings)}ms.`,
          howToFix: 'Mueve los scripts de JavaScript al final del body o agrégales el atributo "defer". Los estilos críticos pueden incrustarse directamente en el HTML.',
          impact: `Eliminar estos bloqueos puede reducir el tiempo de carga visible en hasta ${Math.round(savings/1000 * 10) / 10}s.`
        });
      }

      // Unused JavaScript
      const unusedJs = audits['unused-javascript'];
      if (unusedJs?.score !== null && unusedJs?.score < 0.9 && unusedJs?.details?.items?.length > 0) {
        const wastedBytes = unusedJs.numericValue || 0;
        issues.push({
          category: 'performance', severity: 'medio',
          title: `JavaScript no utilizado: ${Math.round(wastedBytes/1024)}KB desperdiciados`,
          description: `Tu sitio carga ${Math.round(wastedBytes/1024)}KB de código JavaScript que nunca se ejecuta. El navegador descarga y procesa este código inútilmente en cada visita.`,
          howToFix: 'Revisa qué plugins o bibliotecas son realmente necesarios. Implementa code-splitting para cargar solo el código necesario en cada página.',
          impact: `Eliminar este código reduciría el tiempo de carga en hasta ${Math.round(wastedBytes/1024 / 50 * 10) / 10}s en conexiones lentas.`
        });
      }

      // Unused CSS
      const unusedCss = audits['unused-css-rules'];
      if (unusedCss?.score !== null && unusedCss?.score < 0.9 && unusedCss?.details?.items?.length > 0) {
        const wastedBytes = unusedCss.numericValue || 0;
        if (wastedBytes > 20 * 1024) {
          issues.push({
            category: 'performance', severity: 'bajo',
            title: `CSS no utilizado: ${Math.round(wastedBytes/1024)}KB de estilos innecesarios`,
            description: `El sitio carga ${Math.round(wastedBytes/1024)}KB de estilos CSS que no se aplican a ningún elemento visible. Esto es desperdicio de ancho de banda.`,
            howToFix: 'Usa herramientas como PurgeCSS para eliminar estilos no utilizados. En WordPress, desactiva CSS de plugins inactivos.',
            impact: 'Reducir CSS no usado mejora el tiempo de parseo y acelera la visualización inicial.'
          });
        }
      }

      // Images not optimized
      const modernImages = audits['uses-webp-images'] || audits['modern-image-formats'];
      if (modernImages?.score !== null && modernImages?.score < 0.9 && (modernImages?.numericValue || 0) > 50000) {
        const savings = modernImages.numericValue || 0;
        issues.push({
          category: 'performance', severity: 'medio',
          title: `Imágenes sin optimizar — ahorro potencial de ${Math.round(savings/1024)}KB`,
          description: `Las imágenes del sitio no están en formatos modernos (WebP/AVIF). Convertirlas puede reducir el peso un 25–35% sin perder calidad visible.`,
          howToFix: 'Convierte las imágenes a formato WebP usando Squoosh, TinyPNG o el plugin de tu CMS. Los navegadores modernos lo soportan al 95%.',
          impact: `Se pueden ahorrar ${Math.round(savings/1024)}KB, acelerando la carga especialmente en móviles.`
        });
      }

      // Text compression
      const textComp = audits['uses-text-compression'];
      if (textComp?.score !== null && textComp?.score < 0.9 && (textComp?.numericValue || 0) > 10000) {
        issues.push({
          category: 'performance', severity: 'alto',
          title: 'El servidor no comprime texto (GZIP/Brotli desactivado)',
          description: 'Tu servidor envía HTML, CSS y JavaScript sin comprimir. Activar compresión GZIP o Brotli puede reducir el tamaño de transferencia entre un 60–80%.',
          howToFix: 'En cPanel activa "Enable GZIP Compression". En Nginx: gzip on; En Apache: agregar mod_deflate. La mayoría de hostings lo ofrecen con un clic.',
          impact: `Ahorro potencial de ${Math.round((textComp.numericValue||0)/1024)}KB en cada visita — carga notablemente más rápida en móviles.`
        });
      }

      // Cache policy
      const cacheAudit = audits['uses-long-cache-ttl'];
      if (cacheAudit?.score !== null && cacheAudit?.score < 0.9 && cacheAudit?.details?.items?.length > 3) {
        const count = cacheAudit.details.items.length;
        issues.push({
          category: 'performance', severity: 'bajo',
          title: `${count} recursos sin caché configurada — los visitantes recurrentes los descargan otra vez`,
          description: `${count} archivos (imágenes, scripts, CSS) no tienen política de caché. Esto significa que cada vez que alguien visita tu sitio, el navegador descarga todos los archivos desde cero.`,
          howToFix: 'Configura Cache-Control headers en tu servidor. Para recursos estáticos, usa max-age=31536000 (1 año). La mayoría de plugins de caché de WordPress lo hacen automáticamente.',
          impact: 'Los visitantes recurrentes experimentarán cargas mucho más rápidas una vez configurada la caché correctamente.'
        });
      }

      // Speed Index
      if (siMs > 3400) {
        issues.push({
          category: 'performance', severity: siMs > 5800 ? 'alto' : 'medio',
          title: `Speed Index de ${(siMs/1000).toFixed(1)}s — el sitio se llena lentamente (ideal: <3.4s)`,
          description: `El Speed Index mide qué tan rápido se va llenando visualmente la pantalla. Un valor de ${(siMs/1000).toFixed(1)}s significa que el usuario ve la página construirse en pantalla de forma lenta.`,
          howToFix: 'Optimiza el orden de carga del CSS crítico (above-the-fold), reduce el número de solicitudes de red y usa pre-loading para recursos importantes.',
          impact: 'Un Speed Index alto hace que la experiencia visual se sienta lenta aunque la página esté "técnicamente" cargada.'
        });
      }

      const formattedMetrics = {
        fcp: fcpMs, lcp: lcpMs, tbt: tbtMs, cls: clsVal,
        speedIndex: siMs, ttfb: ttfbMs,
        totalTransferKB: Math.round(totalBytes / 1024),
        jsCount, imgCount, resourceCount,
        perfScore
      };

      return { score: perfScore, metrics: formattedMetrics, issues, recommendations: [] };

    } catch (err) {
      console.warn('Error procesando PSI:', err.message);
      return await this._httpPerformance();
    }
  }

  async _httpPerformance() {
    const start = Date.now();
    try {
      const res = await axios.get(this.url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebScanBot/1.0)' },
        maxRedirects: 5
      });
      const loadTime = Date.now() - start;
      const html = res.data || '';
      const sizeKB = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
      const jsCount = (html.match(/<script/gi) || []).length;
      const imgCount = (html.match(/<img/gi) || []).length;

      const score = loadTime < 1000 ? 80 : loadTime < 2000 ? 65 : loadTime < 4000 ? 45 : 30;

      return {
        score,
        metrics: { fcp: loadTime, lcp: loadTime, ttfb: loadTime, tbt: 0, cls: 0, speedIndex: loadTime, totalTransferKB: sizeKB, jsCount, imgCount, resourceCount: jsCount + imgCount },
        issues: loadTime > 3000 ? [{
          category: 'performance', severity: 'alto',
          title: `Sitio carga en ${(loadTime/1000).toFixed(1)}s (medición HTTP básica)`,
          description: 'No se pudo usar Google PageSpeed para un análisis completo. Medición básica indica tiempo de carga elevado.',
          howToFix: 'Configura una PAGESPEED_API_KEY para obtener métricas detalladas de Core Web Vitals.',
          impact: 'Un sitio lento pierde visitantes antes de que vean tu contenido.'
        }] : [],
        recommendations: []
      };
    } catch (e) {
      return {
        score: 50,
        metrics: {},
        issues: [{
          category: 'performance', severity: 'medio',
          title: 'No se pudo medir la velocidad automáticamente',
          description: 'El sitio puede tener protección anti-bots o estar temporalmente inaccesible.',
          howToFix: 'Mide manualmente en pagespeed.web.dev',
          impact: 'Sin datos de velocidad no se puede evaluar el impacto en el ranking de Google.'
        }],
        recommendations: []
      };
    }
  }

  // =====================================================
  // ACCESSIBILITY (from PageSpeed Lighthouse)
  // =====================================================
  async analyzeAccessibility() {
    console.log('Analizando Accesibilidad...');

    if (!this._psiCache || this._psiCache.__rateLimited) {
      return { score: 50, issues: [], recommendations: [] };
    }

    try {
      const lhr = this._psiCache.lighthouseResult;
      const audits = lhr.audits;
      const a11yScore = Math.round((lhr.categories.accessibility?.score || 0) * 100);

      const issues = [];

      const checkAudit = (key, sev, title, description, howToFix, impact) => {
        const a = audits[key];
        if (a && a.score !== null && a.score < 1 && a.score !== undefined) {
          issues.push({ category: 'accessibility', severity: sev, title, description, howToFix, impact });
        }
      };

      checkAudit(
        'image-alt', 'alto',
        'Imágenes sin texto alternativo (alt)',
        'Varias imágenes de tu sitio no tienen descripción alternativa. Las personas con discapacidad visual que usan lectores de pantalla no pueden saber qué muestra la imagen.',
        'Agrega el atributo alt a cada <img> con una descripción breve del contenido. Ejemplo: <img src="producto.jpg" alt="Zapato deportivo azul talla 42">.',
        'Afecta la accesibilidad WCAG 2.1 (nivel A) y puede generar problemas legales en ciertos países. También afecta al SEO de imágenes.'
      );

      checkAudit(
        'button-name', 'alto',
        'Botones sin nombre accesible',
        'Hay botones en tu sitio que no tienen texto o etiqueta que identifique su función. Un botón sin nombre es imposible de usar con teclado o lector de pantalla.',
        'Agrega texto descriptivo dentro de cada botón. Si el botón solo tiene un ícono, usa aria-label="Descripción del botón".',
        'Un botón sin nombre hace el sitio inutilizable para usuarios con discapacidad. También puede confundir a usuarios que navegan con teclado.'
      );

      checkAudit(
        'label', 'alto',
        'Campos de formulario sin etiqueta',
        'Algunos campos de tu formulario no tienen etiqueta asociada. Los usuarios con lectores de pantalla no pueden saber qué deben escribir en cada campo.',
        'Asocia un elemento <label> a cada campo de formulario con el atributo for/id, o usa aria-label en el input.',
        'Los formularios sin etiquetas son inutilizables para personas con discapacidad visual y fallan las pruebas de accesibilidad WCAG.'
      );

      checkAudit(
        'color-contrast', 'medio',
        'Contraste de color insuficiente en texto',
        'El texto de tu sitio no tiene suficiente contraste con el fondo en algunos elementos. Esto dificulta la lectura para personas con baja visión o en pantallas bajo luz solar.',
        'Asegúrate de que el ratio de contraste texto/fondo sea al menos 4.5:1 para texto normal y 3:1 para texto grande. Usa tools.w3.org/color-contrast o el inspector de Chrome.',
        'Afecta directamente a usuarios con baja visión, daltonismo y lectura en exteriores. Es requerimiento WCAG 2.1 nivel AA.'
      );

      checkAudit(
        'document-title', 'alto',
        'Página sin título de documento',
        'La página no tiene un elemento <title> definido. Esto afecta la navegación por pestañas, el SEO y los lectores de pantalla.',
        'Agrega un <title> descriptivo dentro del <head> de cada página.',
        'Sin título, los usuarios no pueden distinguir entre pestañas abiertas y los lectores de pantalla no anuncian el nombre de la página.'
      );

      checkAudit(
        'html-has-lang', 'medio',
        'Página sin atributo de idioma (lang)',
        'El elemento <html> no tiene un atributo lang definido. Los lectores de pantalla y motores de búsqueda no pueden determinar el idioma del contenido.',
        'Agrega el atributo lang al elemento HTML: <html lang="es"> para español.',
        'Sin el atributo lang, los lectores de pantalla pueden pronunciar el texto en el idioma incorrecto, confundiendo a los usuarios.'
      );

      checkAudit(
        'link-name', 'alto',
        'Vínculos sin texto descriptivo',
        'Hay enlaces en tu sitio con texto genérico ("clic aquí", "más info", o sin texto) que no describen el destino del enlace.',
        'Usa texto descriptivo en los enlaces: en vez de "clic aquí", escribe "Ver catálogo de productos" o "Descargar ficha técnica".',
        'Los enlaces sin texto son confusos para todos los usuarios y fallan requisitos de accesibilidad WCAG 2.1.'
      );

      checkAudit(
        'meta-viewport', 'medio',
        'Configuración de viewport que bloquea el zoom del usuario',
        'El meta viewport tiene user-scalable=no o maximum-scale=1, lo que impide que los usuarios hagan zoom en el texto.',
        'Cambia a <meta name="viewport" content="width=device-width, initial-scale=1"> sin restricciones de escala.',
        'Impedir el zoom es una barrera de accesibilidad para personas con baja visión. Es violación de WCAG 1.4.4.'
      );

      // Lighthouse a11y individual items
      const a11yAuditsFailing = Object.values(audits).filter(a =>
        a.id && lhr.categories.accessibility?.auditRefs?.find(r => r.id === a.id) &&
        a.score !== null && a.score < 1 && a.score !== undefined
      );

      if (a11yAuditsFailing.length > issues.length + 2) {
        issues.push({
          category: 'accessibility', severity: 'medio',
          title: `${a11yAuditsFailing.length} verificaciones de accesibilidad fallidas en Lighthouse`,
          description: `Google Lighthouse detectó ${a11yAuditsFailing.length} problemas de accesibilidad en tu sitio, incluyendo: ${a11yAuditsFailing.slice(0, 3).map(a => a.title).join(', ')}.`,
          howToFix: 'Revisa el informe completo en PageSpeed Insights (pagespeed.web.dev) o usa la extensión Lighthouse en Chrome DevTools para ver cada problema.',
          impact: 'La accesibilidad afecta a un 15% de la población mundial con algún tipo de discapacidad. También es factor de ranking en Google.'
        });
      }

      return { score: a11yScore, issues, recommendations: [] };

    } catch (err) {
      console.error('Error accesibilidad:', err.message);
      return { score: 50, issues: [], recommendations: [] };
    }
  }

  // =====================================================
  // SEO ANALYSIS (deep)
  // =====================================================
  async analyzeSEO() {
    console.log('Analizando SEO...');

    const issues = [];
    let seoScore = 100;

    let browser, page;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: PUPPETEER_ARGS
      });
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
      const response = await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (response && response.status() >= 400) {
        throw new Error(`blocked:${response.status()}`);
      }

      const content = await page.content();
      const $ = cheerio.load(content);

      // ── Title ──
      const title = $('title').text().trim();
      if (!title) {
        issues.push({
          category: 'seo', severity: 'critico',
          title: 'Página sin título — Google no sabe cómo presentarla',
          description: 'Tu página no tiene un elemento <title>. En los resultados de Google, el título es lo primero que ve el usuario. Sin él, Google muestra la URL desnuda, que nadie hace clic.',
          howToFix: 'Agrega <title>Tu Negocio — Servicio Principal en Ciudad</title> en el <head> de cada página. Si usas WordPress, el plugin Yoast lo gestiona automáticamente.',
          impact: 'Sin título, tu página prácticamente no existe en Google. Pérdida directa de tráfico orgánico.'
        });
        seoScore -= 20;
      } else if (title.length < 30) {
        issues.push({
          category: 'seo', severity: 'medio',
          title: `Título demasiado corto (${title.length} caracteres) — "${title}"`,
          description: `El título tiene solo ${title.length} caracteres. Google muestra hasta 60 caracteres y los títulos cortos no describen bien el contenido ni incluyen palabras clave relevantes.`,
          howToFix: 'Amplía el título a 50–60 caracteres incluyendo servicio y ubicación si aplica. Ejemplo: "Servicios de Diseño Web Profesional en Bogotá | Tu Empresa".',
          impact: 'Un título corto desaprovecha el espacio que Google da para convencer al usuario de hacer clic.'
        });
        seoScore -= 8;
      } else if (title.length > 60) {
        issues.push({
          category: 'seo', severity: 'alto',
          title: `Título demasiado largo (${title.length} caracteres) — Google lo recorta con "..."`,
          description: `El título tiene ${title.length} caracteres pero Google muestra máximo ~60. El resto se corta con "..." justo cuando estaba convenciendo al usuario. Título actual: "${title.substring(0, 50)}..."`,
          howToFix: 'Reduce el título a 50–60 caracteres manteniendo lo más importante al inicio. El nombre de la marca puede ir al final.',
          impact: 'Un título cortado se ve descuidado y reduce el porcentaje de clics (CTR) en los resultados de búsqueda.'
        });
        seoScore -= 10;
      }

      // ── Meta Description ──
      const desc = $('meta[name="description"]').attr('content') || '';
      if (!desc) {
        issues.push({
          category: 'seo', severity: 'critico',
          title: 'Sin meta descripción — Google elige texto aleatorio para mostrarte',
          description: 'La meta descripción es el párrafo de 2 líneas que aparece en Google bajo el título. Sin ella, Google selecciona texto aleatorio de tu página, generalmente algo sin contexto comercial.',
          howToFix: 'Agrega <meta name="description" content="Descripción de 140–160 caracteres con tu propuesta de valor y llamada a la acción">.  En WordPress, usa Yoast SEO.',
          impact: 'Una buena meta descripción puede aumentar el CTR un 5–15%. Sin ella, estás perdiendo clics aunque aparezcas bien posicionado.'
        });
        seoScore -= 15;
      } else if (desc.length < 120 || desc.length > 160) {
        const tooShort = desc.length < 120;
        issues.push({
          category: 'seo', severity: 'medio',
          title: `Meta descripción ${tooShort ? 'muy corta' : 'demasiado larga'} (${desc.length} chars — ideal: 120–160)`,
          description: tooShort
            ? `La descripción tiene solo ${desc.length} caracteres. No aprovecha el espacio para convencer al usuario de hacer clic.`
            : `La descripción tiene ${desc.length} caracteres. Google la recorta en ~160, cortando el mensaje a mitad.`,
          howToFix: 'Ajusta la descripción a 120–160 caracteres. Incluye el beneficio principal y una llamada a la acción como "Cotiza gratis" o "Ver catálogo".',
          impact: 'Una descripción bien optimizada puede mejorar el CTR significativamente sin cambiar tu posición en Google.'
        });
        seoScore -= 5;
      }

      // ── H1 ──
      const h1s = $('h1');
      if (h1s.length === 0) {
        issues.push({
          category: 'seo', severity: 'alto',
          title: 'Sin titular H1 — Google no identifica el tema principal de la página',
          description: 'El H1 es el titular principal y una de las señales más importantes para que Google entienda de qué trata la página. Tu página no tiene ninguno.',
          howToFix: 'Agrega un único <h1> visible que describa el tema principal. Ejemplo: <h1>Servicios de Contabilidad Empresarial en Medellín</h1>.',
          impact: 'Sin H1, Google tiene dificultades para determinar el tema y las palabras clave relevantes, perjudicando el posicionamiento.'
        });
        seoScore -= 15;
      } else if (h1s.length > 1) {
        issues.push({
          category: 'seo', severity: 'medio',
          title: `Múltiples H1 (${h1s.length}) — solo debe existir uno por página`,
          description: `La página tiene ${h1s.length} titulares H1. Cada página debe tener exactamente uno que defina su tema principal. Múltiples H1 diluyen la señal de relevancia para Google.`,
          howToFix: 'Mantén un solo H1 con el tema principal. Los demás titulares deben usar H2, H3, etc. siguiendo una jerarquía lógica.',
          impact: 'Múltiples H1 confunden a los motores de búsqueda sobre el tema principal, reduciendo la relevancia temática.'
        });
        seoScore -= 5;
      }

      // ── Canonical ──
      const canonical = $('link[rel="canonical"]').attr('href');
      if (!canonical) {
        issues.push({
          category: 'seo', severity: 'medio',
          title: 'Sin URL canónica — riesgo de contenido duplicado',
          description: 'La etiqueta canónica le dice a Google cuál es la URL "oficial" de una página cuando existen variaciones (con/sin www, con/sin trailing slash, con parámetros UTM). Sin ella, Google puede indexar múltiples versiones y dividir el "link juice".',
          howToFix: 'Agrega <link rel="canonical" href="https://tudominio.com/ruta"> en el <head> de cada página. Los CMS modernos lo hacen automáticamente.',
          impact: 'Sin canonical, el tráfico y autoridad de posicionamiento puede dispersarse entre múltiples URLs del mismo contenido.'
        });
        seoScore -= 8;
      }

      // ── Robots meta ──
      const robotsMeta = $('meta[name="robots"]').attr('content') || '';
      if (robotsMeta.toLowerCase().includes('noindex')) {
        issues.push({
          category: 'seo', severity: 'critico',
          title: 'Página bloqueada de Google (noindex activo)',
          description: `La página tiene una etiqueta robots con "noindex", lo que le indica a Google que NO la indexe. Google obedece esta instrucción y no mostrará esta página en ningún resultado de búsqueda.`,
          howToFix: 'Si quieres que Google indexe esta página, elimina "noindex" de la meta etiqueta robots o del header X-Robots-Tag.',
          impact: 'Esta página es INVISIBLE para Google. No aparecerá en ninguna búsqueda mientras esta etiqueta esté activa.'
        });
        seoScore -= 40;
      }

      // ── Images alt ──
      const imgs = $('img');
      const imgsWithoutAlt = imgs.filter((_, el) => !$(el).attr('alt') && !$(el).attr('aria-label')).length;
      if (imgsWithoutAlt > 0) {
        issues.push({
          category: 'seo', severity: imgsWithoutAlt > 5 ? 'alto' : 'medio',
          title: `${imgsWithoutAlt} imagen${imgsWithoutAlt > 1 ? 's' : ''} sin texto alt — Google no puede indexarlas`,
          description: `${imgsWithoutAlt} imágenes no tienen atributo alt. Google utiliza el texto alt para entender el contenido de las imágenes e indexarlas en Google Images. Además, el alt es esencial para accesibilidad.`,
          howToFix: 'Agrega alt descriptivo a cada <img>: <img src="logo.jpg" alt="Logo de TuEmpresa — Servicios de Marketing Digital">. Describe el contenido relevante.',
          impact: 'Las imágenes sin alt no aparecen en Google Images (tráfico perdido) y penalizan el score de accesibilidad de tu sitio.'
        });
        seoScore -= Math.min(12, imgsWithoutAlt * 2);
      }

      // ── Heading hierarchy ──
      const hasH2 = $('h2').length > 0;
      const hasH1 = $('h1').length > 0;
      if (hasH1 && !hasH2 && $('p').length > 10) {
        issues.push({
          category: 'seo', severity: 'bajo',
          title: 'Estructura de titulares incompleta — solo H1, sin H2/H3',
          description: 'El contenido de la página tiene párrafos pero no usa subtítulos (H2, H3) para organizarlo. Los subtítulos ayudan a Google a entender la estructura temática del contenido.',
          howToFix: 'Divide el contenido con subtítulos descriptivos usando <h2> y <h3>. Cada subtítulo debe describir el tema del párrafo que le sigue.',
          impact: 'Una buena jerarquía de encabezados mejora la comprensión del contenido por parte de Google y facilita la lectura a los usuarios.'
        });
        seoScore -= 5;
      }

      // ── Open Graph ──
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDesc = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      const twitterCard = $('meta[name="twitter:card"]').attr('content');

      if (!ogTitle || !ogDesc || !ogImage) {
        const missing = [!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean);
        issues.push({
          category: 'seo', severity: 'medio',
          title: `Open Graph incompleto (faltan: ${missing.join(', ')}) — previews feas en redes sociales`,
          description: 'Cuando se comparte tu enlace en WhatsApp, Facebook, LinkedIn o Twitter, aparece una "tarjeta" con imagen, título y descripción. Las etiquetas Open Graph que faltan hacen que esta tarjeta aparezca incompleta o sin imagen.',
          howToFix: 'Agrega las etiquetas meta faltantes en el <head>. Si usas WordPress, el plugin Yoast o RankMath las gestiona automáticamente desde el editor de entradas.',
          impact: 'Los links con buena previsualización reciben hasta 3x más clics cuando se comparten en redes sociales y aplicaciones de mensajería.'
        });
        seoScore -= 8;
      }

      if (!twitterCard) {
        issues.push({
          category: 'seo', severity: 'bajo',
          title: 'Sin Twitter Card — links en Twitter/X se ven como texto simple',
          description: 'Sin la meta etiqueta twitter:card, cuando alguien comparte tu URL en Twitter/X, aparece como un link de texto sin imagen ni descripción visual.',
          howToFix: 'Agrega <meta name="twitter:card" content="summary_large_image"> y las etiquetas twitter:title, twitter:description, twitter:image.',
          impact: 'Los tweets con Twitter Cards generan más engagement. Es una configuración de 5 minutos con impacto en la difusión de contenido.'
        });
        seoScore -= 3;
      }

      // ── Structured Data ──
      const jsonLd = $('script[type="application/ld+json"]');
      if (jsonLd.length === 0) {
        issues.push({
          category: 'seo', severity: 'medio',
          title: 'Sin datos estructurados (Schema.org) — pierdes rich snippets en Google',
          description: 'Los datos estructurados le dicen a Google información específica sobre tu negocio (dirección, teléfono, horario, reseñas, precios). Sin ellos, tu resultado en Google aparece como texto plano sin información adicional.',
          howToFix: 'Implementa JSON-LD con Schema.org. Para negocios locales usa LocalBusiness, para e-commerce usa Product, para artículos usa Article. Google ofrece una herramienta gratuita de prueba de datos estructurados.',
          impact: 'Los rich snippets (estrellas de valoración, precio, horario) aumentan el CTR entre un 20–30% comparado con resultados sin ellos.'
        });
        seoScore -= 10;
      }

      // ── Robots.txt ──
      try {
        const robotsRes = await axios.get(`https://${this.domain}/robots.txt`, { timeout: 8000 });
        if (robotsRes.status !== 200) throw new Error('not found');
      } catch {
        issues.push({
          category: 'seo', severity: 'bajo',
          title: 'Sin archivo robots.txt',
          description: 'El archivo robots.txt no existe o no es accesible. Este archivo instruye a los bots de búsqueda qué páginas pueden o no rastrear.',
          howToFix: 'Crea un archivo robots.txt básico en la raíz del sitio. Para WordPress, Yoast lo genera automáticamente.',
          impact: 'Sin robots.txt, Google puede rastrear páginas privadas o de administración, desperdiciando el "crawl budget".'
        });
        seoScore -= 5;
      }

      // ── Sitemap ──
      try {
        const sitemapUrl = `https://${this.domain}/sitemap.xml`;
        const sitemapRes = await axios.get(sitemapUrl, { timeout: 8000 });
        if (sitemapRes.status !== 200) throw new Error('not found');
      } catch {
        issues.push({
          category: 'seo', severity: 'medio',
          title: 'Sin sitemap.xml — Google tarda más en descubrir tus páginas',
          description: 'El sitemap es un mapa de todas las páginas de tu sitio que facilitas a Google para que las encuentre y las indexe más rápido. Sin él, Google tiene que descubrir las páginas "a ciegas".',
          howToFix: 'En WordPress instala Yoast SEO o Rank Math (generan el sitemap automáticamente). Luego envíalo a Google Search Console > Sitemaps.',
          impact: 'Sin sitemap, las páginas nuevas pueden tardar semanas o meses en aparecer en Google. Con sitemap, pueden indexarse en horas.'
        });
        seoScore -= 10;
      }

      // ── Internal links ──
      const internalLinks = $('a[href]').filter((_, el) => {
        const href = $(el).attr('href') || '';
        return href.startsWith('/') || href.includes(this.domain);
      }).length;
      if (internalLinks < 3 && $('a').length > 0) {
        issues.push({
          category: 'seo', severity: 'bajo',
          title: 'Pocos enlaces internos — Google tiene dificultades para navegar el sitio',
          description: `La página solo tiene ${internalLinks} enlace${internalLinks !== 1 ? 's' : ''} interno${internalLinks !== 1 ? 's' : ''}. Los enlaces internos ayudan a Google a descubrir y entender la estructura de tu sitio, y distribuyen la autoridad entre páginas.`,
          howToFix: 'Agrega enlaces desde las páginas principales hacia páginas de servicios, productos o blog. Usa texto descriptivo en los enlaces, no "clic aquí".',
          impact: 'Una buena red de enlaces internos mejora el crawling de Google y ayuda a que más páginas sean indexadas y posicionadas.'
        });
        seoScore -= 3;
      }

      await browser.close();

      return { score: Math.max(0, Math.min(100, seoScore)), issues, recommendations: [] };

    } catch (error) {
      if (browser) { try { await browser.close(); } catch (_) {} }
      const isBlocked = error.message.includes('blocked:') || error.message.includes('403') || error.message.includes('401');
      return {
        score: isBlocked ? 85 : 40,
        issues: [{
          category: 'seo', severity: isBlocked ? 'bajo' : 'alto',
          title: isBlocked ? 'Sitio con protección anti-bots (no se puede analizar SEO en detalle)' : 'Error al analizar SEO',
          description: isBlocked
            ? 'Tu sitio bloquea bots, incluyendo el simulado de Googlebot. Verifica en Google Search Console que Google pueda rastrear tu sitio correctamente.'
            : `No se pudo cargar el sitio para análisis SEO: ${error.message}`,
          howToFix: isBlocked ? 'Revisa la configuración de Cloudflare o tu firewall para asegurarte de que Googlebot tiene acceso. Verifica en Search Console > Cobertura.' : 'Verifica que el sitio esté activo y accesible.',
          impact: isBlocked ? 'Si Google también está siendo bloqueado, tu sitio podría no estar siendo indexado correctamente.' : 'No se puede evaluar el SEO del sitio.'
        }],
        recommendations: []
      };
    }
  }

  // =====================================================
  // SECURITY ANALYSIS (comprehensive)
  // =====================================================
  async analyzeSecurity() {
    console.log('Analizando Seguridad...');

    const issues = [];
    let secScore = 100;

    // HTTPS check
    if (!this.url.startsWith('https://')) {
      issues.push({
        category: 'security', severity: 'critico',
        title: 'Sitio sin HTTPS — Chrome lo marca como "No seguro"',
        description: 'Tu sitio no usa conexión cifrada (HTTPS). Chrome y Firefox muestran una advertencia de "No seguro" que hace que el 85% de usuarios abandone inmediatamente.',
        howToFix: 'Instala un certificado SSL gratuito (Let\'s Encrypt) desde cPanel con un clic, o actívalo desde tu panel de hosting. Es gratuito y tarda menos de 5 minutos.',
        impact: 'Google penaliza sitios HTTP en rankings. Los usuarios ven la advertencia "No seguro" y se van. El formulario de contacto transmite datos sin cifrar.'
      });
      secScore -= 50;
    }

    try {
      const res = await axios.get(this.url, {
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)' }
      });
      const h = res.headers;

      // HSTS
      if (!h['strict-transport-security']) {
        issues.push({
          category: 'security', severity: 'medio',
          title: 'Sin HSTS — conexión vulnerable a ataques de degradación SSL',
          description: 'HTTP Strict Transport Security (HSTS) no está configurado. Sin él, un atacante puede forzar al navegador a conectarse sin SSL, exponiendo los datos de los usuarios incluso si tu sitio tiene HTTPS.',
          howToFix: 'Agrega el header: Strict-Transport-Security: max-age=31536000; includeSubDomains en tu servidor web (Apache/Nginx) o en el panel de hosting.',
          impact: 'Sin HSTS, un atacante en red WiFi pública puede interceptar comunicaciones aunque el sitio tenga HTTPS.'
        });
        secScore -= 10;
      }

      // X-Frame-Options / CSP frame-ancestors
      const csp = h['content-security-policy'] || '';
      const hasFrameProtection = h['x-frame-options'] || csp.includes('frame-ancestors');
      if (!hasFrameProtection) {
        issues.push({
          category: 'security', severity: 'alto',
          title: 'Sin protección contra Clickjacking (X-Frame-Options ausente)',
          description: 'Tu sitio puede ser incrustado en un iframe por páginas maliciosas. Los atacantes pueden superponer capas invisibles para engañar a los usuarios a hacer clic en acciones no deseadas (clickjacking).',
          howToFix: 'Agrega el header X-Frame-Options: SAMEORIGIN en tu servidor. Esto impide que tu sitio sea cargado dentro de iframes de otros dominios.',
          impact: 'El clickjacking es un ataque real usado para robo de credenciales y fraudes de clic. Afecta directamente la seguridad de tus usuarios.'
        });
        secScore -= 15;
      }

      // X-Content-Type-Options
      if (!h['x-content-type-options']) {
        issues.push({
          category: 'security', severity: 'medio',
          title: 'Sin protección contra MIME sniffing (X-Content-Type-Options ausente)',
          description: 'Sin este header, el navegador puede "adivinar" el tipo de un archivo y ejecutarlo de forma diferente a lo esperado. Esto puede permitir que archivos subidos por usuarios sean ejecutados como scripts.',
          howToFix: 'Agrega X-Content-Type-Options: nosniff en la configuración de tu servidor web. Es una línea de código.',
          impact: 'Puede permitir ataques XSS si usuarios pueden subir archivos al sitio.'
        });
        secScore -= 8;
      }

      // CSP
      if (!csp) {
        issues.push({
          category: 'security', severity: 'medio',
          title: 'Sin Content Security Policy (CSP) — vulnerable a inyección de scripts',
          description: 'Content Security Policy define qué recursos externos puede cargar tu página. Sin CSP, si un atacante logra inyectar código en tu sitio, el navegador lo ejecutará sin restricciones.',
          howToFix: 'Implementa un header CSP básico: Content-Security-Policy: default-src \'self\'; script-src \'self\' con las fuentes confiables. Es una configuración en tu servidor web.',
          impact: 'Sin CSP, los ataques XSS (Cross-Site Scripting) son más fáciles de ejecutar y más dañinos. Es especialmente importante si tienes formularios o login.'
        });
        secScore -= 10;
      }

      // Referrer-Policy
      if (!h['referrer-policy']) {
        issues.push({
          category: 'security', severity: 'bajo',
          title: 'Sin Referrer-Policy — URLs completas pueden filtrarse a terceros',
          description: 'Sin Referrer-Policy, cuando un usuario hace clic en un enlace externo desde tu sitio, el sitio destino puede ver la URL completa desde donde vino el usuario, incluyendo posibles parámetros sensibles.',
          howToFix: 'Agrega Referrer-Policy: strict-origin-when-cross-origin en tu servidor. Protege la privacidad de los usuarios sin romper funcionalidades.',
          impact: 'Puede exponer URLs internas con parámetros sensibles (tokens, IDs) a sitios de terceros.'
        });
        secScore -= 5;
      }

      // Permissions-Policy
      if (!h['permissions-policy'] && !h['feature-policy']) {
        issues.push({
          category: 'security', severity: 'bajo',
          title: 'Sin Permissions-Policy — acceso no restringido a cámara, micrófono y geolocalización',
          description: 'Sin este header, cualquier script de tercero en tu página podría solicitar acceso a la cámara, micrófono o ubicación del usuario sin tu conocimiento.',
          howToFix: 'Agrega Permissions-Policy: camera=(), microphone=(), geolocation=() para deshabilitar permisos que tu sitio no necesita.',
          impact: 'Scripts de analítica o publicidad de terceros podrían potencialmente solicitar permisos sensibles en nombre de tu dominio.'
        });
        secScore -= 5;
      }

      // Server header leaking
      const serverHeader = h['server'] || '';
      const xPoweredBy = h['x-powered-by'] || '';
      if (serverHeader.match(/nginx\/[\d.]+|apache\/[\d.]+/i) || xPoweredBy.match(/php\/[\d.]+|express/i)) {
        issues.push({
          category: 'security', severity: 'medio',
          title: `Servidor expone información de versión (${serverHeader || xPoweredBy})`,
          description: `Tu servidor revela su software y versión en los headers HTTP (${serverHeader || xPoweredBy}). Los atacantes usan esta información para buscar vulnerabilidades conocidas de esa versión específica.`,
          howToFix: 'Configura el servidor para ocultar la información de versión: En Nginx: server_tokens off; En Apache: ServerTokens Prod + ServerSignature Off.',
          impact: 'Exponer versiones del servidor facilita ataques dirigidos usando CVEs conocidos para esa versión específica.'
        });
        secScore -= 8;
      }

      // Check for sensitive exposed paths (fire and forget)
      const sensitivePaths = ['/.env', '/.git/config', '/wp-admin/', '/admin/', '/phpmyadmin/'];
      const sensitiveChecks = await Promise.allSettled(
        sensitivePaths.map(path =>
          axios.get(`https://${this.domain}${path}`, { timeout: 5000, validateStatus: () => true, maxRedirects: 0 })
            .then(r => ({ path, status: r.status }))
        )
      );

      const exposedPaths = sensitiveChecks
        .filter(r => r.status === 'fulfilled' && r.value.status === 200)
        .map(r => r.value.path);

      if (exposedPaths.includes('/.env') || exposedPaths.includes('/.git/config')) {
        issues.push({
          category: 'security', severity: 'critico',
          title: `Archivos sensibles expuestos públicamente (${exposedPaths.join(', ')})`,
          description: `Archivos de configuración críticos son accesibles públicamente. El archivo .env puede contener contraseñas de base de datos, API keys y credenciales. El .git/config puede exponer el repositorio completo.`,
          howToFix: 'Bloquea inmediatamente el acceso a estos archivos en tu servidor web. En Apache agrega una regla en .htaccess, en Nginx agrega location ~* \\.(env|git) deny all;',
          impact: '¡CRÍTICO! Un atacante puede obtener contraseñas de base de datos, claves API y tomar control completo del servidor.'
        });
        secScore -= 40;
      } else if (exposedPaths.some(p => ['/admin/', '/phpmyadmin/'].includes(p))) {
        issues.push({
          category: 'security', severity: 'alto',
          title: `Panel de administración expuesto sin protección (${exposedPaths.filter(p => ['/admin/', '/phpmyadmin/'].includes(p)).join(', ')})`,
          description: 'Los paneles de administración son accesibles directamente desde internet sin autenticación adicional. Son objetivos comunes de ataques de fuerza bruta.',
          howToFix: 'Restringe el acceso por IP, agrega autenticación HTTP básica adicional, o cambia la URL del panel de administración a una ruta no estándar.',
          impact: 'Los paneles de admin expuestos son el vector de ataque más común en WordPress y sitios CMS.'
        });
        secScore -= 20;
      }

      // Mixed content check
      try {
        const htmlContent = typeof res.data === 'string' ? res.data : '';
        const httpResources = (htmlContent.match(/src=["']http:\/\//gi) || []).length +
                              (htmlContent.match(/href=["']http:\/\//gi) || []).length;
        if (httpResources > 0 && this.url.startsWith('https://')) {
          issues.push({
            category: 'security', severity: 'alto',
            title: `Contenido mixto detectado — ${httpResources} recurso${httpResources > 1 ? 's' : ''} HTTP cargando en página HTTPS`,
            description: `Tu sitio usa HTTPS pero carga ${httpResources} recurso${httpResources > 1 ? 's' : ''} (imágenes, scripts o estilos) desde HTTP sin cifrar. El navegador bloquea estos recursos o muestra advertencias de seguridad.`,
            howToFix: 'Actualiza todas las URLs de recursos a HTTPS. Busca en el código fuente cualquier referencia a "http://" y cámbiala a "https://". Los plugins de WordPress tienen herramientas para esto.',
            impact: 'Los navegadores modernos bloquean contenido mixto, rompiendo funcionalidades del sitio y mostrando advertencias de seguridad a los usuarios.'
          });
          secScore -= 15;
        }
      } catch (_) {}

    } catch (error) {
      const isBlocked = error.response && [401, 403, 503].includes(error.response?.status);
      if (!isBlocked) {
        issues.push({
          category: 'security', severity: 'medio',
          title: 'No se pudo completar el análisis de seguridad',
          description: `El análisis de headers de seguridad no pudo completarse: ${error.message}`,
          howToFix: 'Verifica que el sitio esté accesible y no tenga redirecciones que bloqueen el escáner.',
          impact: 'No se pudieron verificar los headers de seguridad HTTP.'
        });
      }
    }

    return { score: Math.max(0, Math.min(100, secScore)), issues, recommendations: [] };
  }

  // =====================================================
  // UX ANALYSIS
  // =====================================================
  async analyzeUX() {
    console.log('Analizando UX...');

    const issues = [];
    let uxScore = 100;

    let browser, page;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: PUPPETEER_ARGS
      });

      // Mobile test
      page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 }); // iPhone 14
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
      const res = await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (res && res.status() >= 400) throw new Error(`blocked:${res.status()}`);

      const content = await page.content();
      const $ = cheerio.load(content);

      // Viewport meta
      const viewport = $('meta[name="viewport"]').attr('content') || '';
      if (!viewport) {
        issues.push({
          category: 'ux', severity: 'critico',
          title: 'Sitio no adaptado a móviles (no responsive) — 70% de usuarios afectados',
          description: 'Tu sitio no tiene configuración responsive. En smartphones el texto se ve diminuto, los botones son imposibles de tocar y el usuario tiene que hacer zoom para leer.',
          howToFix: 'Tu desarrollador debe implementar diseño responsive. En WordPress, cambia a un tema responsive moderno. Para un sitio a medida, es trabajo de 1–3 días dependiendo del tamaño.',
          impact: 'Google indexa primero la versión móvil (Mobile-First Indexing). Un sitio no responsive es penalizado directamente en los rankings de búsqueda.'
        });
        uxScore -= 35;
      } else if (viewport.includes('user-scalable=no') || viewport.includes('maximum-scale=1')) {
        issues.push({
          category: 'ux', severity: 'medio',
          title: 'Zoom del usuario bloqueado — viola accesibilidad WCAG',
          description: 'La configuración del viewport bloquea el zoom táctil. Las personas con baja visión necesitan poder hacer zoom en el texto para leerlo cómodamente.',
          howToFix: 'Cambia el meta viewport a: <meta name="viewport" content="width=device-width, initial-scale=1"> eliminando las restricciones de escala.',
          impact: 'Bloquear el zoom es una violación de WCAG 1.4.4 (nivel AA) y afecta a usuarios con baja visión.'
        });
        uxScore -= 10;
      }

      // Forms security
      const forms = await page.$$('form');
      for (const form of forms) {
        const action = await form.evaluate(el => el.action || '');
        if (action && action.startsWith('http://')) {
          issues.push({
            category: 'ux', severity: 'alto',
            title: 'Formulario envía datos sin cifrar (HTTP)',
            description: 'Hay formularios que envían datos a una URL sin HTTPS. La información que escriben los usuarios (nombre, email, teléfono) viaja sin cifrar por internet.',
            howToFix: 'Cambia la URL del action del formulario de http:// a https://.',
            impact: 'Datos de usuarios pueden ser interceptados en redes no seguras. Posible incumplimiento de la Ley 1581 de protección de datos en Colombia.'
          });
          uxScore -= 20;
          break;
        }
      }

      // Touch target sizes (buttons and links)
      const smallTargets = await page.evaluate(() => {
        const els = [...document.querySelectorAll('a, button')];
        return els.filter(el => {
          const rect = el.getBoundingClientRect();
          return (rect.width > 0 && rect.height > 0) && (rect.width < 44 || rect.height < 44);
        }).length;
      });
      if (smallTargets > 3) {
        issues.push({
          category: 'ux', severity: 'medio',
          title: `${smallTargets} botones o enlaces demasiado pequeños para tocar en móvil`,
          description: `${smallTargets} elementos interactivos (botones o enlaces) tienen un área de toque menor a 44x44px, el mínimo recomendado por Apple y Google para uso cómodo en pantalla táctil.`,
          howToFix: 'Asegúrate de que todos los botones y enlaces tengan min-height: 44px y min-width: 44px en CSS, o agrega suficiente padding alrededor del texto.',
          impact: 'Los usuarios cometen errores de toque en elementos pequeños, generando frustración y aumentando la tasa de abandono en móviles.'
        });
        uxScore -= 10;
      }

      // Font size readability
      const smallFonts = await page.evaluate(() => {
        const els = [...document.querySelectorAll('p, li, span, td')];
        return els.filter(el => {
          const fs = parseFloat(window.getComputedStyle(el).fontSize);
          return fs > 0 && fs < 14;
        }).length;
      });
      if (smallFonts > 5) {
        issues.push({
          category: 'ux', severity: 'medio',
          title: `Texto demasiado pequeño en ${smallFonts} elementos — difícil de leer en móvil`,
          description: `Se detectaron ${smallFonts} elementos con texto menor a 14px. El tamaño de fuente mínimo recomendado para buena legibilidad en móviles es 16px.`,
          howToFix: 'Establece un tamaño de fuente base de 16px en el body: body { font-size: 16px; } y asegúrate de que los textos secundarios no bajen de 14px.',
          impact: 'El texto pequeño aumenta el esfuerzo cognitivo de lectura y hace que los usuarios abandonen el contenido antes de terminarlo.'
        });
        uxScore -= 8;
      }

      // Check for horizontal scroll on mobile
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasHorizontalScroll) {
        issues.push({
          category: 'ux', severity: 'alto',
          title: 'Scroll horizontal en móvil — diseño roto en smartphones',
          description: 'Tu sitio tiene contenido que se desborda horizontalmente en pantalla móvil. Esto hace que aparezca una barra de scroll horizontal y el diseño se vea roto.',
          howToFix: 'Identifica qué elemento causa el desbordamiento (usa overflow: hidden en el body como solución rápida, pero el correcto es encontrar el elemento y ajustar su width/max-width).',
          impact: 'Un diseño roto en móvil da una imagen muy negativa del negocio y hace la página inutilizable en smartphones.'
        });
        uxScore -= 20;
      }

      // Check for broken images
      const brokenImgs = await page.evaluate(() => {
        return [...document.querySelectorAll('img')].filter(img => !img.complete || img.naturalHeight === 0).length;
      });
      if (brokenImgs > 0) {
        issues.push({
          category: 'ux', severity: brokenImgs > 3 ? 'alto' : 'medio',
          title: `${brokenImgs} imagen${brokenImgs > 1 ? 's' : ''} rota${brokenImgs > 1 ? 's' : ''} detectada${brokenImgs > 1 ? 's' : ''}`,
          description: `${brokenImgs} imagen${brokenImgs > 1 ? 's' : ''} no car${brokenImgs === 1 ? 'ga' : 'gan'} correctamente. Los usuarios ven el ícono de imagen rota que da una impresión de abandono y descuido.`,
          howToFix: 'Verifica que las rutas de las imágenes sean correctas y que los archivos existan en el servidor. Actualiza las URLs si el sitio fue migrado.',
          impact: 'Las imágenes rotas dañan la credibilidad del sitio y pueden indicar contenido no mantenido a los usuarios y a Google.'
        });
        uxScore -= Math.min(25, brokenImgs * 5);
      }

      // Language attribute
      const lang = $('html').attr('lang');
      if (!lang) {
        issues.push({
          category: 'ux', severity: 'bajo',
          title: 'Atributo de idioma ausente en el HTML',
          description: 'El elemento <html> no tiene el atributo lang. Los lectores de pantalla y traductores automáticos del navegador dependen de esto para funcionar correctamente.',
          howToFix: 'Agrega lang="es" (o el idioma correspondiente) al elemento HTML: <html lang="es">.',
          impact: 'Afecta accesibilidad y la correcta interpretación del idioma por herramientas asistivas y traductores automáticos del navegador.'
        });
        uxScore -= 3;
      }

      await browser.close();

      return { score: Math.max(0, Math.min(100, uxScore)), issues, recommendations: [] };

    } catch (error) {
      if (browser) { try { await browser.close(); } catch (_) {} }
      const isBlocked = error.message.includes('blocked:');
      return {
        score: isBlocked ? 80 : 50,
        issues: isBlocked ? [{
          category: 'ux', severity: 'bajo',
          title: 'Sitio con protección anti-bots — UX no se pudo analizar completamente',
          description: 'La protección de bot del sitio impidió la simulación móvil completa. Verifica manualmente la experiencia en smartphone.',
          howToFix: 'Prueba el sitio en Google Mobile-Friendly Test (search.google.com/test/mobile-friendly).',
          impact: 'No se pudo verificar la experiencia móvil automáticamente.'
        }] : [],
        recommendations: []
      };
    }
  }

  // =====================================================
  // COLLECT ALL ISSUES
  // =====================================================
  collectAllIssues(categories) {
    const all = [];
    for (const cat of Object.values(categories)) {
      if (cat.issues?.length) all.push(...cat.issues);
    }
    return all;
  }
}

module.exports = WebAnalyzer;
