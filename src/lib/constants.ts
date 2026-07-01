// Constantes compartidas entre Edge Runtime (middleware) y Node.js runtime.
// Este archivo NO debe importar nada con dependencias de Node.js.

export const TOKEN_COOKIE = 'boveda_token'

// Cookie temporal entre el paso de contraseña y el paso facial (MFA).
// Vive pocos minutos y NO concede acceso al sistema por sí sola.
export const PREAUTH_COOKIE = 'boveda_preauth'

/** Niveles de rol de referencia. Sin dependencias de Node.js: usable también
 *  desde componentes cliente (ej. para distinguir cuentas Administrador en la UI). */
export const NIVEL_ROL = {
  ADMIN: 4,
  OFICIAL_SUPERIOR: 3,
  OFICIAL_GENERAL: 2,
  OFICIAL_SUBALTERNO: 1,
} as const

/** nivel_numerico de la clasificación RESERVADO (la más baja). Un Oficial
 *  Subalterno está limitado a este nivel: tanto su propia acreditación como
 *  cualquier archivo/proyecto que cree o edite. */
export const NIVEL_CLASIFICACION_RESERVADO = 1

/** nivel_numerico de la clasificación CONFIDENCIAL. Un Oficial General está
 *  limitado a este nivel (o inferior): tanto su propia acreditación como
 *  cualquier archivo/proyecto que cree o edite. */
export const NIVEL_CLASIFICACION_CONFIDENCIAL = 2

/** nivel_numerico de la clasificación SECRETO (la más alta hoy). Un Oficial
 *  Superior está limitado a este nivel: en la práctica no restringe nada
 *  porque ya es el tope del sistema, pero completa el modelo "nivel de rol =
 *  nivel de clasificación" y queda listo si se agrega un nivel superior. */
export const NIVEL_CLASIFICACION_SECRETO = 3

/** Tope de clasificación por rol: ciertos roles no pueden clasificar contenido
 *  ni acreditarse por encima de este nivel, sin importar otros factores. El
 *  único rol ausente de este mapa (Administrador) no tiene tope de rol — sólo
 *  lo limita su propia acreditación individual. */
export const TOPE_CLASIFICACION_ROL: Partial<Record<number, number>> = {
  [NIVEL_ROL.OFICIAL_SUBALTERNO]: NIVEL_CLASIFICACION_RESERVADO,
  [NIVEL_ROL.OFICIAL_GENERAL]: NIVEL_CLASIFICACION_CONFIDENCIAL,
  [NIVEL_ROL.OFICIAL_SUPERIOR]: NIVEL_CLASIFICACION_SECRETO,
}

/** Nombre legible de cada nivel de clasificación, para mensajes de error sin
 *  tener que consultar la base de datos. */
export const NOMBRE_NIVEL_CLASIFICACION: Record<number, string> = {
  [NIVEL_CLASIFICACION_RESERVADO]: 'RESERVADO',
  [NIVEL_CLASIFICACION_CONFIDENCIAL]: 'CONFIDENCIAL',
  [NIVEL_CLASIFICACION_SECRETO]: 'SECRETO',
}
