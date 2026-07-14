import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, hashPassword, getAdminPrincipalId, NIVEL_ROL, TOPE_CLASIFICACION_ROL, NOMBRE_NIVEL_CLASIFICACION } from '@/lib/auth'
import { registrarEvento, extraerOrigen } from '@/lib/audit'
import { passwordSchema } from '@/lib/validation'
import { getRequestId, errorResponse } from '@/lib/logger'

const createSchema = z.object({
  nombre_usuario:         z.string().min(3).max(120),
  password:               passwordSchema,
  rol_id:                 z.string().min(1),
  nivel_clasificacion_id: z.string().min(1),
})

// ─── GET: listar usuarios (sólo Admin) ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.ADMIN) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
    // El administrador principal (la cuenta admin más antigua) no se lista: no debe
    // poder editarse, desactivarse ni eliminarse desde esta UI.
    const principalId = await getAdminPrincipalId()

    const usuarios = await prisma.usuario.findMany({
      where: principalId ? { id: { not: principalId } } : undefined,
      orderBy: { fecha_creacion: 'desc' },
      select: {
        id: true, nombre_usuario: true, activo: true, fecha_creacion: true,
        rol:                 { select: { id: true, nombre_rol: true, nivel_numerico: true } },
        nivel_clasificacion: { select: { id: true, nombre: true, nivel_numerico: true } },
      },
    })

    return NextResponse.json({
      ok: true,
      data: usuarios.map((u) => ({ ...u, fecha_creacion: u.fecha_creacion.toISOString() })),
    })
  } catch (err) {
    return errorResponse('USUARIOS_LIST', err, requestId)
  }
}

// ─── POST: crear usuario (sólo Admin) ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.ADMIN) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { nombre_usuario, password, rol_id, nivel_clasificacion_id } = parsed.data

    const exists = await prisma.usuario.findUnique({ where: { nombre_usuario } })
    if (exists) return NextResponse.json({ ok: false, error: 'El nombre de usuario ya existe' }, { status: 409 })

    // Ciertos roles tienen un tope de acreditación fijo (ver TOPE_CLASIFICACION_ROL).
    const [rol, nivel] = await Promise.all([
      prisma.rol.findUnique({ where: { id: rol_id }, select: { nivel_numerico: true } }),
      prisma.clasificacionSeguridad.findUnique({ where: { id: nivel_clasificacion_id }, select: { nivel_numerico: true } }),
    ])
    if (!rol || !nivel) return NextResponse.json({ ok: false, error: 'Rol o nivel inexistente' }, { status: 400 })
    const topeRol = TOPE_CLASIFICACION_ROL[rol.nivel_numerico]
    if (topeRol !== undefined && nivel.nivel_numerico > topeRol) {
      return NextResponse.json(
        { ok: false, error: `Ese rol sólo puede tener acreditación ${NOMBRE_NIVEL_CLASIFICACION[topeRol]} o inferior` },
        { status: 400 },
      )
    }

    const usuario = await prisma.usuario.create({
      data: {
        nombre_usuario,
        password_hash: await hashPassword(password),
        rol_id,
        nivel_clasificacion_id,
      },
      select: {
        id: true, nombre_usuario: true, activo: true, fecha_creacion: true,
        rol:                 { select: { id: true, nombre_rol: true, nivel_numerico: true } },
        nivel_clasificacion: { select: { id: true, nombre: true, nivel_numerico: true } },
      },
    })

    await registrarEvento({
      usuarioId: session.sub,
      evento: 'CREATE_USER',
      detalle: `Creó al usuario "${nombre_usuario}"`,
      ...extraerOrigen(req),
    })

    return NextResponse.json(
      { ok: true, data: { ...usuario, fecha_creacion: usuario.fecha_creacion.toISOString() } },
      { status: 201 },
    )
  } catch (err) {
    return errorResponse('USUARIO_CREATE', err, requestId)
  }
}
