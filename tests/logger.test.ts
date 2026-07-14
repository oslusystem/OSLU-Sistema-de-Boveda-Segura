import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { logEvent, errorResponse, getRequestId } from '@/lib/logger'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logger — trazabilidad avanzada (logs JSON + Correlation ID)', () => {
  it('logEvent emite una línea JSON parseable con los campos esperados', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logEvent('error', 'TEST_CTX', 'algo falló', { requestId: 'abc-123' })

    expect(spy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed).toMatchObject({
      level: 'error',
      context: 'TEST_CTX',
      message: 'algo falló',
      requestId: 'abc-123',
    })
    expect(typeof parsed.timestamp).toBe('string')
  })

  it('logEvent de nivel info/warn no usa console.error', () => {
    const errSpy  = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy  = vi.spyOn(console, 'log').mockImplementation(() => {})
    logEvent('info', 'TEST_CTX', 'todo bien')
    expect(errSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledOnce()
  })

  it('errorResponse nunca expone err.message al cliente, sólo el código de correlación', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('DATABASE_URL inválida en el host interno 10.0.0.5')
    const res = await errorResponse('TEST_CTX', err, 'req-999')
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Ocurrió un error. Reporte el código: req-999')
    expect(body.error).not.toContain('DATABASE_URL')
    expect(body.error).not.toContain('10.0.0.5')
  })

  it('errorResponse respeta un status distinto cuando se especifica', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await errorResponse('TEST_CTX', new Error('x'), 'req-1', 400)
    expect(res.status).toBe(400)
  })

  it('getRequestId reutiliza el header x-request-id si existe', () => {
    const req = new NextRequest('http://localhost/api/health', {
      headers: { 'x-request-id': 'incoming-id' },
    })
    expect(getRequestId(req)).toBe('incoming-id')
  })

  it('getRequestId genera un UUID si no hay header', () => {
    const req = new NextRequest('http://localhost/api/health')
    const id = getRequestId(req)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
