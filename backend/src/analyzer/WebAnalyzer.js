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
      screenshot: null,
      timestamp: new Date().toISOString()
    };

    try {
      // 0. Captura de pantalla
      results.screenshot = await this.takeScreenshot();

      // 1. Performance
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
  // SCREENSHOT (full-page, desktop)
  // =====================================================
  async takeScreenshot() {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });
      const shot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
      await browser.close();
      return `data:image/jpeg;base64,${shot.toString('base64')}`;
    } catch (e) {
      console.error('Screenshot error:', e.message);
      return null;
    }
  }

  // =====================================================
  // PERFORMANCE ANALYSIS (Puppeteer + HTTP fallback)
  // =====================================================
  async analyzePerformance() {
    console.log('Analizando Performance...');

    // Try Puppeteer first, fall back to HTTP timing if blocked
    try {
      return await this._puppeteerPerformance();
    } catch (err) {
      console.warn('Puppeteer performance failed, using HTTP fallback:', err.message);
      return await this._httpPerformance();
    }
  }

  async _puppeteerPerformance() {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
             '--disable-extensions', '--disable-background-networking']
    });

    const page = await browser.newPage();

    // Simular navegador real para evitar bloqueos
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Bloquear recursos pesados no necesarios (fonts, imágenes grandes, analytics)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['font', 'media', 'websocket'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const startTime = Date.now();
    await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loadTime = Date.now() - startTime;

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');
      const resources = performance.getEntriesByType('resource');
      const totalSize = resources.reduce((acc, r) => acc + (r.transferSize || 0), 0);
      return {
        ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
        fullLoad: nav ? Math.round(nav.loadEventEnd) : 0,
        fcp: fcp ? Math.round(fcp.startTime) : 0,
        resourceCount: resources.length,
        totalTransferKB: Math.round(totalSize / 1024),
        jsCount: resources.filter(r => r.initiatorType === 'script').length,
        imgCount: resources.filter(r => r.initiatorType === 'img').length,
      };
    });

    await browser.close();
    return this._buildPerformanceResult(metrics, loadTime);
  }

  async _httpPerformance() {
    // Fallback: medir solo TTFB y tiempo total con HTTP
    const startTime = Date.now();
    let ttfbMs = 0;
    let loadTime = 0;

    try {
      const response = await axios.get(this.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        maxRedirects: 5,
      });
      loadTime = Date.now() - startTime;
      ttfbMs = loadTime; // aproximación
      const html = response.data || '';
      const imgCount = (html.match(/<img/gi) || []).length;
      const scriptCount = (html.match(/<script/gi) || []).length;
      const sizeKB = Math.round(Buffer.byteLength(html, 'utf8') / 1024);

      return this._buildPerformanceResult({
        ttfb: ttfbMs,
        fullLoad: loadTime,
        fcp: loadTime,
        resourceCount: imgCount + scriptCount,
        totalTransferKB: sizeKB,
        jsCount: scriptCount,
        imgCount,
      }, loadTime);
    } catch (e) {
      // Si ambos fallan, devolver score parcial con mensaje amigable
      return {
        score: 50,
        metrics: { fcp: 'No medido', ttfb: 'No medido', fullLoad: 'No medido', totalSize: 'No medido', jsFiles: 0, resources: 0 },
        issues: [{
          category: 'performance',
          severity: 'medio',
          title: 'No se pudo medir la velocidad automáticamente',
          description: 'El sistema no pudo conectarse al sitio para medir su velocidad. Esto puede ocurrir si el sitio tiene protección anti-bots o si está caído temporalmente. La velocidad es un factor clave en Google.',
          howToFix: 'Puedes medir tu velocidad manualmente en PageSpeed Insights (pagespeed.web.dev). Comparte el resultado con tu desarrollador para priorizar las optimizaciones.',
          impact: 'Un sitio lento pierde visitas. Google usa la velocidad como factor de posicionamiento — sitios más rápidos aparecen más arriba en los resultados.',
        }],
        recommendations: [],
      };
    }
  }

  _buildPerformanceResult(metrics, loadTime) {
    const fcpMs = metrics.fcp || loadTime;
    const ttfbMs = metrics.ttfb || 0;
    const fullLoadMs = metrics.fullLoad || loadTime;

    let score = 100;
    if (fcpMs > 3000) score -= 30; else if (fcpMs > 1800) score -= 15;
    if (ttfbMs > 500) score -= 20; else if (ttfbMs > 200) score -= 10;
    if (fullLoadMs > 6000) score -= 25; else if (fullLoadMs > 3000) score -= 12;
    if (metrics.totalTransferKB > 3000) score -= 15; else if (metrics.totalTransferKB > 1500) score -= 8;
    if (metrics.jsCount > 20) score -= 10; else if (metrics.jsCount > 10) score -= 5;
    score = Math.max(10, Math.min(100, score));

    const issues = [];

    if (fcpMs > 1800) {
      issues.push({
        category: 'performance',
        severity: fcpMs > 3000 ? 'critico' : 'alto',
        title: 'Tu sitio tarda demasiado en mostrar contenido',
        description: `Tu sitio tarda ${(fcpMs / 1000).toFixed(1)} segundos en mostrar el primer contenido visible. Lo ideal es menos de 1.8 segundos. Un segundo de retraso reduce las conversiones hasta un 7%.`,
        howToFix: 'Optimiza las imágenes del sitio (usa formatos WebP), activa la compresión GZIP en el servidor, y considera usar una red de entrega de contenido (CDN). Tu desarrollador puede implementar esto en 1-2 días.',
        impact: 'Los visitantes abandonan páginas lentas antes de ver tu oferta. Si tienes 1,000 visitas al mes y el sitio es lento, puedes estar perdiendo 300-400 clientes potenciales.',
      });
    }

    if (ttfbMs > 200) {
      issues.push({
        category: 'performance',
        severity: ttfbMs > 500 ? 'alto' : 'medio',
        title: 'Tu servidor responde lento',
        description: `Tu servidor tarda ${ttfbMs} milisegundos en responder. Esto es como si un empleado tardara ${ttfbMs > 500 ? 'varios segundos' : 'un momento'} en atender al cliente. Lo ideal es menos de 200ms.`,
        howToFix: 'Considera mejorar tu plan de hosting, activar caché del servidor, u optimizar la base de datos si tu sitio es dinámico. Un buen hosting en Latinoamérica puede marcar la diferencia.',
        impact: 'Google usa la velocidad del servidor como factor de posicionamiento. Un servidor lento te baja en los resultados de búsqueda directamente.',
      });
    }

    if (metrics.totalTransferKB > 1500) {
      issues.push({
        category: 'performance',
        severity: metrics.totalTransferKB > 3000 ? 'alto' : 'medio',
        title: 'Tu página es demasiado pesada',
        description: `Tu sitio descarga ${metrics.totalTransferKB} KB de datos. Imagina que cada visitante tiene que descargar un archivo de ese tamaño antes de ver tu página. En celulares con datos móviles, esto se siente muy lento.`,
        howToFix: 'Comprime las imágenes antes de subirlas, elimina plugins o scripts que no usas, y minifica los archivos de código. Herramientas como TinyPNG (para imágenes) son gratuitas.',
        impact: 'En Colombia, muchos usuarios tienen conexiones móviles lentas. Un sitio pesado puede tardar 10+ segundos en cargar en 3G, haciendo que el cliente se vaya sin ver tu oferta.',
      });
    }

    if (metrics.jsCount > 10) {
      issues.push({
        category: 'performance',
        severity: 'medio',
        title: `Demasiados scripts cargando en tu página (${metrics.jsCount})`,
        description: `Tu sitio carga ${metrics.jsCount} archivos de código JavaScript. Cada uno de estos archivos debe descargarse y ejecutarse antes de que la página funcione correctamente. Es como tener ${metrics.jsCount} puertas que abrir antes de entrar a la tienda.`,
        howToFix: 'Elimina plugins o herramientas que no usas activamente. Asegúrate de cargar los scripts de redes sociales y analytics de forma diferida (lazy loading). Tu desarrollador puede auditarlos.',
        impact: 'Muchos scripts ralentizan la interactividad de tu sitio. Los usuarios no pueden hacer clic en botones ni rellenar formularios hasta que todos los scripts cargan.',
      });
    }

    return {
      score,
      metrics: {
        fcp: fcpMs > 0 ? `${(fcpMs / 1000).toFixed(1)}s` : 'No medido',
        ttfb: ttfbMs > 0 ? `${ttfbMs}ms` : 'No medido',
        fullLoad: fullLoadMs > 0 ? `${(fullLoadMs / 1000).toFixed(1)}s` : 'No medido',
        totalSize: metrics.totalTransferKB > 0 ? `${metrics.totalTransferKB}KB` : 'No medido',
        jsFiles: metrics.jsCount,
        resources: metrics.resourceCount,
      },
      issues,
      recommendations: [],
    };
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
          title: 'Tu página no tiene título visible en Google',
          description: 'Cuando alguien busca en Google, el título de tu página es lo primero que ve. Tu sitio no tiene título configurado, lo que significa que Google no sabe cómo presentarlo — simplemente muestra la URL, que nadie hace clic.',
          howToFix: 'Necesitas agregar una línea en el código que diga de qué trata tu página. Por ejemplo: si vendes zapatos en Bogotá, el título ideal sería "Zapatos de mujer en Bogotá | Tu Marca". Tu desarrollador puede hacerlo en minutos.',
          impact: 'Sin título, tu página prácticamente no existe en Google. Estás perdiendo visitas y clientes potenciales todos los días.'
        });
        seoScore -= 20;
      } else if (title.length < 30 || title.length > 60) {
        issues.push({
          category: 'seo',
          severity: 'alto',
          title: `El título de tu página está ${title.length > 60 ? 'demasiado largo' : 'muy corto'} para Google`,
          description: `El título de tu sitio tiene ${title.length} caracteres. Google muestra máximo 60 caracteres — si es más largo, lo corta con "..." y se ve incompleto. Si es muy corto, no describe bien tu negocio.`,
          howToFix: 'Ajusta el título a entre 50 y 60 caracteres. Incluye tu servicio principal y ciudad si aplica. Ejemplo: "Servicios de Contabilidad en Medellín | Empresa XYZ".',
          impact: 'Un título cortado o vago hace que los usuarios prefieran hacer clic en tu competencia.'
        });
        seoScore -= 10;
      }

      // Meta Description
      const description = $('meta[name="description"]').attr('content');
      if (!description) {
        issues.push({
          category: 'seo',
          severity: 'critico',
          title: 'Tu página no tiene descripción en Google',
          description: 'Debajo del título en Google aparece una descripción de 2 líneas que convence al usuario de hacer clic. Tu sitio no tiene esta descripción configurada, así que Google muestra texto aleatorio de tu página — usualmente algo sin sentido.',
          howToFix: 'Escribe una descripción de 1-2 frases que explique qué ofreces y por qué el cliente debería elegirte. Ejemplo: "Somos expertos en diseño web en Cali. Creamos sitios que venden. Cotiza gratis hoy." Tu desarrollador la agrega en 5 minutos.',
          impact: 'Sin descripción, pierdes hasta un 30% de los clics que podrías tener. Personas que te buscaron pero eligieron a tu competencia.'
        });
        seoScore -= 20;
      } else if (description.length < 120 || description.length > 160) {
        issues.push({
          category: 'seo',
          severity: 'medio',
          title: `La descripción de tu sitio está ${description.length > 160 ? 'cortada' : 'incompleta'} en Google`,
          description: `Tu descripción tiene ${description.length} caracteres. Google muestra entre 120-160 caracteres — si es más larga, la corta con "..." justo cuando estaba convenciendo al cliente. Si es muy corta, no dice suficiente.`,
          howToFix: 'Ajusta la descripción para que tenga entre 120 y 160 caracteres. Incluye qué haces, dónde y qué te diferencia. Termina con una llamada a la acción como "Contáctanos" o "Ver catálogo".',
          impact: 'Una descripción cortada o incompleta reduce la confianza del usuario y las probabilidades de que haga clic en tu sitio.'
        });
        seoScore -= 5;
      }

      // H1
      const h1Count = $('h1').length;
      if (h1Count === 0) {
        issues.push({
          category: 'seo',
          severity: 'alto',
          title: 'Tu página no tiene un titular principal',
          description: 'Cada página web debe tener un titular principal (llamado H1) que le dice a Google y a los visitantes de qué se trata. Es como el título de un periódico. Tu página no lo tiene, lo que confunde a los motores de búsqueda.',
          howToFix: 'Agrega un titular grande y claro al inicio de tu página que describa tu negocio o servicio. Por ejemplo: "Servicios de Plomería en Bogotá" o "Ropa de Mujer Exclusiva". Tu diseñador web puede hacerlo en minutos.',
          impact: 'Sin titular principal, Google no sabe de qué trata tu página y te posiciona más abajo en los resultados de búsqueda.'
        });
        seoScore -= 15;
      } else if (h1Count > 1) {
        issues.push({
          category: 'seo',
          severity: 'medio',
          title: `Tu página tiene ${h1Count} titulares principales cuando solo debe tener 1`,
          description: `Encontramos ${h1Count} titulares principales en tu página. Es como si un periódico tuviera ${h1Count} titulares iguales de importancia — confunde al lector y a Google sobre cuál es el tema principal.`,
          howToFix: 'Deja solo un titular principal (el más importante). Los demás conviértelos en subtítulos secundarios (H2, H3). Tu desarrollador puede identificarlos y corregirlos fácilmente.',
          impact: 'Tener varios titulares principales divide la "fuerza" de posicionamiento entre todos, debilitando tu presencia en Google.'
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
          title: 'Tu sitio se ve feo cuando lo comparten en WhatsApp o redes sociales',
          description: 'Cuando alguien comparte el enlace de tu negocio en WhatsApp, Facebook o LinkedIn, debería aparecer una tarjeta bonita con imagen, título y descripción. Tu sitio no está configurado para esto, así que solo se muestra el link feo sin imagen ni contexto.',
          howToFix: 'Configura las "etiquetas de redes sociales" (Open Graph). Básicamente es decirle a WhatsApp y Facebook qué imagen y texto mostrar cuando compartan tu link. Tu desarrollador puede hacerlo en menos de una hora.',
          impact: 'Un link sin imagen genera mucho menos clics. Estás perdiendo tráfico de personas que comparten tu sitio en grupos de WhatsApp o redes sociales.'
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
          title: 'Tu sitio NO es seguro — Google y Chrome lo marcan como peligroso',
          description: 'Tu sitio web no tiene el candadito verde de seguridad (SSL/HTTPS). Cuando un visitante llega, Chrome y Firefox le muestran una advertencia roja que dice "Sitio no seguro". La mayoría de personas se va inmediatamente al ver eso.',
          howToFix: 'Necesitas instalar un certificado de seguridad SSL en tu servidor. Muchos hostings como Hostinger, GoDaddy o SiteGround lo ofrecen gratis con un clic. Si tienes cPanel, busca la opción "SSL" y actívalo. Es urgente.',
          impact: 'Google penaliza los sitios sin SSL bajándolos en resultados de búsqueda. Además, el 85% de usuarios NO confía en sitios sin candado y se van sin comprar ni contactarte.'
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
          title: 'Tu sitio puede ser interceptado por hackers (sin HSTS)',
          description: 'Aunque tu sitio tiene el candado SSL, tiene una vulnerabilidad: un atacante podría engañar a los visitantes para que se conecten sin seguridad sin que se den cuenta. Esto se llama ataque de "degradación" y tu sitio actualmente no está protegido contra eso.',
          howToFix: 'Tu desarrollador o administrador del servidor debe agregar una configuración de seguridad que obligue siempre a usar la conexión cifrada. Se hace en el servidor web (Apache, Nginx o el panel de hosting) en menos de 10 minutos.',
          impact: 'Sin esta protección, la información de tus clientes (formularios, datos de contacto) podría ser interceptada en redes WiFi públicas o inseguras.'
        });
        securityScore -= 10;
      }

      if (!headers['x-frame-options']) {
        issues.push({
          category: 'security',
          severity: 'alto',
          title: 'Tu sitio puede ser copiado dentro de otras páginas web (Clickjacking)',
          description: 'Existe un tipo de ataque en el que los hackers ponen tu sitio web "invisible" dentro de otra página falsa. El usuario cree que está en tu página real, hace clic o escribe datos, pero en realidad está en una trampa. Tu sitio no tiene protección contra esto.',
          howToFix: 'Tu desarrollador o administrador del servidor puede agregar una línea de configuración que impide que tu sitio sea incrustado en otras páginas. Se resuelve en minutos modificando la configuración del servidor web.',
          impact: 'Si tus clientes son víctimas de este engaño usando tu página, se daña la reputación de tu negocio y podrías perder la confianza de tus usuarios.'
        });
        securityScore -= 15;
      }

      if (!headers['x-content-type-options']) {
        issues.push({
          category: 'security',
          severity: 'medio',
          title: 'Tu sitio permite que se ejecuten archivos maliciosos',
          description: 'Hay una configuración de seguridad faltante que podría permitir que hackers engañen al navegador para ejecutar archivos dañinos como si fueran seguros. Es una vulnerabilidad técnica pero con consecuencias reales para tus visitantes.',
          howToFix: 'Tu desarrollador agrega una línea de configuración en el servidor (X-Content-Type-Options: nosniff) que soluciona el problema en menos de 5 minutos. Es un cambio pequeño pero importante.',
          impact: 'Aunque es una vulnerabilidad técnica, si es explotada puede afectar la experiencia y seguridad de los visitantes de tu sitio, dañando tu reputación.'
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
          title: 'Tu sitio se ve roto en celulares y tablets',
          description: 'Más del 70% de las personas navegan desde su celular. Tu sitio no está configurado para verse bien en dispositivos móviles: el texto aparece diminuto, los botones no se pueden tocar y el usuario tiene que hacer zoom para leer. Eso los hace irse inmediatamente.',
          howToFix: 'Tu desarrollador necesita hacer tu sitio "responsive" (adaptable a cualquier pantalla). Si usas WordPress, muchos temas ya lo hacen automáticamente. Si es un sitio personalizado, es un trabajo de diseño que puede tomar entre 1 y 3 días.',
          impact: 'Google prioriza los sitios mobile-friendly en sus resultados. Si tu sitio no funciona en celular, Google te baja drásticamente y tus clientes móviles se van con tu competencia.'
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
            title: 'Los datos que envían tus clientes en formularios no están protegidos',
            description: 'Tienes formularios de contacto, cotización o registro en tu sitio, pero la información que escriben los usuarios (nombre, teléfono, email) viaja sin cifrar por internet. Es como enviar una carta sin sobre — cualquiera puede leerla.',
            howToFix: 'Tu desarrollador debe cambiar la configuración del formulario para que use conexión segura HTTPS. Es un cambio de una línea en el código que se hace en minutos.',
            impact: 'Si los datos de tus clientes son interceptados, puede haber problemas legales y pérdida total de confianza. En Colombia, la Ley 1581 de protección de datos exige medidas de seguridad básicas.'
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
