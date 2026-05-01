import jsPDF from 'jspdf'

interface AuditData {
  domain: string
  client_name: string | null
  score_global: number
  created_at: string
  public_slug: string
}

interface Category {
  category: string
  score: number
}

interface Issue {
  category: string
  severity: string
  title: string
  description: string
  how_to_fix: string
  impact: string
}

const CAT_NAMES: Record<string, string> = {
  performance: 'Velocidad',
  seo: 'SEO',
  security: 'Seguridad',
  ux: 'Experiencia de Usuario',
}

const SEV_LABELS: Record<string, string> = {
  critico: 'URGENTE',
  alto: 'IMPORTANTE',
  medio: 'RECOMENDADO',
  bajo: 'OPCIONAL',
}

function scoreLabel(s: number) {
  if (s >= 80) return 'Excelente'
  if (s >= 60) return 'Bueno'
  if (s >= 40) return 'Mejorable'
  return 'Crítico'
}

function scoreRGB(s: number): [number, number, number] {
  if (s >= 80) return [34, 197, 94]
  if (s >= 60) return [234, 179, 8]
  if (s >= 40) return [249, 115, 22]
  return [239, 68, 68]
}

function sevRGB(sev: string): [number, number, number] {
  if (sev === 'critico') return [239, 68, 68]
  if (sev === 'alto') return [249, 115, 22]
  if (sev === 'medio') return [234, 179, 8]
  return [59, 130, 246]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

// wrap text and return lines
function wrapText(doc: jsPDF, text: string, x: number, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth)
}

