/**
 * health/route.ts — endpoint de verificación de salud para el orquestador
 * (Railway healthcheck, restart policy, y diagnóstico manual en incidentes).
 * Ruta pública (ver PUBLIC_ROUTES en middleware.ts): no exige sesión.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestId, logEvent } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
      uptime_s: Math.floor(process.uptime()),
    })
  } catch (err) {
    logEvent('error', 'HEALTH', err instanceof Error ? err.message : 'Error desconocido', { requestId })
    return NextResponse.json(
      { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
