const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const WebAnalyzer = require('../analyzer/WebAnalyzer');
const AIProcessor = require('../ai/AIProcessor');

global.WebSocket = WebSocket;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// =====================================================
// POST /api/analyze — iniciar nueva auditoría
// =====================================================
router.post('/', async (req, res) => {
  const { auditId, domain, analysisType = 'complete' } = req.body;

  if (!auditId || !domain) {
    return res.status(400).json({ error: 'auditId y domain son requeridos' });
  }

  try {
    await supabase.from('audits').update({ status: 'processing' }).eq('id', auditId);

    performAnalysis(auditId, domain, analysisType).catch(err => {
      console.error('Error en análisis background:', err);
    });

    res.json({ status: 'processing', auditId, message: 'Análisis iniciado correctamente' });
  } catch (error) {
    console.error('Error iniciando análisis:', error);
    res.status(500).json({ error: 'Error al iniciar análisis', details: error.message });
  }
});

// =====================================================
// GET /api/analyze/:auditId — obtener estado
// =====================================================
router.get('/:auditId', async (req, res) => {
  const { auditId } = req.params;
  try {
    const { data: audit, error } = await supabase
      .from('audits').select('*').eq('id', auditId).single();
    if (error) throw error;
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    res.json(audit);
  } catch (error) {
    console.error('Error obteniendo auditoría:', error);
    res.status(500).json({ error: 'Error al obtener auditoría', details: error.message });
  }
});

// =====================================================
// FUNCIÓN: Realizar análisis completo
// =====================================================
async function performAnalysis(auditId, domain, analysisType) {
  console.log(`[${auditId}] Iniciando análisis de ${domain}`);

  try {
    const analyzer = new WebAnalyzer(domain);
    const analysisResults = await analyzer.analyze(analysisType);
    console.log(`[${auditId}] Análisis técnico completado`);

    const aiProcessor = new AIProcessor();
    const aiResults = await aiProcessor.process(domain, analysisResults);
    console.log(`[${auditId}] Procesamiento IA completado`);

    const scoreGlobal = calculateGlobalScore(analysisResults.categories);

    // Guardar categorías
    for (const [categoryName, categoryData] of Object.entries(analysisResults.categories)) {
      await supabase.from('audit_categories').insert({
        audit_id: auditId,
        category: categoryName,
        score: categoryData.score,
        issues: categoryData.issues || [],
        recommendations: categoryData.recommendations || []
      });
    }

    // Guardar issues
    for (const issue of analysisResults.issues || []) {
      await supabase.from('audit_issues').insert({
        audit_id: auditId,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        how_to_fix: issue.howToFix,
        impact: issue.impact,
        code_example: issue.codeExample || null
      });
    }

    // Guardar recomendaciones IA
    for (const rec of aiResults.recommendations || []) {
      await supabase.from('audit_recommendations').insert({
        audit_id: auditId,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        expected_impact: rec.expectedImpact,
        effort_level: rec.effortLevel,
        category: rec.category
      });
    }

    // Actualizar auditoría como completada
    await supabase.from('audits').update({
      status: 'completed',
      score_global: scoreGlobal,
      completed_at: new Date().toISOString(),
      report_data: {
        ...analysisResults,
        screenshot: analysisResults.screenshot || null,
        ai: aiResults
      }
    }).eq('id', auditId);

    console.log(`[${auditId}] Auditoría completada. Score global: ${scoreGlobal}`);

  } catch (error) {
    console.error(`[${auditId}] Error en análisis:`, error);
    await supabase.from('audits').update({
      status: 'failed',
      error_message: error.message
    }).eq('id', auditId);
  }
}

// =====================================================
// FUNCIÓN: Calcular score global (ponderado)
// =====================================================
function calculateGlobalScore(categories) {
  const weights = {
    performance:   0.25,
    seo:           0.22,
    security:      0.18,
    accessibility: 0.13,
    ux:            0.12,
    conversion:    0.10,
  };
  let total = 0, weightSum = 0;
  for (const [name, data] of Object.entries(categories)) {
    const w = weights[name] || 0.10;
    total += (data.score || 0) * w;
    weightSum += w;
  }
  return weightSum > 0 ? Math.round(total / weightSum) : 0;
}

module.exports = router;
