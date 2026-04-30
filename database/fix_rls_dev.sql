-- =====================================================
-- WebScan - Parche RLS para Desarrollo sin Autenticación
-- TurboBrand - Ejecutar en Supabase SQL Editor
-- =====================================================

-- PROBLEMA: Las políticas RLS actuales bloquean:
--   1. INSERT porque exige auth.role() = 'authenticated'
--   2. SELECT del dashboard (solo muestra completed, no processing/failed)

-- SOLUCIÓN: Políticas más permisivas para desarrollo
-- (En producción puedes agregar auth completa)

-- 1. Eliminar políticas restrictivas actuales
DROP POLICY IF EXISTS "Authenticated users can create audits" ON public.audits;
DROP POLICY IF EXISTS "Public audits are viewable by everyone" ON public.audits;
DROP POLICY IF EXISTS "Users can update their own audits" ON public.audits;
DROP POLICY IF EXISTS "Public audit categories are viewable" ON public.audit_categories;
DROP POLICY IF EXISTS "Public audit issues are viewable" ON public.audit_issues;
DROP POLICY IF EXISTS "Public audit recommendations are viewable" ON public.audit_recommendations;

-- 2. Nuevas políticas: acceso completo para desarrollo
-- (El service_role_key del backend ignora RLS de todas formas)

-- Audits: Lectura total (dashboard ve todas las auditorías)
CREATE POLICY "Allow full read on audits" ON public.audits
    FOR SELECT USING (true);

-- Audits: Insertar libremente (sin auth requerida por ahora)
CREATE POLICY "Allow insert audits" ON public.audits
    FOR INSERT WITH CHECK (true);

-- Audits: Actualizar libremente (el backend actualiza status)
CREATE POLICY "Allow update audits" ON public.audits
    FOR UPDATE USING (true);

-- Audits: Borrar (opcional)
CREATE POLICY "Allow delete audits" ON public.audits
    FOR DELETE USING (true);

-- Categorías: acceso completo
CREATE POLICY "Allow full access audit_categories" ON public.audit_categories
    FOR ALL USING (true);

-- Issues: acceso completo
CREATE POLICY "Allow full access audit_issues" ON public.audit_issues
    FOR ALL USING (true);

-- Recomendaciones: acceso completo
CREATE POLICY "Allow full access audit_recommendations" ON public.audit_recommendations
    FOR ALL USING (true);

-- =====================================================
-- Verificar que todo quedó bien
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
