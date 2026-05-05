import { NextRequest, NextResponse } from 'next/server'

// Proxy to Railway backend — avoids CORS entirely since this runs server-side
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const backendUrl = process.env.BACKEND_WORKER_URL ||
                       process.env.NEXT_PUBLIC_BACKEND_WORKER_URL ||
                       'http://localhost:4000'

    const response = await fetch(`${backendUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({ ok: response.ok }))

    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[proxy /api/analyze]', error?.message)
    return NextResponse.json(
      { error: 'No se pudo conectar con el servidor de análisis' },
      { status: 502 }
    )
  }
}
