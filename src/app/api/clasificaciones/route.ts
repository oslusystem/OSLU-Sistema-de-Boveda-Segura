import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, TOPE_CLASIFICACION_ROL } from '@/lib/auth'

// ─── GET: catálogo de niveles de clasificación (para selects de formularios) ──
export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  // Un usuario sólo ve (y puede asignar) niveles hasta su propia acreditación.
  // Ciertos roles (Subalterno, General) tienen además un tope fijo por rol,
  // sin importar su acreditación individual (ver TOPE_CLASIFICACION_ROL).
  const topeRol = TOPE_CLASIFICACION_ROL[session.rol_nivel]
  const tope = topeRol !== undefined ? Math.min(topeRol, session.nivel) : session.nivel

  const niveles = await prisma.clasificacionSeguridad.findMany({
    where: { nivel_numerico: { lte: tope } },
    orderBy: { nivel_numerico: 'asc' },
    select: { id: true, nombre: true, nivel_numerico: true, descripcion: true },
  })

  return NextResponse.json({ ok: true, data: niveles })
}
