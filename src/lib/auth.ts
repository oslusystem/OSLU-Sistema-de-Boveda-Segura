/**
 * auth.ts — Autenticación y sesión (Node.js runtime únicamente).
 *
 * NO importar desde middleware (Edge Runtime es incompatible con
 * jsonwebtoken / bcryptjs / next/headers). El middleware verifica el JWT por
 * su cuenta con la Web Crypto API.
 */
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import {
  TOKEN_COOKIE, PREAUTH_COOKIE, NIVEL_ROL,
  NIVEL_CLASIFICACION_RESERVADO, NIVEL_CLASIFICACION_CONFIDENCIAL, NIVEL_CLASIFICACION_SECRETO,
  TOPE_CLASIFICACION_ROL, NOMBRE_NIVEL_CLASIFICACION,
} from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import type { JWTPayload } from '@/types'

export {
  TOKEN_COOKIE, PREAUTH_COOKIE, NIVEL_ROL,
  NIVEL_CLASIFICACION_RESERVADO, NIVEL_CLASIFICACION_CONFIDENCIAL, NIVEL_CLASIFICACION_SECRETO,
  TOPE_CLASIFICACION_ROL, NOMBRE_NIVEL_CLASIFICACION,
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? '8h'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function getSessionFromCookies(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// ─── Token pre-auth (MFA facial) ──────────────────────────────────────────────
// Identifica al usuario ENTRE el paso de contraseña y el facial. Vida corta y
// scope 'mfa': no sirve como sesión. La sesión real sólo se emite tras el rostro.
interface PreAuthPayload { sub: string; scope: 'mfa'; iat?: number; exp?: number }

export function signPreAuthToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId, scope: 'mfa' }, JWT_SECRET, { expiresIn: '5m' })
}

export function verifyPreAuthToken(token: string): PreAuthPayload | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as PreAuthPayload
    return p.scope === 'mfa' ? p : null
  } catch {
    return null
  }
}

// ─── Token de verificación facial puntual (re-auth antes de ver/descargar) ────
// Emitido tras una sesión ya iniciada, sólo confirma que el usuario volvió a
// mostrar su rostro justo antes de esta operación. Vida muy corta y atado al
// archivo concreto: no sirve para acceder a otro archivo ni pasado su minuto.
interface FileAccessPayload { sub: string; scope: 'file-access'; archivoId: string; iat?: number; exp?: number }

export function signFileAccessToken(usuarioId: string, archivoId: string): string {
  return jwt.sign({ sub: usuarioId, scope: 'file-access', archivoId }, JWT_SECRET, { expiresIn: '60s' })
}

export function verifyFileAccessToken(token: string): FileAccessPayload | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as FileAccessPayload
    return p.scope === 'file-access' ? p : null
  } catch {
    return null
  }
}

/**
 * Comprueba la jerarquía de roles por nivel numérico.
 * Convención: Administrador=4, Oficial Superior=3, Oficial General=2, Oficial Subalterno=1.
 */
export function tieneNivelRol(nivelActual: number, nivelRequerido: number): boolean {
  return nivelActual >= nivelRequerido
}

/**
 * Id del administrador principal del sistema: la cuenta de rol Administrador
 * más antigua. No se lista en la gestión de usuarios ni puede editarse o
 * eliminarse, para garantizar que siempre exista un admin con acceso.
 */
export async function getAdminPrincipalId(): Promise<string | null> {
  const principal = await prisma.usuario.findFirst({
    where:   { rol: { nivel_numerico: { gte: NIVEL_ROL.ADMIN } } },
    orderBy: { fecha_creacion: 'asc' },
    select:  { id: true },
  })
  return principal?.id ?? null
}
