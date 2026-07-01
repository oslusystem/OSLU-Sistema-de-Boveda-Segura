import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, signFileAccessToken } from '@/lib/auth'
import { decryptString } from '@/lib/crypto'
import { parseDescriptor, matchFace } from '@/lib/face'
import { registrarEvento, extraerOrigen } from '@/lib/audit'

/**
 * Re-verificación facial puntual: requerida justo antes de ver/descargar un
 * archivo, con sesión ya iniciada. A diferencia del MFA del login, no emite
 * cookie de sesión — sólo un token corto (`signFileAccessToken`) atado al
 * archivo, que el cliente debe adjuntar a la siguiente llamada de descarga.
 */
export async function POST(req: NextRequest) {
  const origen = extraerOrigen(req)

  const session = await getSessionFromCookies()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { descriptor, archivoId } = await req.json()
    if (typeof archivoId !== 'string' || !archivoId) {
      return NextResponse.json({ ok: false, error: 'Archivo no especificado' }, { status: 400 })
    }
    const candidato = parseDescriptor(descriptor)

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.sub },
      include: {
        biometrias: { where: { tipo_biometria: 'FACIAL' }, orderBy: { fecha_registro: 'desc' }, take: 1 },
      },
    })
    if (!usuario || !usuario.activo) {
      return NextResponse.json({ ok: false, error: 'Usuario no válido' }, { status: 401 })
    }

    const bio = usuario.biometrias[0]
    if (!bio?.descriptor_cifrado) {
      return NextResponse.json({ ok: false, error: 'No hay rostro registrado' }, { status: 409 })
    }

    const almacenado = parseDescriptor(JSON.parse(decryptString(bio.descriptor_cifrado)))
    const { match, distance } = matchFace(candidato, almacenado)

    await prisma.eventoMFA.create({
      data: {
        usuario_id: usuario.id,
        tipo_factor: 'FACIAL',
        resultado: match ? 'EXITO' : 'FALLO',
        detalles: `Reverificación previa a archivo ${archivoId} (distancia ${distance.toFixed(4)})`,
      },
    })

    if (!match) {
      await registrarEvento({
        usuarioId: usuario.id,
        evento: 'ACCESS_DENIED',
        detalle: `Verificación facial fallida previa a archivo ${archivoId} (distancia ${distance.toFixed(4)})`,
        ...origen,
      })
      return NextResponse.json({ ok: false, error: 'El rostro no coincide. Intente de nuevo.' }, { status: 401 })
    }

    const token = signFileAccessToken(usuario.id, archivoId)
    return NextResponse.json({ ok: true, data: { token } })
  } catch (err) {
    console.error(`[ERROR] [${new Date().toISOString()}] [VERIFY_FACE]`, err)
    return NextResponse.json({ ok: false, error: 'No se pudo verificar el rostro' }, { status: 400 })
  }
}
