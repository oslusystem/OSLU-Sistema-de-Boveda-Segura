import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, NIVEL_ROL } from '@/lib/auth'
import { getRequestId, errorResponse } from '@/lib/logger'

// Formatos permitidos explícitos (allow-list) para los parámetros de orden —
// cualquier otro valor cae al valor por defecto en vez de propagarse a Prisma.
const sortBySchema  = z.enum(['timestamp', 'evento']).catch('timestamp')
const sortDirSchema = z.enum(['asc', 'desc']).catch('desc')

// ─── GET: listar la bitácora de auditoría (sólo Admin) ───────────────────────
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.ADMIN) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
  const sp      = req.nextUrl.searchParams
  const page    = Math.max(1, Number(sp.get('page') ?? 1))
  const limit   = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 25)))
  const evento  = sp.get('evento') ?? ''
  const search  = sp.get('search') ?? ''
  const sortBy  = sortBySchema.parse(sp.get('sortBy'))
  const sortDir = sortDirSchema.parse(sp.get('sortDir'))

  // Para búsqueda por nombre de usuario buscamos los IDs primero (ya no hay FK/relación)
  let userIdsFromSearch: string[] = []
  if (search) {
    const matched = await prisma.usuario.findMany({
      where: { nombre_usuario: { contains: search, mode: 'insensitive' } },
      select: { id: true },
    })
    userIdsFromSearch = matched.map((u) => u.id)
  }

  const where = {
    ...(evento ? { evento } : {}),
    ...(search
      ? {
          OR: [
            { detalle:    { contains: search, mode: 'insensitive' as const } },
            { ip_address: { contains: search, mode: 'insensitive' as const } },
            ...(userIdsFromSearch.length > 0
              ? [{ usuario_id: { in: userIdsFromSearch } }]
              : []),
          ],
        }
      : {}),
  }

  const orderBy =
    sortBy === 'evento'
      ? { evento: sortDir }
      : { timestamp: sortDir }

  const [items, total] = await Promise.all([
    prisma.logAcceso.findMany({
      where,
      skip:    (page - 1) * limit,
      take:    limit,
      orderBy,
      select: {
        id: true, evento: true, detalle: true, ip_address: true,
        timestamp: true, usuario_id: true, firma_digital: true,
      },
    }),
    prisma.logAcceso.count({ where }),
  ])

  // Enriquecer con nombres de usuario en una segunda query (sin FK enforced)
  const ids = [...new Set(items.map((l) => l.usuario_id).filter(Boolean))] as string[]
  const usuariosMap = new Map<string, string>()
  if (ids.length > 0) {
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre_usuario: true },
    })
    usuarios.forEach((u) => usuariosMap.set(u.id, u.nombre_usuario))
  }

  return NextResponse.json({
    ok: true,
    data: {
      items: items.map((l) => ({
        ...l,
        timestamp: l.timestamp.toISOString(),
        usuario: l.usuario_id
          ? { id: l.usuario_id, nombre_usuario: usuariosMap.get(l.usuario_id) ?? '[Eliminado]' }
          : null,
      })),
      total, page, limit, pages: Math.ceil(total / limit),
    },
  })
  } catch (err) {
    return errorResponse('AUDITORIA_LIST', err, requestId)
  }
}
