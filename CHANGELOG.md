# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Todos los commits del proyecto siguen [Conventional Commits](https://www.conventionalcommits.org/)
e incluyen la referencia `(Tarea #NN)` a la tabla de abajo, tal como exige
[`CONTRIBUTING.md`](CONTRIBUTING.md).

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
