import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, tieneNivelRol, NIVEL_ROL } from '@/lib/auth'

describe('auth — contraseñas y jerarquía de roles', () => {
  it('hashea y verifica una contraseña correcta (bcrypt)', async () => {
    const hash = await hashPassword('Secreta1234!')
    expect(hash).not.toBe('Secreta1234!') // nunca en claro
    expect(await verifyPassword('Secreta1234!', hash)).toBe(true)
  })

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('Correcta123')
    expect(await verifyPassword('Incorrecta123', hash)).toBe(false)
  })

  it('respeta la jerarquía de roles por nivel numérico', () => {
    // Admin(4) cubre a Oficial General(2) y Oficial Subalterno(1).
    expect(tieneNivelRol(NIVEL_ROL.ADMIN, NIVEL_ROL.OFICIAL_GENERAL)).toBe(true)
    expect(tieneNivelRol(NIVEL_ROL.ADMIN, NIVEL_ROL.ADMIN)).toBe(true)
    // Oficial Subalterno(1) no alcanza a Oficial General(2).
    expect(tieneNivelRol(NIVEL_ROL.OFICIAL_SUBALTERNO, NIVEL_ROL.OFICIAL_GENERAL)).toBe(false)
    // Oficial General(2) cubre a Oficial Subalterno(1) pero no a Admin(4).
    expect(tieneNivelRol(NIVEL_ROL.OFICIAL_GENERAL, NIVEL_ROL.OFICIAL_SUBALTERNO)).toBe(true)
    expect(tieneNivelRol(NIVEL_ROL.OFICIAL_GENERAL, NIVEL_ROL.ADMIN)).toBe(false)
  })
})
