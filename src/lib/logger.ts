/**
 * logger.ts — trazabilidad avanzada: logs estructurados en JSON y el
 * mensaje seguro que se le muestra al usuario cuando el sistema falla de
 * verdad (nunca el error técnico ni trazas de código).
 *
 * `middleware.ts` asigna un Correlation ID (`x-request-id`) a cada petición;
 * los route handlers lo leen y lo pasan aquí para poder correlacionar "el
 * usuario reportó el código X" con la línea de log correspondiente.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Level = 'info' | 'warn' | 'error'

/** Lee el Correlation ID inyectado por el middleware (o genera uno de respaldo). */
export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID()
}

/** Emite una línea de log estructurada en JSON (legible por máquinas). */
export function logEvent(level: Level, context: string, message: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...meta,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

/**
 * Registra el error real (sólo del lado servidor, con mensaje y stack) y
 * responde al cliente con el mensaje seguro exigido por el Avance #6:
 * "Ocurrió un error. Reporte el código: [UUID]" — nunca `err.message` ni
 * detalles internos.
 */
export function errorResponse(context: string, err: unknown, requestId: string, status = 500) {
  logEvent('error', context, err instanceof Error ? err.message : 'Error desconocido', {
    requestId,
    stack: err instanceof Error ? err.stack : undefined,
  })
  return NextResponse.json(
    { ok: false, error: `Ocurrió un error. Reporte el código: ${requestId}` },
    { status },
  )
}
