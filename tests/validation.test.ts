import { describe, it, expect } from 'vitest'
import { cuidSchema, paginationSchema, nombreArchivoSchema, faceDescriptorSchema } from '@/lib/validation'

describe('validation — esquemas BlueTeam reutilizables', () => {
  it('cuidSchema acepta un cuid válido y rechaza formatos arbitrarios', () => {
    expect(cuidSchema.safeParse('cljk3x9z00000qzrmn831p7b').success).toBe(true)
    expect(cuidSchema.safeParse('../../etc/passwd').success).toBe(false)
    expect(cuidSchema.safeParse('').success).toBe(false)
    expect(cuidSchema.safeParse(null).success).toBe(false)
  })

  it('paginationSchema acota page/limit y cae a valores seguros con entradas inválidas', () => {
    expect(paginationSchema.parse({ page: '2', limit: '10' })).toEqual({ page: 2, limit: 10 })
    expect(paginationSchema.parse({ page: '-5', limit: '9999' })).toEqual({ page: 1, limit: 50 })
    expect(paginationSchema.parse({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 50 })
  })

  it('nombreArchivoSchema rechaza vacío y nombres desproporcionadamente largos', () => {
    expect(nombreArchivoSchema.safeParse('informe.pdf').success).toBe(true)
    expect(nombreArchivoSchema.safeParse('').success).toBe(false)
    expect(nombreArchivoSchema.safeParse('a'.repeat(256)).success).toBe(false)
  })

  it('faceDescriptorSchema exige exactamente 128 números finitos', () => {
    expect(faceDescriptorSchema.safeParse(Array(128).fill(0.1)).success).toBe(true)
    expect(faceDescriptorSchema.safeParse(Array(127).fill(0.1)).success).toBe(false)
    expect(faceDescriptorSchema.safeParse(Array(128).fill(Infinity)).success).toBe(false)
    expect(faceDescriptorSchema.safeParse('no-es-un-arreglo').success).toBe(false)
  })
})
