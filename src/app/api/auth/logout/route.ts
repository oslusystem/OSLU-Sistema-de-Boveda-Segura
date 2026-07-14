import { NextRequest, NextResponse } from 'next/server'
import { TOKEN_COOKIE, getSessionFromCookies } from '@/lib/auth'
import { registrarEvento, extraerOrigen } from '@/lib/audit'
import { getRequestId, errorResponse } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  try {
    const session = await getSessionFromCookies()
    if (session) {
      await registrarEvento({
        usuarioId: session.sub,
        evento: 'LOGOUT',
        detalle: 'Cierre de sesión',
        ...extraerOrigen(req),
      })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(TOKEN_COOKIE, '', { maxAge: 0, path: '/' })
    return res
  } catch (err) {
    return errorResponse('LOGOUT', err, requestId)
  }
}
