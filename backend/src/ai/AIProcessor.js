const Anthropic = require('@anthropic-ai/sdk');

class AIProcessor {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async process(domain, analysisResults) {
    console.log('Procesando con IA...');
    try {
      const context = this.buildContext(domain, analysisResults);
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: context }]
      });

      let raw = message.content[0].text.trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(raw);

      return {
        recommendations: parsed.recommendations || [],
        summary: parsed.summary || '',
        priorityActions: parsed.priorityActions || []
      };
    } catch (error) {
      console.error('Error en procesamiento IA:', error);
      return { recommendations: [], summary: 'No se pudo generar análisis con IA.', priorityActions: [] };
    }
  }

  buildContext(domain, results) {
    const cats = results.categories || {};
    const issues = results.issues || [];

    const criticalIssues = issues.filter(i => i.severity === 'critico');
    const highIssues     = issues.filter(i => i.severity === 'alto');

    const scoreBlock = Object.entries(cats)
      .map(([name, data]) => `- ${name}: ${data.score}/100`)
      .join('\n');

    const issueBlock = issues.slice(0, 20).map(i =>
      `[${i.severity.toUpperCase()}][${i.category}] ${i.title}`
    ).join('\n');

    const metricsBlock = (() => {
      const m = cats.performance?.metrics;
      if (!m) return 'No disponible';
      return [
        m.fcp    !== undefined ? `FCP: ${(m.fcp/1000).toFixed(1)}s`         : '',
        m.lcp    !== undefined ? `LCP: ${(m.lcp/1000).toFixed(1)}s`         : '',
        m.tbt    !== undefined ? `TBT: ${m.tbt}ms`                           : '',
        m.cls    !== undefined ? `CLS: ${m.cls}`                             : '',
        m.speedIndex !== undefined ? `Speed Index: ${(m.speedIndex/1000).toFixed(1)}s` : '',
        m.ttfb   !== undefined ? `TTFB: ${m.ttfb}ms`                         : '',
        m.totalTransferKB ? `Peso total: ${m.totalTransferKB}KB`             : '',
      ].filter(Boolean).join(' | ');
    })();

    return `Eres un experto senior en optimización web, SEO y conversión digital. Analiza la siguiente auditoría del sitio web "${domain}" y genera recomendaciones priorizadas, concretas y accionables.

SCORES POR CATEGORÍA:
${scoreBlock}

MÉTRICAS DE PERFORMANCE (Core Web Vitals):
${metricsBlock}

PROBLEMAS DETECTADOS (${issues.length} total — ${criticalIssues.length} críticos, ${highIssues.length} importantes):
${issueBlock}

INSTRUCCIONES:
Responde ÚNICAMENTE con JSON válido (sin texto adicional, sin markdown). Estructura exacta:

{
  "summary": "Resumen ejecutivo de 2-3 oraciones. Menciona el estado general, los 2 problemas más críticos y el impacto en el negocio. Usa lenguaje directo y sin tecnicismos.",
  "priorityActions": [
    "Acción concreta #1 con métrica de impacto esperado",
    "Acción concreta #2 con métrica de impacto esperado",
    "Acción concreta #3 con métrica de impacto esperado"
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Título corto y accionable (máx 60 chars)",
      "description": "Explicación de qué hacer, cómo y por qué. Incluye pasos concretos. Máx 3 oraciones.",
      "expectedImpact": "Impacto cuantificado cuando sea posible (ej: +30% velocidad, -15% tasa rebote)",
      "effortLevel": "bajo|medio|alto",
      "category": "performance|seo|security|accessibility|ux",
      "timeToFix": "estimación de tiempo (ej: 30 minutos, 1 día, 1 semana)"
    }
  ]
}

CRITERIOS:
- Ordena por impacto/esfuerzo (quick wins primero)
- Máximo 10 recomendaciones
- Si el score de performance es < 50, prioriza los Core Web Vitals
- Si hay problemas críticos de seguridad, ponlos en el top 3
- Si no hay problemas de una categoría, no la incluyas a la fuerza
- expectedImpact debe ser específico y realista, no genérico`;
  }
}

module.exports = AIProcessor;
