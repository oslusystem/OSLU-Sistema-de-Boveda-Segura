import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, NIVEL_ROL, TOPE_CLASIFICACION_ROL, NOMBRE_NIVEL_CLASIFICACION } from '@/lib/auth'
import { registrarEvento, extraerOrigen } from '@/lib/audit'
import { deleteEncrypted } from '@/lib/storage'
import { getRequestId, errorResponse } from '@/lib/logger'

const patchSchema = z.object({
  nombre_proyecto:               z.string().min(2).max(150).optional(),
  descripcion:                   z.string().optional(),
  nivel_clasificacion_minimo_id: z.string().optional(),
})

// ─── PATCH: editar proyecto (mínimo Oficial Subalterno, sujeto a tope de rol) ──
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.OFICIAL_SUBALTERNO) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }
  const topeRol = TOPE_CLASIFICACION_ROL[session.rol_nivel]

  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })

  try {
  if (topeRol !== undefined) {
    const actual = await prisma.proyecto.findUnique({
      where: { id },
      select: { nivel_clasificacion_minimo: { select: { nivel_numerico: true } } },
    })
    if (!actual || actual.nivel_clasificacion_minimo.nivel_numerico > topeRol) {
      return NextResponse.json(
        { ok: false, error: `Su rol está limitado a clasificación ${NOMBRE_NIVEL_CLASIFICACION[topeRol]}` },
        { status: 403 },
      )
    }
  }

  // Si se sube el mínimo del proyecto, los archivos ya existentes no pueden
  // quedar por debajo del nuevo piso (mismo Bell-LaPadula que rige al subir/editar archivos).
  if (parsed.data.nivel_clasificacion_minimo_id) {
    const nuevoNivel = await prisma.clasificacionSeguridad.findUnique({
      where: { id: parsed.data.nivel_clasificacion_minimo_id },
      select: { nombre: true, nivel_numerico: true },
    })
    if (!nuevoNivel) return NextResponse.json({ ok: false, error: 'Nivel inexistente' }, { status: 400 })

    if (topeRol !== undefined && nuevoNivel.nivel_numerico > topeRol) {
      return NextResponse.json(
        { ok: false, error: `Su rol está limitado a clasificación ${NOMBRE_NIVEL_CLASIFICACION[topeRol]}` },
        { status: 403 },
      )
    }

    const archivosPorDebajo = await prisma.archivo.count({
      where: {
        proyecto_id: id,
        estado: 'ACTIVO',
        nivel_clasificacion: { nivel_numerico: { lt: nuevoNivel.nivel_numerico } },
      },
    })
    if (archivosPorDebajo > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se puede subir el mínimo a ${nuevoNivel.nombre}: ${archivosPorDebajo} archivo(s) del proyecto tienen una clasificación inferior. Reclasifíquelos o muévalos primero.`,
        },
        { status: 422 },
      )
    }
  }

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: parsed.data,
    include: {
      nivel_clasificacion_minimo: { select: { id: true, nombre: true, nivel_numerico: true } },
      _count: { select: { archivos: { where: { estado: 'ACTIVO' } } } },
    },
  })

  await registrarEvento({
    usuarioId: session.sub,
    evento: 'EDIT_PROJECT',
    detalle: `Editó el proyecto "${proyecto.nombre_proyecto}"`,
    ...extraerOrigen(req),
  })

  return NextResponse.json({ ok: true, data: { ...proyecto, fecha_creacion: proyecto.fecha_creacion.toISOString() } })
  } catch (err) {
    return errorResponse('PROYECTO_EDIT', err, requestId)
  }
}

// ─── DELETE: eliminar proyecto (sólo Administrador) ────────────────────────────
// Purga todos sus archivos (blobs), los borra de BD y luego elimina el proyecto.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  if (session.rol_nivel < NIVEL_ROL.ADMIN) {
    return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
  const { id } = await params
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { archivos: { select: { id: true, nombre_archivo: true, ruta_cifrada: true } } },
  })
  if (!proyecto) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

  // Purgar blobs cifrados (best-effort; pueden no existir ya).
  await Promise.all(
    proyecto.archivos.map((a) => deleteEncrypted(a.ruta_cifrada).catch(() => {})),
  )

  // Borrar archivos y proyecto en una transacción. GestionClave cascada desde Archivo.
  // NecesidadSaber cascada desde Proyecto.
  try {
    await prisma.$transaction([
      prisma.archivo.deleteMany({ where: { proyecto_id: id } }),
      prisma.proyecto.delete({ where: { id } }),
    ])
  } catch (err) {
    return errorResponse('PROYECTO_DELETE', err, requestId)
  }

  await registrarEvento({
    usuarioId: session.sub,
    evento: 'DELETE_PROJECT',
    detalle: `Eliminó el proyecto "${proyecto.nombre_proyecto}" junto con ${proyecto.archivos.length} archivo(s)`,
    ...extraerOrigen(req),
  })

  return NextResponse.json({ ok: true, data: { archivosEliminados: proyecto.archivos.length } })
  } catch (err) {
    return errorResponse('PROYECTO_DELETE', err, requestId)
  }
}
