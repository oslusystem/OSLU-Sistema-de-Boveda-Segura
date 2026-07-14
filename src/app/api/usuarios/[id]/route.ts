import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, hashPassword, verifyPassword, getAdminPrincipalId, NIVEL_ROL, TOPE_CLASIFICACION_ROL, NOMBRE_NIVEL_CLASIFICACION } from '@/lib/auth'
import { registrarEvento, extraerOrigen } from '@/lib/audit'
import { passwordSchema } from '@/lib/validation'
import { getRequestId, errorResponse } from '@/lib/logger'

const patchSchema = z.object({
  nombre_usuario:         z.string().min(3).max(120).optional(),
  password:               passwordSchema.optional(),
  rol_id:                 z.string().optional(),
  nivel_clasificacion_id: z.string().optional(),
  activo:                 z.boolean().optional(),
})

// Confirmación reforzada exigida al eliminar una cuenta con rol Administrador:
// la contraseña de quien elimina y la del administrador objetivo.
const deleteAdminSchema = z.object({
  password_actual:   z.string().min(1, 'Requerida'),
  password_objetivo: z.string().min(1, 'Requerida'),
})

// ─── PATCH: editar usuario (sólo Admin) ───────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.ADMIN) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  if (id === await getAdminPrincipalId()) {
    return NextResponse.json({ ok: false, error: 'No se puede modificar al administrador principal del sistema' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })

  try {
  // Ciertos roles tienen un tope de acreditación fijo (ver TOPE_CLASIFICACION_ROL).
  // Resolvemos el rol/nivel EFECTIVOS (los del body si vienen, o los actuales del usuario).
  if (parsed.data.rol_id || parsed.data.nivel_clasificacion_id) {
    const actual = await prisma.usuario.findUnique({
      where: { id },
      select: { rol_id: true, nivel_clasificacion_id: true },
    })
    if (!actual) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })

    const [rol, nivel] = await Promise.all([
      prisma.rol.findUnique({ where: { id: parsed.data.rol_id ?? actual.rol_id }, select: { nivel_numerico: true } }),
      prisma.clasificacionSeguridad.findUnique({ where: { id: parsed.data.nivel_clasificacion_id ?? actual.nivel_clasificacion_id }, select: { nivel_numerico: true } }),
    ])
    if (!rol || !nivel) return NextResponse.json({ ok: false, error: 'Rol o nivel inexistente' }, { status: 400 })
    const topeRol = TOPE_CLASIFICACION_ROL[rol.nivel_numerico]
    if (topeRol !== undefined && nivel.nivel_numerico > topeRol) {
      return NextResponse.json(
        { ok: false, error: `Ese rol sólo puede tener acreditación ${NOMBRE_NIVEL_CLASIFICACION[topeRol]} o inferior` },
        { status: 400 },
      )
    }
  }

  const { password, ...rest } = parsed.data
  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.activo === true && { intentos_fallidos: 0 }),
      ...(password && { password_hash: await hashPassword(password) }),
    },
    select: {
      id: true, nombre_usuario: true, activo: true, fecha_creacion: true,
      rol:                 { select: { id: true, nombre_rol: true, nivel_numerico: true } },
      nivel_clasificacion: { select: { id: true, nombre: true, nivel_numerico: true } },
    },
  })

  await registrarEvento({
    usuarioId: session.sub,
    evento: 'EDIT_USER',
    detalle: `Editó al usuario "${usuario.nombre_usuario}"`,
    ...extraerOrigen(req),
  })

  return NextResponse.json({ ok: true, data: { ...usuario, fecha_creacion: usuario.fecha_creacion.toISOString() } })
  } catch (err) {
    return errorResponse('USUARIO_EDIT', err, requestId)
  }
}

// ─── DELETE: eliminar usuario (sólo Admin) ────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.ADMIN) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = await params
  if (id === session.sub) {
    return NextResponse.json({ ok: false, error: 'No puede eliminarse a sí mismo' }, { status: 400 })
  }
  if (id === await getAdminPrincipalId()) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar al administrador principal del sistema' }, { status: 400 })
  }

  try {
  // Buscar primero para dar un mensaje claro si no existe
  const target = await prisma.usuario.findUnique({
    where: { id },
    select: { nombre_usuario: true, password_hash: true, rol: { select: { nivel_numerico: true } } },
  })
  if (!target) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })

  // Eliminar una cuenta Administrador exige confirmar la contraseña de quien
  // elimina Y la del administrador objetivo (doble verificación por el alto
  // privilegio de la cuenta).
  if (target.rol.nivel_numerico >= NIVEL_ROL.ADMIN) {
    const parsed = deleteAdminSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Debe confirmar ambas contraseñas para eliminar a un administrador' }, { status: 400 })
    }
    const { password_actual, password_objetivo } = parsed.data

    const sesionActual = await prisma.usuario.findUnique({ where: { id: session.sub }, select: { password_hash: true } })
    if (!sesionActual || !(await verifyPassword(password_actual, sesionActual.password_hash))) {
      return NextResponse.json({ ok: false, error: 'Su contraseña es incorrecta' }, { status: 401 })
    }
    if (!(await verifyPassword(password_objetivo, target.password_hash))) {
      return NextResponse.json({ ok: false, error: 'La contraseña del administrador a eliminar es incorrecta' }, { status: 401 })
    }
  }

  try {
    await prisma.usuario.delete({ where: { id } })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2003' || code === 'P2014') {
      return NextResponse.json(
        { ok: false, error: 'No se puede eliminar: el usuario tiene archivos u otras referencias activas. Elimine primero sus recursos.' },
        { status: 409 },
      )
    }
    throw e
  }

  await registrarEvento({
    usuarioId: session.sub,
    evento: 'DELETE_USER',
    detalle: `Eliminó al usuario "${target.nombre_usuario}"`,
    ...extraerOrigen(req),
  })

  return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse('USUARIO_DELETE', err, requestId)
  }
}
