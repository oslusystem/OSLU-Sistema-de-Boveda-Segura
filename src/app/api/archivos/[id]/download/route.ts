import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, verifyFileAccessToken } from '@/lib/auth'
import { decryptBuffer, unwrapKey, hashContent } from '@/lib/crypto'
import { readEncrypted } from '@/lib/storage'
import { puedeAccederArchivo } from '@/lib/access'
import { registrarEvento, extraerOrigen } from '@/lib/audit'
import { getRequestId, errorResponse, logEvent } from '@/lib/logger'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req)
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const origen = extraerOrigen(req)
  const isView = req.nextUrl.searchParams.get('view') === '1'

  // ── Re-verificación facial puntual: token corto emitido por /api/auth/verify-face,
  // atado a este archivo y a este usuario, válido 60s ───────────────────────────
  const faceToken = req.nextUrl.searchParams.get('faceToken')
  const face = faceToken ? verifyFileAccessToken(faceToken) : null
  if (!face || face.sub !== session.sub || face.archivoId !== id) {
    return NextResponse.json(
      { ok: false, error: 'Verificación facial requerida', code: 'FACE_VERIFICATION_REQUIRED' },
      { status: 428 },
    )
  }

  try {
    // ── Control de acceso: clasificación + need-to-know ──────────────────────────
    const acceso = await puedeAccederArchivo(session.sub, id)
    if (!acceso.permitido) {
      await registrarEvento({
        usuarioId: session.sub,
        evento: 'ACCESS_DENIED',
        detalle: `Acceso denegado a archivo ${id} (motivo: ${acceso.motivo})`,
        ...origen,
      })
      const status = acceso.motivo === 'NO_ENCONTRADO' ? 404 : 403
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status })
    }

    const archivo = await prisma.archivo.findUnique({
      where: { id },
      include: { clave: true },
    })
    if (!archivo || !archivo.clave) {
      return NextResponse.json({ ok: false, error: 'Archivo no disponible' }, { status: 404 })
    }

    // ── Descifrar: leer .enc → desenvolver clave → AES-GCM → verificar hash ────
    const blob    = await readEncrypted(archivo.ruta_cifrada)
    const fileKey = unwrapKey(archivo.clave.clave_cifrada)
    const plain   = decryptBuffer(blob, fileKey) // lanza si el authTag no valida

    // Defensa en profundidad: comparar SHA-256 con el registrado al subir.
    if (hashContent(plain) !== archivo.hash_original) {
      await registrarEvento({
        usuarioId: session.sub,
        evento: 'ACCESS_DENIED',
        detalle: `Integridad comprometida en archivo ${id}: hash no coincide`,
        ...origen,
      })
      logEvent('error', 'DOWNLOAD_INTEGRITY', `Integridad fallida en archivo ${id}`, { requestId })
      return NextResponse.json({ ok: false, error: 'Integridad del archivo comprometida' }, { status: 409 })
    }

    await registrarEvento({
      usuarioId: session.sub,
      evento: isView ? 'VIEW' : 'DOWNLOAD',
      detalle: `${isView ? 'Visualizó' : 'Descargó'} "${archivo.nombre_archivo}"`,
      ...origen,
    })

    return new NextResponse(plain as unknown as BodyInit, {
      headers: {
        'Content-Type': archivo.mime_type ?? 'application/octet-stream',
        'Content-Disposition': `${isView ? 'inline' : 'attachment'}; filename="${encodeURIComponent(archivo.nombre_archivo)}"`,
        'Content-Length': String(plain.length),
      },
    })
  } catch (err) {
    return errorResponse('DOWNLOAD', err, requestId)
  }
}
