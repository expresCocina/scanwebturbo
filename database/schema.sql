-- WebScan Database Schema
-- TurboBrand - Sistema de Auditoría Web
-- Ejecutar en Supabase SQL Editor

-- =====================================================
-- TABLA: audits
-- Almacena cada auditoría realizada
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    client_name TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    score_global INTEGER CHECK (score_global >= 0 AND score_global <= 100),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    public_slug TEXT UNIQUE NOT NULL,
    report_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_audits_status ON public.audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON public.audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_public_slug ON public.audits(public_slug);
CREATE INDEX IF NOT EXISTS idx_audits_domain ON public.audits(domain);

-- =====================================================
-- TABLA: audit_categories
-- Categorías de análisis (Performance, SEO, etc)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('performance', 'seo', 'security', 'ux')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    issues JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_categories_audit_id ON public.audit_categories(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_categories_category ON public.audit_categories(category);

-- =====================================================
-- TABLA: audit_issues
-- Issues específicos detectados
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critico', 'alto', 'medio', 'bajo')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    how_to_fix TEXT,
    impact TEXT,
    code_example TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_issues_audit_id ON public.audit_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity ON public.audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_audit_issues_category ON public.audit_issues(category);

-- =====================================================
-- TABLA: audit_recommendations
-- Recomendaciones generadas por IA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 10),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    expected_impact TEXT,
    effort_level TEXT CHECK (effort_level IN ('bajo', 'medio', 'alto')),
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_recommendations_audit_id ON public.audit_recommendations(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_recommendations_priority ON public.audit_recommendations(priority);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Habilitar RLS en todas las tablas
-- =====================================================
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_recommendations ENABLE ROW LEVEL SECURITY;

-- Políticas: Permitir lectura pública de auditorías completadas (para reportes públicos)
CREATE POLICY "Public audits are viewable by everyone" ON public.audits
    FOR SELECT USING (status = 'completed');

-- Políticas: Solo usuarios autenticados pueden crear auditorías
CREATE POLICY "Authenticated users can create audits" ON public.audits
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas: Solo usuarios autenticados pueden actualizar sus propias auditorías
CREATE POLICY "Users can update their own audits" ON public.audits
    FOR UPDATE USING (auth.uid() = created_by);

-- Políticas: Permitir lectura de categorías de auditorías completadas
CREATE POLICY "Public audit categories are viewable" ON public.audit_categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.audits 
            WHERE audits.id = audit_categories.audit_id 
            AND audits.status = 'completed'
        )
    );

-- Políticas: Permitir lectura de issues de auditorías completadas
CREATE POLICY "Public audit issues are viewable" ON public.audit_issues
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.audits 
            WHERE audits.id = audit_issues.audit_id 
            AND audits.status = 'completed'
        )
    );

-- Políticas: Permitir lectura de recomendaciones de auditorías completadas
CREATE POLICY "Public audit recommendations are viewable" ON public.audit_recommendations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.audits 
            WHERE audits.id = audit_recommendations.audit_id 
            AND audits.status = 'completed'
        )
    );

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

-- Función para obtener estadísticas de una auditoría
CREATE OR REPLACE FUNCTION get_audit_stats(audit_uuid UUID)
RETURNS TABLE (
    total_issues BIGINT,
    critical_issues BIGINT,
    high_issues BIGINT,
    medium_issues BIGINT,
    low_issues BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE severity = 'critico') as critical_issues,
        COUNT(*) FILTER (WHERE severity = 'alto') as high_issues,
        COUNT(*) FILTER (WHERE severity = 'medio') as medium_issues,
        COUNT(*) FILTER (WHERE severity = 'bajo') as low_issues
    FROM public.audit_issues
    WHERE audit_id = audit_uuid;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener score promedio por categoría
CREATE OR REPLACE FUNCTION get_category_average_scores()
RETURNS TABLE (
    category TEXT,
    avg_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ac.category,
        ROUND(AVG(ac.score)::numeric, 2) as avg_score
    FROM public.audit_categories ac
    JOIN public.audits a ON a.id = ac.audit_id
    WHERE a.status = 'completed'
    GROUP BY ac.category;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para actualizar completed_at cuando status cambia a 'completed'
CREATE OR REPLACE FUNCTION update_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_completed_at
    BEFORE UPDATE ON public.audits
    FOR EACH ROW
    EXECUTE FUNCTION update_completed_at();

-- =====================================================
-- DATOS DE EJEMPLO (Opcional - Solo para testing)
-- =====================================================

-- Insertar auditoría de ejemplo
-- INSERT INTO public.audits (domain, client_name, status, score_global, public_slug, created_by)
-- VALUES ('ejemplo.com', 'Cliente Demo', 'completed', 75, 'demo-slug-123', NULL);

-- =====================================================
-- COMENTARIOS EN TABLAS
-- =====================================================

COMMENT ON TABLE public.audits IS 'Almacena todas las auditorías web realizadas';
COMMENT ON TABLE public.audit_categories IS 'Categorías de análisis con sus scores';
COMMENT ON TABLE public.audit_issues IS 'Issues específicos detectados en cada auditoría';
COMMENT ON TABLE public.audit_recommendations IS 'Recomendaciones priorizadas generadas por IA';

COMMENT ON COLUMN public.audits.public_slug IS 'Slug único para URL pública del reporte';
COMMENT ON COLUMN public.audits.report_data IS 'Datos completos del reporte en formato JSON';
COMMENT ON COLUMN public.audit_issues.severity IS 'Severidad: critico, alto, medio, bajo';
COMMENT ON COLUMN public.audit_recommendations.effort_level IS 'Nivel de esfuerzo para implementar la recomendación';

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
