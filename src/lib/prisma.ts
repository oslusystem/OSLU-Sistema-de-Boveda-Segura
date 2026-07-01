/**
 * prisma.ts — cliente Prisma singleton.
 *
 * En desarrollo, Next.js recarga módulos en caliente (HMA) en cada guardado,
 * lo que crearía una nueva `PrismaClient` (y una nueva conexión) por recarga.
 * Guardar la instancia en `globalThis` evita agotar el pool de conexiones.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
