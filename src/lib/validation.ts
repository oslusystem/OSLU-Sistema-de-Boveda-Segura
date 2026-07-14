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

/** IDs generados por Prisma (`@default(cuid())`) — formato esperado en todo `[id]` de ruta. */
export const cuidSchema = z.string().cuid('Identificador inválido')

/** Paginación acotada: evita page/limit negativos, no-numéricos o desproporcionados. */
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
})

/** Nombre de archivo visible (el original que sube el usuario, no la ruta cifrada). */
export const nombreArchivoSchema = z.string().min(1).max(255)

/** Descripción libre, con un tope razonable para no aceptar payloads arbitrariamente grandes. */
export const descripcionSchema = z.string().max(2000).optional()

/** Descriptor facial de face-api.js: 128 números de coma flotante (float32). */
export const faceDescriptorSchema = z
  .array(z.number().finite())
  .length(128, 'El descriptor facial debe tener 128 valores')
