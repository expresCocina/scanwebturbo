-- ============================================================
-- LIMPIEZA DE AUDITORÍAS DE PRUEBA
-- WebScan · TurboBrand Colombia
-- ============================================================
-- PASO 1: Ver qué auditorías existen antes de borrar
-- ============================================================

SELECT 
  id,
  domain,
  client_name,
  status,
  score_global,
  created_at
FROM audits
ORDER BY created_at DESC;

-- ============================================================
-- PASO 2: Borrar TODAS las auditorías (y sus datos en cascada)
--         ⚠️ Ejecuta primero el PASO 1 para revisar
-- ============================================================

-- Borra los problemas detectados
DELETE FROM audit_issues
WHERE audit_id IN (SELECT id FROM audits);

-- Borra las categorías de análisis
DELETE FROM audit_categories
WHERE audit_id IN (SELECT id FROM audits);

-- Borra las auditorías
DELETE FROM audits;

-- ============================================================
-- ALTERNATIVA: Borrar solo las auditorías con status 'processing'
--              (las que quedaron colgadas)
-- ============================================================

/*
DELETE FROM audit_issues
WHERE audit_id IN (SELECT id FROM audits WHERE status = 'processing');

DELETE FROM audit_categories
WHERE audit_id IN (SELECT id FROM audits WHERE status = 'processing');

DELETE FROM audits
WHERE status = 'processing';
*/

-- ============================================================
-- ALTERNATIVA: Borrar solo auditorías específicas por dominio
-- ============================================================

/*
DELETE FROM audit_issues
WHERE audit_id IN (
  SELECT id FROM audits WHERE domain IN ('turbobrandcol.com')
);

DELETE FROM audit_categories
WHERE audit_id IN (
  SELECT id FROM audits WHERE domain IN ('turbobrandcol.com')
);

DELETE FROM audits
WHERE domain IN ('turbobrandcol.com');
*/

-- ============================================================
-- VERIFICACIÓN FINAL: Confirmar que quedó vacío
-- ============================================================

SELECT COUNT(*) AS audits_restantes FROM audits;
