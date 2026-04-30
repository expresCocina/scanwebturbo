const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const WebAnalyzer = require('../analyzer/WebAnalyzer');
const AIProcessor = require('../ai/AIProcessor');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// POST /api/analyze
// Iniciar nueva auditoría
// =====================================================
router.post('/', async (req, res) => {
  const { auditId, domain, analysisType = 'complete' } = req.body;

  if (!auditId || !domain) {
    return res.status(400).json({
      error: 'auditId y domain son requeridos'
    });
  }

  try {
    // Actualizar status a processing
    await supabase
      .from('audits')
      .update({ status: 'processing' })
      .eq('id', auditId);

    // Iniciar análisis en background
    performAnalysis(auditId, domain, analysisType).catch(error => {
      console.error('Error en análisis:', error);
    });

    res.json({
      status: 'processing',
      auditId,
      message: 'Análisis iniciado correctamente'
    });

  } catch (error) {
    console.error('Error iniciando análisis:', error);
    res.status(500).json({
      error: 'Error al iniciar análisis',
      details: error.message
    });
  }
});

// =====================================================
// GET /api/analyze/:auditId
// Obtener status de una auditoría
// =====================================================
router.get('/:auditId', async (req, res) => {
  const { auditId } = req.params;

  try {
    const { data: audit, error } = await supabase
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (error) throw error;

    if (!audit) {
      return res.status(404).json({
        error: 'Auditoría no encontrada'
      });
    }

    res.json(audit);

  } catch (error) {
    console.error('Error obteniendo auditoría:', error);
    res.status(500).json({
      error: 'Error al obtener auditoría',
      details: error.message
    });
  }
});

// =====================================================
// FUNCIÓN: Realizar análisis completo
// =====================================================
async function performAnalysis(auditId, domain, analysisType) {
  console.log(`[${auditId}] Iniciando análisis de ${domain}`);
  
  try {
    // 1. Ejecutar análisis técnico
    const analyzer = new WebAnalyzer(domain);
    const analysisResults = await analyzer.analyze(analysisType);

    console.log(`[${auditId}] Análisis técnico completado`);

    // 2. Procesar con IA
    const aiProcessor = new AIProcessor();
    const aiResults = await aiProcessor.process(domain, analysisResults);

    console.log(`[${auditId}] Procesamiento IA completado`);

    // 3. Calcular score global
    const scoreGlobal = calculateGlobalScore(analysisResults.categories);

    // 4. Guardar categorías
    for (const [categoryName, categoryData] of Object.entries(analysisResults.categories)) {
      await supabase
        .from('audit_categories')
        .insert({
          audit_id: auditId,
          category: categoryName,
          score: categoryData.score,
          issues: categoryData.issues || [],
          recommendations: categoryData.recommendations || []
        });
    }

    // 5. Guardar issues
    for (const issue of analysisResults.issues || []) {
      await supabase
        .from('audit_issues')
        .insert({
          audit_id: auditId,
          category: issue.category,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          how_to_fix: issue.howToFix,
          impact: issue.impact,
          code_example: issue.codeExample
        });
    }

    // 6. Guardar recomendaciones IA
    for (const rec of aiResults.recommendations || []) {
      await supabase
        .from('audit_recommendations')
        .insert({
          audit_id: auditId,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          expected_impact: rec.expectedImpact,
          effort_level: rec.effortLevel,
          category: rec.category
        });
    }

    // 7. Actualizar auditoría como completada
    await supabase
      .from('audits')
      .update({
        status: 'completed',
        score_global: scoreGlobal,
        report_data: {
          ...analysisResults,
          ai: aiResults
        }
      })
      .eq('id', auditId);

    console.log(`[${auditId}] Auditoría completada exitosamente`);

  } catch (error) {
    console.error(`[${auditId}] Error en análisis:`, error);
    
    // Marcar como fallida
    await supabase
      .from('audits')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('id', auditId);
  }
}

// =====================================================
// FUNCIÓN: Calcular score global
// =====================================================
function calculateGlobalScore(categories) {
  const scores = Object.values(categories).map(c => c.score);
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(average);
}

module.exports = router;
