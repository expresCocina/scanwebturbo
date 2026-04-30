const Anthropic = require('@anthropic-ai/sdk');

class AIProcessor {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async process(domain, analysisResults) {
    console.log('Procesando con IA...');

    try {
      // Preparar contexto para Claude
      const context = this.buildContext(domain, analysisResults);

      // Llamar a Claude API
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: context
        }]
      });

      // Parsear respuesta — Claude a veces envuelve en ```json ... ```
      let rawText = message.content[0].text.trim();
      // Eliminar bloques de código markdown si existen
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const aiResponse = JSON.parse(rawText);

      return {
        recommendations: aiResponse.recommendations || [],
        summary: aiResponse.summary || '',
        priorityActions: aiResponse.priorityActions || []
      };

    } catch (error) {
      console.error('Error en procesamiento IA:', error);
      return {
        recommendations: [],
        summary: 'No se pudo generar análisis con IA',
        priorityActions: []
      };
    }
  }

  buildContext(domain, results) {
    const issuesByCategory = {};
    
    for (const issue of results.issues || []) {
      if (!issuesByCategory[issue.category]) {
        issuesByCategory[issue.category] = [];
      }
      issuesByCategory[issue.category].push(issue);
    }

    return `Eres un experto en auditorías web. Analiza los siguientes resultados de la auditoría del sitio ${domain} y genera recomendaciones priorizadas.

RESULTADOS DEL ANÁLISIS:

Scores por categoría:
- Performance: ${results.categories.performance?.score || 0}/100
- SEO: ${results.categories.seo?.score || 0}/100  
- Seguridad: ${results.categories.security?.score || 0}/100
- UX: ${results.categories.ux?.score || 0}/100

Issues detectados:
${JSON.stringify(issuesByCategory, null, 2)}

INSTRUCCIONES:
Genera un JSON con la siguiente estructura (responde SOLO con JSON válido, sin texto adicional):

{
  "summary": "Resumen ejecutivo de 2-3 oraciones sobre el estado general del sitio",
  "priorityActions": [
    "Acción 1 más importante",
    "Acción 2",
    "Acción 3"
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Título corto",
      "description": "Explicación clara de qué hacer y por qué",
      "expectedImpact": "Qué mejorará específicamente",
      "effortLevel": "bajo|medio|alto",
      "category": "performance|seo|security|ux"
    }
  ]
}

IMPORTANTE:
- Ordena recommendations por impacto vs esfuerzo (quick wins primero)
- Usa lenguaje simple, sin tecnicismos excesivos
- Sé específico en las acciones
- Máximo 8 recomendaciones
- expectedImpact debe ser cuantificable cuando sea posible (ej: "+20% velocidad")`;
  }
}

module.exports = AIProcessor;
