/**
 * health/route.ts — endpoint de verificación de salud para el orquestador
 * (Railway healthcheck, restart policy, y diagnóstico manual en incidentes).
 * Ruta pública (ver PUBLIC_ROUTES en middleware.ts): no exige sesión.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
      uptime_s: Math.floor(process.uptime()),
    })
  } catch (err) {
    console.error(`[ERROR] [${new Date().toISOString()}] [HEALTH]`, err)
    return NextResponse.json(
      { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
