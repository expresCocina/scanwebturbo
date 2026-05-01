const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

class WebAnalyzer {
  constructor(domain) {
    this.domain = this.cleanDomain(domain);
    this.url = `https://${this.domain}`;
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
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Performance (Lighthouse)
      const performanceData = await this.analyzePerformance();
      results.categories.performance = performanceData;

      // 2. SEO
      const seoData = await this.analyzeSEO();
      results.categories.seo = seoData;

      // 3. Security
      const securityData = await this.analyzeSecurity();
      results.categories.security = securityData;

      // 4. UX
      const uxData = await this.analyzeUX();
      results.categories.ux = uxData;

      // Recopilar todos los issues
      results.issues = this.collectAllIssues(results.categories);

    } catch (error) {
      console.error('Error en análisis:', error);
      throw error;
    }

    return results;
  }

  // =====================================================
  // PERFORMANCE ANALYSIS (Puppeteer + Navigation Timing API)
  // =====================================================
  async analyzePerformance() {
    console.log('Analizando Performance...');

    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });

      const page = await browser.newPage();

      // Emular conexión 4G promedio para métricas reales
      await page.emulateNetworkConditions({
        download: 10 * 1024 * 1024 / 8, // 10 Mbps
        upload: 5 * 1024 * 1024 / 8,
        latency: 40
      });

      const startTime = Date.now();
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 45000 });
      const loadTime = Date.now() - startTime;

      // Extraer métricas reales con Navigation Timing API
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');

        const fcp = paint.find(p => p.name === 'first-contentful-paint');
        const resources = performance.getEntriesByType('resource');
        const totalSize = resources.reduce((acc, r) => acc + (r.transferSize || 0), 0);

        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
          domLoad: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
          fullLoad: nav ? Math.round(nav.loadEventEnd) : 0,
          fcp: fcp ? Math.round(fcp.startTime) : 0,
          resourceCount: resources.length,
          totalTransferKB: Math.round(totalSize / 1024),
          jsCount: resources.filter(r => r.initiatorType === 'script').length,
          cssCount: resources.filter(r => r.initiatorType === 'link').length,
          imgCount: resources.filter(r => r.initiatorType === 'img').length,
        };
      });

      await browser.close();

      const fcpMs = metrics.fcp || loadTime;
      const ttfbMs = metrics.ttfb;
      const fullLoadMs = metrics.fullLoad || loadTime;

      // Calcular score basado en métricas reales
      let score = 100;

      // FCP: < 1.8s = good, 1.8-3s = ok, >3s = bad
      if (fcpMs > 3000) score -= 30;
      else if (fcpMs > 1800) score -= 15;

      // TTFB: < 200ms = good, 200-500ms = ok, > 500ms = bad
      if (ttfbMs > 500) score -= 20;
      else if (ttfbMs > 200) score -= 10;

      // Full load: < 3s = good, 3-6s = ok, > 6s = bad
      if (fullLoadMs > 6000) score -= 25;
      else if (fullLoadMs > 3000) score -= 12;

      // Peso de la página
      if (metrics.totalTransferKB > 3000) score -= 15;
      else if (metrics.totalTransferKB > 1500) score -= 8;

      // JS excesivo
      if (metrics.jsCount > 20) score -= 10;
      else if (metrics.jsCount > 10) score -= 5;

      score = Math.max(0, Math.min(100, score));

      const issues = [];

      if (fcpMs > 1800) {
        issues.push({
          category: 'performance',
          severity: fcpMs > 3000 ? 'critico' : 'alto',
          title: 'Primer contenido tarda demasiado en aparecer',
          description: `Tu sitio tarda ${(fcpMs/1000).toFixed(1)}s en mostrar el primer contenido visible. Lo ideal es menos de 1.8 segundos.`,
          howToFix: 'Reduce el tamaño de imágenes, activa la compresión GZIP en el servidor y usa una CDN para servir los archivos más rápido.',
          impact: 'Los visitantes abandonan la página si no ven nada en 3 segundos. Esto reduce directamente las ventas y consultas.'
        });
      }

      if (ttfbMs > 200) {
        issues.push({
          category: 'performance',
          severity: ttfbMs > 500 ? 'alto' : 'medio',
          title: 'Servidor responde lentamente (TTFB)',
          description: `El servidor tarda ${ttfbMs}ms en responder. Lo recomendado es menos de 200ms.`,
          howToFix: 'Mejora el hosting o cambia a un plan con mejor rendimiento. Activa caché del servidor.',
          impact: 'Un servidor lento afecta el posicionamiento en Google y la experiencia del usuario.'
        });
      }

      if (metrics.totalTransferKB > 1500) {
        issues.push({
          category: 'performance',
          severity: metrics.totalTransferKB > 3000 ? 'alto' : 'medio',
          title: 'Página muy pesada',
          description: `Tu sitio descarga ${metrics.totalTransferKB}KB de datos. Lo ideal es menos de 1,500KB.`,
          howToFix: 'Comprime y optimiza imágenes, minifica archivos CSS y JavaScript, elimina recursos innecesarios.',
          impact: 'En conexiones móviles lentas, páginas pesadas cargan muy despacio y hacen que los usuarios se vayan.'
        });
      }

      if (metrics.jsCount > 10) {
        issues.push({
          category: 'performance',
          severity: 'medio',
          title: `Demasiados archivos JavaScript (${metrics.jsCount})`,
          description: `Se cargan ${metrics.jsCount} archivos JavaScript. Cada uno añade tiempo de carga.`,
          howToFix: 'Combina y minifica scripts, carga JavaScript de forma asíncrona, elimina scripts no utilizados.',
          impact: 'Muchos scripts hacen que el navegador trabaje más y la página tarde más en responder.'
        });
      }

      return {
        score,
        metrics: {
          fcp: `${(fcpMs/1000).toFixed(1)}s`,
          ttfb: `${ttfbMs}ms`,
          fullLoad: `${(fullLoadMs/1000).toFixed(1)}s`,
          totalSize: `${metrics.totalTransferKB}KB`,
          jsFiles: metrics.jsCount,
          resources: metrics.resourceCount
        },
        issues,
        recommendations: []
      };

    } catch (error) {
      console.error('Error en análisis de performance:', error.message);
      return {
        score: 0,
        metrics: {},
        issues: [{
          category: 'performance',
          severity: 'critico',
          title: 'No se pudo analizar la velocidad',
          description: `Error al conectar con el sitio: ${error.message}`,
          howToFix: 'Verifica que el sitio esté accesible públicamente y no bloquee bots.',
          impact: 'No se puede medir el rendimiento del sitio.'
        }],
        recommendations: []
      };
    }
  }


  // =====================================================
  // SEO ANALYSIS
  // =====================================================
  async analyzeSEO() {
    console.log('Analizando SEO...');

    const issues = [];
    let seoScore = 100;

    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });

      const content = await page.content();
      const $ = cheerio.load(content);

      // Meta Title
      const title = $('title').text();
      if (!title || title.length === 0) {
        issues.push({
          category: 'seo',
          severity: 'critico',
          title: 'Sin meta title',
          description: 'La página no tiene tag <title>',
          howToFix: 'Agrega <title>Tu Título - 50-60 caracteres</title> en el <head>',
          impact: 'Google no sabe de qué trata tu página, 0 ranking posible'
        });
        seoScore -= 20;
      } else if (title.length < 30 || title.length > 60) {
        issues.push({
          category: 'seo',
          severity: 'alto',
          title: 'Meta title con longitud incorrecta',
          description: `El título tiene ${title.length} caracteres (óptimo: 50-60)`,
          howToFix: 'Ajusta el título a 50-60 caracteres',
          impact: 'Se corta en resultados de Google'
        });
        seoScore -= 10;
      }

      // Meta Description
      const description = $('meta[name="description"]').attr('content');
      if (!description) {
        issues.push({
          category: 'seo',
          severity: 'critico',
          title: 'Sin meta description',
          description: 'No hay meta description',
          howToFix: 'Agrega <meta name="description" content="Tu descripción aquí">',
          impact: 'Google no muestra descripción atractiva, -30% CTR'
        });
        seoScore -= 20;
      } else if (description.length < 120 || description.length > 160) {
        issues.push({
          category: 'seo',
          severity: 'medio',
          title: 'Meta description con longitud incorrecta',
          description: `La descripción tiene ${description.length} caracteres (óptimo: 120-160)`,
          howToFix: 'Ajusta la descripción a 120-160 caracteres',
          impact: 'Se corta en resultados de búsqueda'
        });
        seoScore -= 5;
      }

      // H1
      const h1Count = $('h1').length;
      if (h1Count === 0) {
        issues.push({
          category: 'seo',
          severity: 'alto',
          title: 'Sin H1 en la página',
          description: 'No hay ningún <h1>',
          howToFix: 'Agrega un <h1> con el tema principal de la página',
          impact: 'Google no identifica tema principal'
        });
        seoScore -= 15;
      } else if (h1Count > 1) {
        issues.push({
          category: 'seo',
          severity: 'medio',
          title: 'Múltiples H1 en la página',
          description: `Hay ${h1Count} H1 (debe haber solo 1)`,
          howToFix: 'Usa solo un H1, los demás deben ser H2, H3, etc.',
          impact: 'Confunde a Google sobre jerarquía de contenido'
        });
        seoScore -= 5;
      }

      // Open Graph
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');

      if (!ogTitle || !ogDescription || !ogImage) {
        issues.push({
          category: 'seo',
          severity: 'medio',
          title: 'Open Graph incompleto',
          description: 'Faltan tags OG para redes sociales',
          howToFix: 'Agrega og:title, og:description, og:image',
          impact: 'Se ve mal al compartir en Facebook, LinkedIn, WhatsApp'
        });
        seoScore -= 10;
      }

      // Robots.txt
      try {
        const robotsResponse = await axios.get(`https://${this.domain}/robots.txt`);
        if (robotsResponse.status !== 200) {
          issues.push({
            category: 'seo',
            severity: 'bajo',
            title: 'Sin robots.txt',
            description: 'No se encontró archivo robots.txt',
            howToFix: 'Crea /robots.txt con instrucciones para bots',
            impact: 'Menor control sobre qué indexa Google'
          });
          seoScore -= 5;
        }
      } catch (error) {
        // robots.txt no existe
        seoScore -= 5;
      }

      // Sitemap
      try {
        const sitemapResponse = await axios.get(`https://${this.domain}/sitemap.xml`);
        if (sitemapResponse.status !== 200) {
          issues.push({
            category: 'seo',
            severity: 'medio',
            title: 'Sin sitemap.xml',
            description: 'No se encontró sitemap XML',
            howToFix: 'Genera /sitemap.xml con todas tus URLs',
            impact: 'Google tarda más en descubrir páginas nuevas'
          });
          seoScore -= 10;
        }
      } catch (error) {
        // sitemap no existe
        seoScore -= 10;
      }

      await browser.close();

      return {
        score: Math.max(0, seoScore),
        issues,
        recommendations: []
      };

    } catch (error) {
      console.error('Error en análisis SEO:', error);
      return {
        score: 0,
        issues: [{
          category: 'seo',
          severity: 'critico',
          title: 'Error analizando SEO',
          description: error.message,
          howToFix: 'Verifica que el sitio esté accesible',
          impact: 'No se puede analizar SEO'
        }],
        recommendations: []
      };
    }
  }

  // =====================================================
  // SECURITY ANALYSIS
  // =====================================================
  async analyzeSecurity() {
    console.log('Analizando Seguridad...');

    const issues = [];
    let securityScore = 100;

    try {
      // Check HTTPS
      if (!this.url.startsWith('https://')) {
        issues.push({
          category: 'security',
          severity: 'critico',
          title: 'Sin HTTPS (SSL)',
          description: 'El sitio no usa conexión segura',
          howToFix: 'Instala certificado SSL (Let\'s Encrypt es gratis)',
          impact: 'Datos sin cifrar, Google penaliza -15pts ranking, navegadores muestran "No seguro"'
        });
        securityScore -= 50;
      }

      // Check security headers
      const response = await axios.get(this.url);
      const headers = response.headers;

      if (!headers['strict-transport-security']) {
        issues.push({
          category: 'security',
          severity: 'medio',
          title: 'Sin header HSTS',
          description: 'Falta Strict-Transport-Security header',
          howToFix: 'Agrega header: Strict-Transport-Security: max-age=31536000',
          impact: 'Vulnerable a ataques downgrade SSL'
        });
        securityScore -= 10;
      }

      if (!headers['x-frame-options']) {
        issues.push({
          category: 'security',
          severity: 'alto',
          title: 'Sin protección X-Frame-Options',
          description: 'Falta header X-Frame-Options',
          howToFix: 'Agrega header: X-Frame-Options: DENY',
          impact: 'Vulnerable a clickjacking'
        });
        securityScore -= 15;
      }

      if (!headers['x-content-type-options']) {
        issues.push({
          category: 'security',
          severity: 'medio',
          title: 'Sin X-Content-Type-Options',
          description: 'Falta header X-Content-Type-Options',
          howToFix: 'Agrega header: X-Content-Type-Options: nosniff',
          impact: 'Vulnerable a MIME sniffing attacks'
        });
        securityScore -= 10;
      }

      return {
        score: Math.max(0, securityScore),
        issues,
        recommendations: []
      };

    } catch (error) {
      console.error('Error en análisis de seguridad:', error);
      return {
        score: 0,
        issues: [{
          category: 'security',
          severity: 'critico',
          title: 'Error analizando seguridad',
          description: error.message,
          howToFix: 'Verifica que el sitio esté accesible',
          impact: 'No se puede analizar seguridad'
        }],
        recommendations: []
      };
    }
  }

  // =====================================================
  // UX ANALYSIS
  // =====================================================
  async analyzeUX() {
    console.log('Analizando UX...');

    const issues = [];
    let uxScore = 100;

    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox']
      });

      // Test mobile
      const page = await browser.newPage();
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(this.url, { waitUntil: 'networkidle2' });

      // Check if mobile-friendly
      const viewport = await page.evaluate(() => {
        return document.querySelector('meta[name="viewport"]')?.getAttribute('content');
      });

      if (!viewport) {
        issues.push({
          category: 'ux',
          severity: 'critico',
          title: 'No es mobile-friendly',
          description: 'Falta meta viewport',
          howToFix: 'Agrega <meta name="viewport" content="width=device-width, initial-scale=1">',
          impact: 'Se ve horrible en celular, Google penaliza en mobile'
        });
        uxScore -= 30;
      }

      // Check forms
      const forms = await page.$$('form');
      for (const form of forms) {
        const action = await form.evaluate(el => el.action);
        if (action && !action.startsWith('https://')) {
          issues.push({
            category: 'ux',
            severity: 'alto',
            title: 'Formulario sin HTTPS',
            description: 'Hay formularios que envían datos sin cifrar',
            howToFix: 'Cambia action del form a HTTPS',
            impact: 'Datos de usuarios vulnerables'
          });
          uxScore -= 20;
          break;
        }
      }

      await browser.close();

      return {
        score: Math.max(0, uxScore),
        issues,
        recommendations: []
      };

    } catch (error) {
      console.error('Error en análisis UX:', error);
      return {
        score: 50,
        issues: [],
        recommendations: []
      };
    }
  }

  // =====================================================
  // COLLECT ALL ISSUES
  // =====================================================
  collectAllIssues(categories) {
    const allIssues = [];

    for (const category of Object.values(categories)) {
      if (category.issues && category.issues.length > 0) {
        allIssues.push(...category.issues);
      }
    }

    return allIssues;
  }
}

module.exports = WebAnalyzer;
