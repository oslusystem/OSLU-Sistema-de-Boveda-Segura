# RUNBOOK — Guía de primeros auxilios del sistema

Este documento es la referencia operativa ante un incidente en producción.
Los comandos de la Fase #3 (Recuperación ante Desastres) fueron **ejecutados
y verificados de verdad** antes de escribirlos aquí (ver `CHANGELOG.md`,
Tareas #29/#30) — no son una descripción de memoria.

**Sistema:** https://oslu-sistema-boveda.netlify.app
**Repositorio:** https://github.com/oslusystem/OSLU-Sistema-de-Boveda-Segura
**Base de datos:** Neon (PostgreSQL 18) — [dashboard](https://console.neon.tech)

---

## Fase #1 — Diagnóstico

Comandos exactos para verificar el estado del sistema ante un reporte de falla.

### 1. Healthcheck

```bash
curl -s https://oslu-sistema-boveda.netlify.app/api/health
```

- **Sano:** `{"status":"ok","db":"connected","timestamp":"...","uptime_s":N}` (HTTP 200)
- **Caído:** `{"status":"error","db":"disconnected","timestamp":"..."}` (HTTP 503)

### 2. Localizar el incidente por Correlation ID

Cuando un usuario reporta el mensaje seguro `"Ocurrió un error. Reporte el
código: <uuid>"`, ese UUID es el Correlation ID (`x-request-id`) de su
petición. Buscarlo en los logs estructurados en JSON:

```bash
netlify logs --source functions --since 30m
# o filtrando directo por el código reportado:
netlify logs --source functions --since 1h | grep "<uuid-reportado>"
```

Cada línea de error es JSON con `{timestamp, level, context, message,
requestId, ...}` — el campo `context` indica qué ruta/módulo falló
(`UPLOAD`, `LOGIN`, `PROYECTO_DELETE`, etc.) y `requestId` debe coincidir con
el UUID que vio el usuario.

### 3. Estado del último despliegue (CD)

```bash
gh run list -R oslusystem/OSLU-Sistema-de-Boveda-Segura --branch main --limit 5
```

### 4. Estado de la base de datos

Dashboard de Neon → proyecto → pestaña "Monitoring" (conexiones activas,
errores) y "Branches" (para ver el historial de Point-in-Time Restore).

---

## Fase #2 — Protocolo ante caídas (niveles de escalado)

### L1 — Triage inicial (cualquiera del equipo)

1. Correr el healthcheck (Fase #1, paso 1).
2. Si `db: "disconnected"` pero el sitio carga: puede ser un cold-start de
   Neon (autosuspend en free tier) — reintentar el healthcheck a los 15-30s.
3. Buscar el Correlation ID del reporte en los logs (Fase #1, paso 2) para
   entender la causa exacta antes de escalar.
4. Si es un error aislado y no se repite: registrar y cerrar. Si se repite o
   afecta a más de un usuario: escalar a L2.

### L2 — Rollback (alguien con acceso al repo/Netlify)

1. Si el incidente empezó justo después de un merge a `main`, identificar el
   deploy anterior bueno:
   - Dashboard → https://app.netlify.com/projects/oslu-sistema-boveda/deploys
   - Cada deploy tiene un botón **"Publish deploy"** para volver a activarlo
     de inmediato sin esperar un nuevo build.
2. En paralelo (para que el historial de `main` quede consistente y el
   próximo merge no reintroduzca el problema), revertir el commit/PR
   responsable:
   ```bash
   git revert -m 1 <sha-del-merge-commit-problemático>
   git push origin revert-branch
   gh pr create --base main --head revert-branch --title "revert: <descripción>"
   ```
   Este PR sigue el mismo flujo de siempre (CI + 1 aprobación) y, al
   mergearse, el CD ya configurado (`.github/workflows/ci.yml`) redespliega
   automáticamente la versión buena.
3. Confirmar con el healthcheck (Fase #1, paso 1) que el sistema volvió a
   `"status":"ok"`.

### L3 — Escalado a recuperación de datos

Si el problema **no** es el código desplegado sino la integridad de los
datos (corrupción, borrado accidental, migración fallida sin rollback
posible): pasar a la Fase #3.

---

## Fase #3 — Recuperación ante desastres (regla 3-2-1)

Las 3 copias de los datos:
1. **Producción** — Neon (PostgreSQL 18).
2. **Point-in-Time Restore de Neon** — historial interno de Neon, disponible
   en la pestaña "Branches" del dashboard (ventana de restauración según el
   plan del proyecto).
3. **Copia offsite en medio distinto** — `.github/workflows/backup.yml`
   corre diariamente (y bajo demanda) y sube un `pg_dump` de Neon como
   **artefacto de GitHub Actions** — infraestructura completamente separada
   de Neon, con retención de 90 días.

> ⚠️ Este respaldo cubre la **base de datos**. Los archivos cifrados en
> Netlify Blobs no tienen respaldo automatizado todavía — ver
> "Limitaciones conocidas" al final.

### Procedimiento exacto de restauración (verificado el 14 de julio de 2026)

**1. Descargar el respaldo más reciente:**

```bash
gh run list -R oslusystem/OSLU-Sistema-de-Boveda-Segura --workflow=backup.yml --limit 1
gh run download <run-id> -R oslusystem/OSLU-Sistema-de-Boveda-Segura -n db-backup-<run-id>
```

**2. Restaurar contra la base de datos de Neon** (usa `DIRECT_URL`, la misma
conexión directa que usan las migraciones — ver secretos del repo o el
dashboard de Neon → "Connection Details" → "Direct connection"):

```bash
docker run --rm -v "$PWD/backup.dump:/backup.dump" postgres:18 \
  pg_restore --clean --if-exists --no-owner --no-privileges \
    -d "$DIRECT_URL" /backup.dump
```

**3. Reaplicar las reglas de inmutabilidad de la bitácora** (Prisma no las
incluye en el dump/restore, ver `prisma/immutability.sql`):

```bash
npx prisma db execute --file prisma/immutability.sql --schema prisma/schema.prisma
```

**4. Verificar que el sistema volvió a estar en línea:**

```bash
curl -s https://oslu-sistema-boveda.netlify.app/api/health
# esperar: {"status":"ok","db":"connected",...}

curl -s -X POST https://oslu-sistema-boveda.netlify.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"admin","password":"Admin1234!"}'
# esperar: {"ok":true,"data":{"step":"mfa",...}}
```

Este ciclo completo (dump → artefacto → `pg_restore` → verificación) se probó
de punta a punta el 14/07/2026 contra una base de datos efímera: la
restauración recreó correctamente las 5 filas de `usuarios` esperadas. Ver el
run: `gh run view 29336680328 -R oslusystem/OSLU-Sistema-de-Boveda-Segura`.

### Limitaciones conocidas

- Los archivos cifrados en Netlify Blobs (`storage/vault/`, ver
  `src/lib/storage.ts`) no tienen respaldo automatizado — sólo los metadatos
  en la base de datos. Pendiente para un futuro avance.
- El respaldo corre 1 vez al día — el peor caso de pérdida de datos (RPO) es
  de ~24 h entre respaldos.
