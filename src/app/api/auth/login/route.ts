import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signPreAuthToken, PREAUTH_COOKIE } from '@/lib/auth'
import { registrarEvento, extraerOrigen } from '@/lib/audit'
import { getRequestId, errorResponse } from '@/lib/logger'

const bodySchema = z.object({
  nombre_usuario: z.string().min(3, 'Usuario demasiado corto').max(120),
  password:       z.string().min(1, 'Contraseña requerida'),
})

const MAX_INTENTOS_FALLIDOS = 3

/**
 * Paso 1 del login: valida usuario + contraseña.
 * Si es correcto, NO emite la sesión: emite un token pre-auth de vida corta y
 * exige completar el paso facial (MFA). La sesión real se crea en
 * /api/auth/mfa/verify. Devuelve `enrolled` para que el cliente sepa si debe
 * registrar el rostro (primer ingreso) o verificarlo.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const origen = extraerOrigen(req)

  try {
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const { nombre_usuario, password } = parsed.data

    const usuario = await prisma.usuario.findUnique({
      where: { nombre_usuario },
      include: { biometrias: { where: { tipo_biometria: 'FACIAL' }, select: { id: true } } },
    })

    if (!usuario) {
      await registrarEvento({
        usuarioId: null,
        evento: 'LOGIN_FAILED',
        detalle: `Intento con usuario "${nombre_usuario}" (inexistente)`,
        ...origen,
      })
      return NextResponse.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401 })
    }

    if (!usuario.activo) {
      await registrarEvento({
        usuarioId: usuario.id,
        evento: 'LOGIN_FAILED',
        detalle: 'Intento sobre cuenta bloqueada/inactiva',
        ...origen,
      })
      return NextResponse.json({ ok: false, error: 'Cuenta bloqueada. Contacte a un administrador.' }, { status: 401 })
    }

    const valido = await verifyPassword(password, usuario.password_hash)
    if (!valido) {
      const intentos = usuario.intentos_fallidos + 1
      const seBloquea = intentos >= MAX_INTENTOS_FALLIDOS

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: seBloquea
          ? { intentos_fallidos: 0, activo: false }
          : { intentos_fallidos: intentos },
      })

      await registrarEvento({
        usuarioId: usuario.id,
        evento: seBloquea ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        detalle: seBloquea
          ? `Cuenta bloqueada tras ${MAX_INTENTOS_FALLIDOS} intentos fallidos`
          : `Contraseña incorrecta (intento ${intentos}/${MAX_INTENTOS_FALLIDOS})`,
        ...origen,
      })

      return NextResponse.json({
        ok: false,
        error: seBloquea
          ? 'Cuenta bloqueada por múltiples intentos fallidos. Contacte a un administrador.'
          : 'Credenciales incorrectas',
      }, { status: 401 })
    }

    if (usuario.intentos_fallidos > 0) {
      await prisma.usuario.update({ where: { id: usuario.id }, data: { intentos_fallidos: 0 } })
    }

    // Contraseña correcta → emitir pre-auth y exigir rostro.
    const preauth = signPreAuthToken(usuario.id)
    const enrolled = usuario.biometrias.length > 0

    await registrarEvento({
      usuarioId: usuario.id,
      evento: 'LOGIN',
      detalle: `Contraseña verificada; pendiente MFA facial (${enrolled ? 'verificación' : 'registro'})`,
      ...origen,
    })

    const res = NextResponse.json({ ok: true, data: { step: 'mfa', enrolled } })
    res.cookies.set(PREAUTH_COOKIE, preauth, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 5, // 5 minutos
      path:     '/',
    })
    return res
  } catch (err) {
    return errorResponse('LOGIN', err, requestId)
  }
}
