# 🔐 OSLU — Sistema de Bóveda Segura

[![CI](https://github.com/oslusystem/OSLU-Sistema-de-Boveda-Segura/actions/workflows/ci.yml/badge.svg)](https://github.com/oslusystem/OSLU-Sistema-de-Boveda-Segura/actions/workflows/ci.yml)

**OSLU** es una bóveda documental para información sensible: cada archivo se
cifra individualmente, cada acceso pasa por tres barreras de seguridad
(usuario activo, clasificación y necesidad de saber) y cada acción —subida,
descarga, login, borrado— queda registrada en una bitácora que no se puede
alterar ni borrar, ni siquiera por un administrador con acceso directo a la
base de datos.

Construido con **Next.js 15** (App Router) y **PostgreSQL** vía **Prisma**.
El login es de dos pasos: contraseña y, obligatoriamente, **reconocimiento
facial** como segundo factor. El cifrado es **AES‑256‑GCM** con clave por
archivo envuelta en una clave maestra del servidor (envelope encryption), y el
control de acceso sigue el modelo **Bell‑LaPadula** ("no leer hacia arriba")
combinado con autorizaciones explícitas por proyecto.

---

## ✨ Características de seguridad

- **Cifrado en reposo** — cada archivo se cifra con su propia clave AES‑256‑GCM;
  esa clave se guarda *envuelta* (envelope encryption) con la `MASTER_KEY` del
  servidor en la tabla `gestion_claves`.
- **Integridad** — se almacena el SHA‑256 del contenido original y se reverifica
  en cada descarga.
- **Control de acceso multicapa** — clasificación (Bell‑LaPadula "no read up") +
  necesidad de saber por compartimento.
- **Bitácora inmutable** — cadena de firmas HMAC‑SHA256 (estilo libro mayor) y
  reglas SQL que bloquean `UPDATE`/`DELETE`.
- **Separación de runtimes** — verificación JWT en el Edge (Web Crypto API) y
  lógica Node.js en los route handlers.

---

## 🏛️ Arquitectura

```mermaid
flowchart TB
    subgraph Cliente
        UI["Next.js App Router<br/>(React Server + Client Components)"]
    end

    subgraph Edge["Edge Runtime"]
        MW["middleware.ts<br/>Verifica JWT (Web Crypto)<br/>Inyecta x-user-* headers"]
    end

    subgraph Node["Node.js Runtime"]
        API["API Route Handlers<br/>/api/archivos · /api/usuarios · /api/proyectos"]
        AUTH["lib/auth.ts<br/>bcrypt · JWT"]
        CRYPTO["lib/crypto.ts<br/>AES-256-GCM · SHA-256"]
        ACCESS["lib/access.ts<br/>clasificación + need-to-know"]
        AUDIT["lib/audit.ts<br/>bitácora inmutable HMAC"]
    end

    subgraph Datos
        DB[("PostgreSQL<br/>vía Prisma")]
        VAULT["storage/vault/*.enc<br/>(archivos cifrados)"]
    end

    UI -->|"cookie httpOnly"| MW
    MW --> API
    API --> AUTH
    API --> CRYPTO
    API --> ACCESS
    API --> AUDIT
    AUTH --> DB
    ACCESS --> DB
    AUDIT --> DB
    CRYPTO --> VAULT
    API --> DB
```

---

## 📸 Capturas del sistema

**Login** — autenticación en dos pasos (contraseña + MFA facial)
![Login](public/screenshots/login.png)

**Dashboard** — vista general, estado de la bóveda y accesos rápidos
![Dashboard](public/screenshots/dashboard.png)

**Bóveda** — proyectos (compartimentos) y archivos cifrados
![Bóveda](public/screenshots/boveda.png)

**Gestión de usuarios** — roles y niveles de acreditación
![Usuarios](public/screenshots/usuarios.png)

**Auditoría** — bitácora inmutable con verificación de integridad de la cadena
![Auditoría](public/screenshots/auditoria.png)

**Información** — propósito del sistema y características de seguridad
![Información](public/screenshots/informacion.png)

---

## 🚀 Puesta en marcha

```bash
npm install
cp .env.example .env.local          # completar credenciales reales
npm run db:setup                    # generate + migrate + harden (reglas inmutables) + seed
npm run dev
```

> `db:setup` encadena todo. Equivale a: `prisma generate` →
> `prisma migrate dev` → `npm run db:harden` (aplica `prisma/immutability.sql`)
> → `npm run db:seed`.

Generar las claves de cifrado y firma:

```bash
node -e "console.log('MASTER_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('HMAC_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Credenciales tras el seed

| Usuario | Contraseña | Rol | Acreditación |
|---|---|---|---|
| `admin` | `Admin1234!` | Administrador | SECRETO |
| `superior` | `Superior1234!` | Oficial Superior | CONFIDENCIAL |
| `general` | `General1234!` | Oficial General | SECRETO |
| `subalterno` | `Subalterno1234!` | Oficial Subalterno | RESERVADO |

---

## 🧪 Comandos

```bash
npm run dev        # servidor de desarrollo (Turbopack)
npm run build      # build de producción
npm run lint       # ESLint
npm test           # pruebas unitarias (Vitest)
npm run test:watch # pruebas en modo watch

npx prisma studio  # explorador visual de la BD
npx prisma migrate dev --name <nombre>   # nueva migración
```

> ⚠️ Tras cada `prisma migrate`, ejecutar `npm run db:harden` para reaplicar las
> reglas de inmutabilidad de la bitácora (`prisma/immutability.sql`, idempotente),
> ya que Prisma no genera reglas `RULE` automáticamente.

---

## 🚀 Despliegue

**Sistema en producción:** _pendiente — se agrega el enlace al desplegar en Railway (Tarea #22)._

El sistema corre en producción como un **artefacto Docker inmutable** (no en
modo `next dev`), desplegado en [Railway](https://railway.app):

- **`Dockerfile`** — build multi-stage sobre `node:20-bookworm-slim`: la etapa
  `builder` genera el cliente Prisma y el build standalone de Next.js; la
  etapa `runner` sólo copia el artefacto final + el CLI de Prisma (necesario
  para migrar en cada arranque). Incluye `HEALTHCHECK` nativo de Docker contra
  `/api/health`.
- **`docker-entrypoint.sh`** — en cada arranque del contenedor: aplica
  `prisma migrate deploy`, reaplica las reglas de inmutabilidad de la
  bitácora (`prisma/immutability.sql`, idempotente) y recién entonces levanta
  el servidor.
- **`railway.json`** — configura el healthcheck (`/api/health`) y la política
  de reinicio automático ante fallas (`restartPolicyType: ON_FAILURE`,
  equivalente a `restart: unless-stopped` en Docker/Compose) — self-healing
  sin intervención manual.
- **Cero credenciales en el repo**: las variables de `.env.example` se
  inyectan como variables de entorno directamente en Railway (nunca se sube
  un `.env` real). `storage/vault/` vive en un volumen persistente montado en
  el contenedor.
- **CD automatizado**: `.github/workflows/ci.yml` tiene un job `deploy` que
  se dispara únicamente cuando un Pull Request se fusiona a `main` (con CI en
  verde) — construye y publica el artefacto en Railway sin pasos manuales.

### Probar el artefacto de producción en local (antes de desplegar)

```bash
docker compose up -d --build
curl http://localhost:3000/api/health   # {"status":"ok","db":"connected",...}
docker compose down -v
```

`docker-compose.yml` es sólo para esta verificación local (Postgres +
la imagen de producción); Railway no lo usa, construye directamente desde el
`Dockerfile`.

---

## 📚 Documentación técnica

El código se documenta a sí mismo con comentarios JSDoc en cada módulo y función
principal de `src/lib`. Para generar el sitio estático navegable a partir de esos
comentarios:

```bash
npm run docs
```

Esto genera `docs-site/index.html` (con [TypeDoc](https://typedoc.org)) — ábrelo
en el navegador para explorar la documentación de `auth`, `crypto`, `access`,
`audit`, `face`, `session`, `utils` y los tipos compartidos. La carpeta
`docs-site/` no se versiona (se regenera bajo demanda, ver `.gitignore`).

---

## 📦 Stack

- **Next.js 15** · App Router · React 19
- **Prisma 5** + **PostgreSQL**
- **bcryptjs** (hash de contraseñas) · **jsonwebtoken** (sesión)
- **Node.js crypto** (AES‑256‑GCM, SHA‑256, HMAC)
- **Tailwind CSS** · **Vitest**

Detalles de arquitectura interna y convenciones de contribución en
[`CONTRIBUTING.md`](CONTRIBUTING.md). Bitácora de cambios en [`CHANGELOG.md`](CHANGELOG.md).
