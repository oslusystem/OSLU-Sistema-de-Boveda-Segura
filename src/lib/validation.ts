// Reglas de validación compartidas entre formularios cliente y rutas API.
// Sin dependencias de Node.js: usable en ambos runtimes.
import { z } from 'zod'

/** Mínimo 8 caracteres, una mayúscula, un número y un carácter especial. */
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial')

export const PASSWORD_HINT = 'Mínimo 8 caracteres, con mayúscula, número y carácter especial'
