import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })

export const metadata: Metadata = {
  title: {
    default: 'WebScan — Auditoría Web Profesional | TurboBrand',
    template: '%s | WebScan by TurboBrand',
  },
  description:
    'Analiza la velocidad, SEO, seguridad y experiencia de usuario de cualquier sitio web en minutos. Reportes detallados con recomendaciones de IA. Powered by TurboBrand Colombia.',
  keywords: ['auditoría web', 'SEO', 'rendimiento web', 'lighthouse', 'análisis sitio web', 'TurboBrand', 'Colombia'],
  authors: [{ name: 'TurboBrand Colombia', url: 'https://turbobrandcol.com' }],
  creator: 'TurboBrand Colombia',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://webscan.turbobrandcol.com'),
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: 'https://webscan.turbobrandcol.com',
    siteName: 'WebScan by TurboBrand',
    title: 'WebScan — Auditoría Web Profesional',
    description: 'Descubre los problemas ocultos de tu sitio web con IA. Velocidad, SEO, Seguridad y UX en un solo reporte.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'WebScan Logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WebScan — Auditoría Web Profesional',
    description: 'Descubre los problemas ocultos de tu sitio web con IA.',
    images: ['/logo.png'],
    creator: '@turbobrandcol',
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8fafc',
            },
          }}
        />
      </body>
    </html>
  )
}
