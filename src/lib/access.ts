/**
 * access.ts — Control de acceso a archivos (Node.js runtime únicamente).
 *
 * El acceso a un archivo exige superar DOS barreras (modelo "no read up" de
 * Bell-LaPadula):
 *
 *   1. Usuario activo.
 *   2. Acreditación suficiente:  nivel(usuario) >= nivel(archivo).
 *
 * Los tres niveles existentes (RESERVADO, CONFIDENCIAL, SECRETO) son "base":
 * cualquier usuario activo con acreditación suficiente ve ese contenido sin
 * necesidad de saber explícita. La tabla `necesidad_saber` se sigue poblando
 * (auditoría de quién creó/autorizó cada proyecto) pero ya no se consulta
 * para decidir acceso — queda lista si en el futuro se agrega una
 * clasificación por encima de `NIVEL_CLASIFICACION_SECRETO` que sí deba
 * exigirla.
 */
import { prisma } from '@/lib/prisma'

export interface ResultadoAcceso {
  permitido: boolean
  motivo?: 'USUARIO_INACTIVO' | 'CLASIFICACION_INSUFICIENTE' | 'NO_ENCONTRADO'
}

/**
 * Determina si un usuario puede acceder (ver/descargar) a un archivo concreto.
 * No lanza: devuelve un resultado describible para auditar el motivo del rechazo.
 */
export async function puedeAccederArchivo(
  usuarioId: string,
  archivoId: string,
): Promise<ResultadoAcceso> {
  const [usuario, archivo] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { activo: true, nivel_clasificacion: { select: { nivel_numerico: true } } },
    }),
    prisma.archivo.findUnique({
      where: { id: archivoId },
      select: { nivel_clasificacion: { select: { nivel_numerico: true } } },
    }),
  ])

  if (!usuario || !archivo) return { permitido: false, motivo: 'NO_ENCONTRADO' }
  if (!usuario.activo) return { permitido: false, motivo: 'USUARIO_INACTIVO' }

  if (usuario.nivel_clasificacion.nivel_numerico < archivo.nivel_clasificacion.nivel_numerico) {
    return { permitido: false, motivo: 'CLASIFICACION_INSUFICIENTE' }
  }
  return { permitido: true }
}

/**
 * Devuelve los IDs de proyecto a los que el usuario tiene acceso efectivo
 * (clearance únicamente), para filtrar listados de archivos sin traer todo
 * y descartar después.
 */
export async function proyectosVisibles(usuarioId: string): Promise<string[]> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { activo: true, nivel_clasificacion: { select: { nivel_numerico: true } } },
  })
  if (!usuario || !usuario.activo) return []

  const proyectos = await prisma.proyecto.findMany({
    where: { nivel_clasificacion_minimo: { nivel_numerico: { lte: usuario.nivel_clasificacion.nivel_numerico } } },
    select: { id: true },
  })
  return proyectos.map((p) => p.id)
}
