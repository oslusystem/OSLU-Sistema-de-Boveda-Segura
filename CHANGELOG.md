# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Todos los commits del proyecto siguen [Conventional Commits](https://www.conventionalcommits.org/)
e incluyen la referencia `(Tarea #NN)` a la tabla de abajo, tal como exige
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## [Avance #6] — Seguridad, observabilidad y soporte

### Added
- `src/lib/logger.ts`: `logEvent` (logs estructurados en JSON) y
  `errorResponse` (registra el error real del lado servidor y responde al
  cliente sólo `"Ocurrió un error. Reporte el código: [UUID]"`, nunca
  `err.message` ni trazas internas) (Tarea #27).
- `src/middleware.ts`: asigna un Correlation ID (`crypto.randomUUID()`) a
  cada petición vía header `x-request-id`, propagado a los route handlers y
  a la respuesta — permite rastrear un incidente reportado por un usuario
  hasta su línea de log exacta (Tarea #27).
- Los ~17 route handlers de `src/app/api/**` ahora usan `getRequestId` +
  `errorResponse` de forma consistente; se agregó `try/catch` a los 9
  handlers que no lo tenían (`archivos/[id]` GET/PATCH/DELETE, `auditoria`,
  `auditoria/verify`, `clasificaciones`, `proyectos` GET, `proyectos/[id]`
  PATCH, `roles`, `usuarios`, `usuarios/[id]`) (Tarea #27).
- `tests/logger.test.ts`: valida el formato JSON de los logs y que
  `errorResponse` nunca expone el mensaje real del error (Tarea #27).
- `src/lib/validation.ts`: nuevos esquemas reutilizables — `cuidSchema`,
  `paginationSchema`, `nombreArchivoSchema`, `descripcionSchema`,
  `faceDescriptorSchema` (Tarea #28).
- Validación explícita antes de tocar Prisma en `archivos` POST/PATCH
  (`proyecto_id`/`nivel_clasificacion_id` como cuid, límites de longitud en
  nombre/descripción) y en `auth/mfa/enroll`, `auth/mfa/verify`,
  `auth/verify-face` (descriptor facial validado con Zod antes del try/catch,
  para que un formato inválido devuelva 400 en vez de caer en el 500
  genérico) (Tarea #28).
- Todos los `[id]` de ruta (`archivos/[id]`, `archivos/[id]/download`,
  `proyectos/[id]`, `usuarios/[id]`) validan el formato cuid antes de
  golpear Prisma, devolviendo 400 ante un id malformado en vez de dejar que
  Prisma lo resuelva como "no encontrado" (Tarea #28).
- `auditoria` GET: `sortBy`/`sortDir` ahora usan un `z.enum` explícito
  (allow-list) en vez de fallbacks manuales (Tarea #28).
- `tests/validation.test.ts`: 4 pruebas nuevas para los esquemas agregados.
- `.github/workflows/backup.yml`: respaldo diario (+ disparo manual) de Neon
  vía `pg_dump`, subido como artefacto de GitHub Actions (copia offsite, en
  un medio distinto a Neon), con verificación real de restauración en el
  mismo job (regla 3-2-1) (Tarea #29).

### Fixed
- `backup.yml` usaba `postgres:17`; Neon corre PostgreSQL 18 y `pg_dump`
  aborta por desajuste de versión. Corregido a `postgres:18` en las tres
  imágenes del workflow (builder, restore-check y smoke test) y verificado
  con una corrida real: dump → artefacto → `pg_restore` → `SELECT count(*)
  FROM usuarios` devolvió 5, igual que producción (Tarea #30).

### Added (cont.)
- `RUNBOOK.md`: guía operativa con las 3 fases exigidas — Diagnóstico
  (healthcheck, búsqueda de incidentes por Correlation ID, estado del CD),
  Protocolo ante Caídas (niveles L1/L2/L3: triage, rollback vía Netlify o
  `git revert`, escalado a recuperación de datos), y Recuperación ante
  Desastres con los comandos exactos ya verificados en la Tarea #30 (Tarea #31).

## [Avance #5] — Despliegue y auto-recuperación

### Added
- Endpoint `GET /api/health` (`src/app/api/health/route.ts`): verifica
  conexión a la base de datos; ruta pública en `middleware.ts`, usada como
  healthcheck y como primer paso de diagnóstico ante incidentes (Tarea #22).
- Colaborador `osmaneduardo2232-prog` agregado a `CONTRIBUTORS.md` con su
  propio commit, y protección de `main` actualizada para exigir 1 aprobación
  real (peer review) además de CI en verde (Tarea #21).
- `src/lib/storage.ts`: capa de almacenamiento para los archivos cifrados
  (`storeEncrypted`/`readEncrypted`/`deleteEncrypted`), usada por las 4 rutas
  que antes leían/escribían `storage/vault/` en disco — implementada primero
  sobre Vercel Blob (Tarea #24), migrada luego a Netlify Blobs (Tarea #25)
  sin cambiar la interfaz pública ni las rutas que la consumen.
- `prisma/schema.prisma`: `directUrl` además de `url` en el datasource — Neon
  requiere una conexión directa (sin PgBouncer) para migrar (Tarea #24).
- Job `deploy` en `.github/workflows/ci.yml`: se dispara sólo al fusionar un
  Pull Request a `main` (CI en verde), aplica `prisma migrate deploy` contra
  Neon y publica el build — sin intervención manual, evolución del pipeline
  del Avance #3 (Tarea #24, actualizado a Netlify en la Tarea #25).

### Changed
- **Pivote de infraestructura #1: Railway (Docker) → Vercel + Neon + Vercel
  Blob.** Railway exige tarjeta/plan pago (Hobby, ~$5/mes) para tokens de
  proyecto, dominios y volúmenes persistentes más allá del trial; se optó por
  una combinación 100% gratuita y sin tarjeta. Esto retira el `Dockerfile`,
  `docker-entrypoint.sh`, `docker-compose.yml` y `railway.json` agregados
  originalmente en la Tarea #22 (superados), y `output: 'standalone'` de
  `next.config.ts` (innecesario/desaconsejado en Vercel) (Tarea #24).
- **Pivote de infraestructura #2: Vercel → Netlify.** La cuenta de Vercel
  pidió una verificación adicional que bloqueaba continuar en el plazo
  disponible; se migró a Netlify (mismo modelo serverless, mismo Neon para la
  BD). `src/lib/storage.ts` pasa de `@vercel/blob` a `@netlify/blobs`
  (interfaz idéntica), se agrega `netlify.toml`, y el job `deploy` usa
  Netlify CLI (`netlify deploy --prod`) en vez de Vercel CLI (Tarea #25).

### Fixed
- `next` actualizado de `15.1.0` a `15.5.20`: la versión anterior tenía un CVE
  crítico (`CVE-2025-66478`) y varios de severidad alta/media (Tarea #23).
- `prisma/schema.prisma`: `binaryTargets = ["native", "rhel-openssl-3.0.x"]`.
  El primer deploy en Netlify fallaba (`/api/health` y login devolvían error)
  porque el motor de Prisma se había generado sólo para Windows; sin el
  target del runtime de las funciones serverless de Netlify (Amazon Linux),
  el cliente no encuentra el Query Engine en producción (Tarea #26).

## [Avance #4] — Prototipo inicial viable

### Added
- Generación de documentación técnica estática con TypeDoc (`npm run docs`) a partir
  de los comentarios JSDoc de `src/lib` y `src/types` (Tarea #14).
- JSDoc completo en `src/lib/utils.ts` y `src/lib/prisma.ts` (Tarea #15).
- Este `CHANGELOG.md` con la tabla de referencia de tareas (Tarea #17).

### Removed
- Diagrama entidad-relación y diagrama de secuencia del login MFA en el README
  principal: se agregaron y luego se retiraron para dejar sólo el diagrama de
  arquitectura general (Tarea #16/#19).

### Verified
- 16 pruebas unitarias reales en `tests/` (crypto, auth, audit, face) — supera el
  mínimo de 5 exigido, integradas al pipeline de `.github/workflows/ci.yml`; una
  prueba en rojo bloquea el `merge` porque el check de CI es obligatorio en la
  protección de `main`.
- Manejo defensivo con `try/catch` y logs estructurados `[ERROR] [timestamp] [CONTEXTO]`
  en los 9 route handlers que mutan estado (subida/descarga de archivos, login,
  MFA, usuarios, proyectos).

## [Avance #3] — Inicialización y automatización

### Added
- `.gitignore` y `.env.example` para paridad de entornos (Tarea #02).
- Pipeline de CI en `.github/workflows/ci.yml`: checkout → `npm ci` → `prisma generate`
  → lint → test → build, disparado en cada PR y push a `main`/`develop` (Tarea #03).
- `CONTRIBUTING.md` con el modelo de ramas (GitFlow adaptado), convención de
  nombres de rama, estándar de Conventional Commits y Definition of Done (Tarea #04).
- Diagrama de arquitectura general (Mermaid) en el README (Tarea #05).
- Protección de la rama `main`: exige Pull Request y pipeline de CI en verde antes
  de fusionar (Tarea #06).

## Referencia de tareas

| # | Tarea | Área |
|---|---|---|
| 01 | Commit inicial del sistema de bóveda segura | Base |
| 02 | `.gitignore` + `.env.example` (paridad de entornos) | DevOps |
| 03 | Pipeline de CI (lint + test + build) | DevOps |
| 04 | `CONTRIBUTING.md` (GitFlow + Conventional Commits + DoD) | DevOps |
| 05 | Diagrama de arquitectura (Mermaid) | Docs |
| 06 | Protección de rama `main` (PR + CI obligatorios) | DevOps |
| 07 | Autenticación por `nombre_usuario` + bcrypt + jerarquía de roles numérica | Auth |
| 08 | Login en dos pasos: contraseña → pre-auth → MFA facial | Auth |
| 09 | Cifrado de archivos AES-256-GCM con envelope encryption (`crypto.ts`) | Seguridad |
| 10 | Control de acceso Bell-LaPadula (`access.ts`) | Seguridad |
| 11 | Bitácora inmutable con cadena de firmas HMAC-SHA256 (`audit.ts`) | Seguridad |
| 12 | Reconocimiento facial (`face.ts`, distancia euclidiana, umbral 0.55) | Seguridad |
| 13 | Módulo Bóveda: proyectos, archivos, `DocumentTable`, `StorageStats` | Producto |
| 14 | Documentación técnica autogenerada (TypeDoc) | Docs |
| 15 | JSDoc completo en `src/lib` | Docs |
| 16 | Diagrama ER + diagrama de secuencia MFA (Mermaid) — agregado y luego retirado | Docs |
| 17 | `CHANGELOG.md` | Docs |
| 18 | Badge de estado de CI en el README | Docs |
| 19 | Quitar diagrama ER y de secuencia MFA del README | Docs |
| 20 | `CONTRIBUTORS.md` base | Docs |
| 21 | Agregar a osmaneduardo2232-prog como colaborador + exigir 1 aprobación en `main` | DevOps |
| 22 | `/api/health` + intento inicial de despliegue en Railway (superado por Tarea #24) | DevOps |
| 23 | Actualizar Next.js a 15.5.20 (CVEs críticos en 15.1.0) | Seguridad |
| 24 | Pivote a Vercel + Neon + Vercel Blob: storage.ts, directUrl, CD sin Docker (superado por Tarea #25) | DevOps |
| 25 | Pivote a Netlify + Neon + Netlify Blobs (Vercel pidió verificación adicional) | DevOps |
| 26 | Fix: `binaryTargets` de Prisma para el runtime serverless de Netlify | DevOps |
| 27 | Correlation ID + logs estructurados en JSON (`logger.ts`, middleware, 17 rutas) | Seguridad |
| 28 | Validación BlueTeam: esquemas Zod reutilizables, cuid en `[id]`, descriptor facial, sort allow-list | Seguridad |
| 29 | Workflow de respaldo automatizado (regla 3-2-1) con verificación real de restauración | DevOps |
| 30 | Fix: `postgres:18` en `backup.yml` (Neon corre PG 18, no 17) | DevOps |
| 31 | `RUNBOOK.md`: diagnóstico, protocolo ante caídas (L1/L2/L3), recuperación 3-2-1 | Docs |