export async function generateAuditPDF(
  audit: AuditData,
  categories: Category[],
  issues: Issue[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const H = 297
  const margin = 18
  const contentW = W - margin * 2

  // ─── Helper: new page with header ───────────────────────────
  let pageNum = 1
  const addPage = () => {
    doc.addPage()
    pageNum++
    // Top bar
    doc.setFillColor(5, 15, 40)
    doc.rect(0, 0, W, 12, 'F')
    doc.setFontSize(7)
    doc.setTextColor(100, 120, 160)
    doc.text('WebScan · Reporte de Auditoría Web · TurboBrand Colombia', margin, 8)
    doc.text(`Página ${pageNum}`, W - margin, 8, { align: 'right' })
    return 20 // starting Y
  }

  // ─── COVER PAGE ──────────────────────────────────────────────
  // Dark background
  doc.setFillColor(5, 15, 40)
  doc.rect(0, 0, W, H, 'F')

  // Blue accent bar top
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, W, 3, 'F')

  // Blue accent bar left
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, 3, H, 'F')

  // LOGO placeholder (blue square with WS text)
  doc.setFillColor(37, 99, 235)
  doc.roundedRect(margin, 30, 20, 20, 3, 3, 'F')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('WS', margin + 10, 43, { align: 'center' })

  // Brand name
  doc.setFontSize(24)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('WebScan', margin + 24, 43)

  doc.setFontSize(9)
  doc.setTextColor(100, 140, 200)
  doc.setFont('helvetica', 'normal')
  doc.text('by TurboBrand Colombia', margin + 24, 50)

  // Divider
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.3)
  doc.line(margin, 60, W - margin, 60)

  // Report type
  doc.setFontSize(10)
  doc.setTextColor(100, 140, 200)
  doc.setFont('helvetica', 'normal')
  doc.text('REPORTE DE AUDITORÍA WEB', margin, 75)

  // Domain
  doc.setFontSize(28)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  const domainLines = wrapText(doc, audit.domain, margin, contentW)
  doc.text(domainLines, margin, 88)
  let coverY = 88 + domainLines.length * 10

  // Client
  if (audit.client_name) {
    doc.setFontSize(13)
    doc.setTextColor(160, 180, 220)
    doc.setFont('helvetica', 'normal')
    doc.text(audit.client_name, margin, coverY + 4)
    coverY += 10
  }

  // BIG SCORE circle area
  const circleX = W / 2
  const circleY = 170
  const r = 28

  // Outer ring
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(1)
  doc.circle(circleX, circleY, r + 4, 'S')

  // Inner filled circle
  const [sr, sg, sb] = scoreRGB(audit.score_global)
  doc.setFillColor(sr, sg, sb)
  doc.circle(circleX, circleY, r, 'F')

  // Score number
  doc.setFontSize(32)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(String(audit.score_global), circleX, circleY + 4, { align: 'center' })

  doc.setFontSize(10)
  doc.text('/100', circleX, circleY + 12, { align: 'center' })

  // Score label
  doc.setFontSize(14)
  doc.setTextColor(sr, sg, sb)
  doc.text(scoreLabel(audit.score_global), circleX, circleY + 26, { align: 'center' })

  // Category summary row
  const catY = 215
  const catW = contentW / 4
  categories.forEach((cat, i) => {
    const cx = margin + catW * i + catW / 2
    const [cr, cg, cb] = scoreRGB(cat.score)
    doc.setFillColor(cr, cg, cb)
    doc.circle(cx, catY, 8, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(String(cat.score), cx, catY + 3, { align: 'center' })
    doc.setFontSize(7)
    doc.setTextColor(160, 180, 220)
    doc.setFont('helvetica', 'normal')
    doc.text(CAT_NAMES[cat.category] || cat.category, cx, catY + 14, { align: 'center' })
  })

  // Date & slug
  doc.setFontSize(8)
  doc.setTextColor(80, 100, 140)
  doc.text(`Fecha: ${formatDate(audit.created_at)}`, margin, H - 25)
  doc.text(`Referencia: ${audit.public_slug}`, margin, H - 19)
  doc.text('webscan.turbobrandcol.com', W - margin, H - 19, { align: 'right' })

  // ─── PAGE 2: CATEGORY DETAILS ────────────────────────────────
  let y = addPage()

  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('Análisis por Área', margin, y)
  y += 10

  categories.forEach(cat => {
    if (y > H - 50) { y = addPage() }

    const [cr, cg, cb] = scoreRGB(cat.score)
    const name = CAT_NAMES[cat.category] || cat.category

    // Category header bar
    doc.setFillColor(15, 30, 60)
    doc.roundedRect(margin, y, contentW, 16, 2, 2, 'F')
    doc.setFillColor(cr, cg, cb)
    doc.roundedRect(margin, y, 4, 16, 1, 1, 'F')

    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(name, margin + 8, y + 10)

    // Score pill
    doc.setFillColor(cr, cg, cb)
    doc.roundedRect(W - margin - 28, y + 3, 24, 10, 3, 3, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(`${cat.score}/100`, W - margin - 16, y + 10, { align: 'center' })

    y += 22

    // Category issues count
    const catIssues = issues.filter(i => i.category === cat.category)
    doc.setFontSize(8)
    doc.setTextColor(140, 160, 200)
    doc.setFont('helvetica', 'normal')
    doc.text(`${catIssues.length} problema${catIssues.length !== 1 ? 's' : ''} detectado${catIssues.length !== 1 ? 's' : ''} · Estado: ${scoreLabel(cat.score)}`, margin, y)
    y += 10
  })

  // ─── PAGE 3+: ISSUES ────────────────────────────────────────
  y = addPage()

  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('Problemas Detectados', margin, y)
  y += 4
  doc.setFontSize(8)
  doc.setTextColor(100, 120, 160)
  doc.setFont('helvetica', 'normal')
  doc.text(`${issues.length} problema${issues.length !== 1 ? 's' : ''} encontrado${issues.length !== 1 ? 's' : ''} en total`, margin, y + 4)
  y += 14

  // Sort by severity
  const order = ['critico', 'alto', 'medio', 'bajo']
  const sorted = [...issues].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))

  sorted.forEach((issue, idx) => {
    const [sr2, sg2, sb2] = sevRGB(issue.severity)
    const titleLines = wrapText(doc, issue.title, margin + 8, contentW - 40)
    const descLines = wrapText(doc, issue.description, margin + 4, contentW - 8)
    const impactLines = issue.impact ? wrapText(doc, `Por qué importa: ${issue.impact}`, margin + 4, contentW - 8) : []
    const fixLines = issue.how_to_fix ? wrapText(doc, `Cómo solucionarlo: ${issue.how_to_fix}`, margin + 4, contentW - 8) : []

    const blockH = 8 + titleLines.length * 5 + 3 + descLines.length * 4 +
      (impactLines.length > 0 ? 3 + impactLines.length * 4 : 0) +
      (fixLines.length > 0 ? 3 + fixLines.length * 4 : 0) + 8

    if (y + blockH > H - 15) { y = addPage() }

    // Card background
    doc.setFillColor(10, 20, 45)
    doc.roundedRect(margin, y, contentW, blockH - 4, 2, 2, 'F')

    // Severity color bar
    doc.setFillColor(sr2, sg2, sb2)
    doc.roundedRect(margin, y, 3, blockH - 4, 1, 1, 'F')

    // Severity label
    doc.setFontSize(7)
    doc.setTextColor(sr2, sg2, sb2)
    doc.setFont('helvetica', 'bold')
    doc.text(SEV_LABELS[issue.severity] || issue.severity.toUpperCase(), margin + 8, y + 6)

    // Category
    doc.setTextColor(100, 120, 160)
    doc.setFont('helvetica', 'normal')
    doc.text(` · ${CAT_NAMES[issue.category] || issue.category}`, margin + 8 + doc.getTextWidth(SEV_LABELS[issue.severity] || ''), y + 6)

    // Title
    let lineY = y + 12
    doc.setFontSize(10)
    doc.setTextColor(240, 245, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(titleLines, margin + 8, lineY)
    lineY += titleLines.length * 5 + 3

    // Description
    doc.setFontSize(8)
    doc.setTextColor(160, 180, 220)
    doc.setFont('helvetica', 'normal')
    doc.text(descLines, margin + 4, lineY)
    lineY += descLines.length * 4 + 3

    // Impact
    if (impactLines.length > 0) {
      doc.setTextColor(100, 160, 120)
      doc.text(impactLines, margin + 4, lineY)
      lineY += impactLines.length * 4 + 2
    }

    // Fix
    if (fixLines.length > 0) {
      doc.setTextColor(100, 140, 220)
      doc.text(fixLines, margin + 4, lineY)
    }

    y += blockH + 2
  })

  // ─── LAST PAGE: CTA ──────────────────────────────────────────
  y = addPage()

  doc.setFillColor(20, 40, 100)
  doc.roundedRect(margin, y, contentW, 70, 4, 4, 'F')

  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('¿Quieres arreglar estos problemas?', W / 2, y + 18, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(160, 200, 255)
  doc.setFont('helvetica', 'normal')
  const ctaText = wrapText(doc, 'Nuestro equipo en TurboBrand puede implementar todas las mejoras para ti. Más visitas, más clientes, más ventas.', W / 2, contentW - 20)
  doc.text(ctaText, W / 2, y + 30, { align: 'center' })

  // CTA button
  doc.setFillColor(37, 99, 235)
  doc.roundedRect(W / 2 - 40, y + 45, 80, 14, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('Agendar llamada gratis · turbobrandcol.com/agenda', W / 2, y + 54, { align: 'center' })

  y += 85

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(60, 80, 120)
  doc.text(`Reporte generado por WebScan · ${new Date().toLocaleDateString('es-CO')} · webscan.turbobrandcol.com`, W / 2, H - 10, { align: 'center' })

  // ─── DOWNLOAD ───────────────────────────────────────────────
  const filename = `WebScan-${audit.domain.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
