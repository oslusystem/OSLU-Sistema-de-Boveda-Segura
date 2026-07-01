/**
 * seed.ts — Datos iniciales del Sistema de Bóveda Segura (v2).
 *
 * Crea: roles, niveles de clasificación, usuarios de prueba, un proyecto
 * de ejemplo y una autorización Need-to-Know. Idempotente vía upsert.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database (v2)...')

  // ── Roles ───────────────────────────────────────────────────────────────────
  // Jerarquía: Administrador (4, control total) > Oficial Superior (3) >
  // Oficial General (2, mínimo para gestionar archivos/proyectos) > Oficial Subalterno (1, solo lectura).
  // `update` sincroniza nivel_numerico/descripcion en cada re-seed, para que un
  // cambio de jerarquía en este archivo se refleje en filas ya existentes.
  const [rolAdmin, rolSuperior, rolGeneral, rolSubalterno] = await Promise.all([
    prisma.rol.upsert({
      where: { nombre_rol: 'Administrador' },
      update: { nivel_numerico: 4, descripcion: 'Control total del sistema' },
      create: { nombre_rol: 'Administrador', nivel_numerico: 4, descripcion: 'Control total del sistema' },
    }),
    prisma.rol.upsert({
      where: { nombre_rol: 'Oficial Superior' },
      update: { nivel_numerico: 3, descripcion: 'Carga y gestión de archivos y proyectos' },
      create: { nombre_rol: 'Oficial Superior', nivel_numerico: 3, descripcion: 'Carga y gestión de archivos y proyectos' },
    }),
    prisma.rol.upsert({
      where: { nombre_rol: 'Oficial General' },
      update: { nivel_numerico: 2, descripcion: 'Carga y gestión de archivos y proyectos' },
      create: { nombre_rol: 'Oficial General', nivel_numerico: 2, descripcion: 'Carga y gestión de archivos y proyectos' },
    }),
    prisma.rol.upsert({
      where: { nombre_rol: 'Oficial Subalterno' },
      update: { nivel_numerico: 1, descripcion: 'Consulta según necesidad de saber' },
      create: { nombre_rol: 'Oficial Subalterno', nivel_numerico: 1, descripcion: 'Consulta según necesidad de saber' },
    }),
  ])

  // ── Clasificaciones de seguridad ─────────────────────────────────────────────
  // Jerarquía: Reservado (1) < Confidencial (2) < Secreto (3). Cada rol está
  // topeado a la clasificación con su mismo número (Subalterno→Reservado,
  // General→Confidencial, Superior→Secreto; ver TOPE_CLASIFICACION_ROL en
  // src/lib/constants.ts); sólo Administrador no tiene tope de rol.
  const [clReservado, clConfidencial, clSecreto] = await Promise.all([
    prisma.clasificacionSeguridad.upsert({
      where: { nombre: 'RESERVADO' },
      update: { nivel_numerico: 1, descripcion: 'Acceso base, oficiales subalternos' },
      create: { nombre: 'RESERVADO', nivel_numerico: 1, descripcion: 'Acceso base, oficiales subalternos' },
    }),
    prisma.clasificacionSeguridad.upsert({
      where: { nombre: 'CONFIDENCIAL' },
      update: { nivel_numerico: 2, descripcion: 'Acceso restringido, oficiales superiores' },
      create: { nombre: 'CONFIDENCIAL', nivel_numerico: 2, descripcion: 'Acceso restringido, oficiales superiores' },
    }),
    prisma.clasificacionSeguridad.upsert({
      where: { nombre: 'SECRETO' },
      update: { nivel_numerico: 3, descripcion: 'Máxima reserva, oficiales generales y administración' },
      create: { nombre: 'SECRETO', nivel_numerico: 3, descripcion: 'Máxima reserva, oficiales generales y administración' },
    }),
  ])

  // ── Usuarios ─────────────────────────────────────────────────────────────────
  const admin = await prisma.usuario.upsert({
    where: { nombre_usuario: 'admin' },
    update: {},
    create: {
      nombre_usuario: 'admin',
      password_hash:  await bcrypt.hash('Admin1234!', 12),
      rol_id:                 rolAdmin.id,
      nivel_clasificacion_id: clSecreto.id,
      activo: true,
    },
  })

  const superior = await prisma.usuario.upsert({
    where: { nombre_usuario: 'superior' },
    update: {},
    create: {
      nombre_usuario: 'superior',
      password_hash:  await bcrypt.hash('Superior1234!', 12),
      rol_id:                 rolSuperior.id,
      nivel_clasificacion_id: clSecreto.id,
      activo: true,
    },
  })

  await prisma.usuario.upsert({
    where: { nombre_usuario: 'general' },
    update: {},
    create: {
      nombre_usuario: 'general',
      password_hash:  await bcrypt.hash('General1234!', 12),
      rol_id:                 rolGeneral.id,
      nivel_clasificacion_id: clConfidencial.id,
      activo: true,
    },
  })

  await prisma.usuario.upsert({
    where: { nombre_usuario: 'subalterno' },
    update: {},
    create: {
      nombre_usuario: 'subalterno',
      password_hash:  await bcrypt.hash('Subalterno1234!', 12),
      rol_id:                 rolSubalterno.id,
      nivel_clasificacion_id: clReservado.id,
      activo: true,
    },
  })

  // ── Proyecto / compartimento de ejemplo ──────────────────────────────────────
  const proyecto = await prisma.proyecto.upsert({
    where: { id: 'proj-demo' },
    update: {},
    create: {
      id: 'proj-demo',
      nombre_proyecto: 'Operación Centinela',
      descripcion: 'Compartimento de demostración',
      nivel_clasificacion_minimo_id: clConfidencial.id,
    },
  })

  // ── Need-to-Know: el oficial superior queda autorizado en el proyecto demo ───
  await prisma.necesidadSaber.upsert({
    where: { usuario_id_proyecto_id: { usuario_id: superior.id, proyecto_id: proyecto.id } },
    update: {},
    create: { usuario_id: superior.id, proyecto_id: proyecto.id, autorizado_por: admin.id },
  })

  console.log('Seed completo.')
  console.log('Credenciales de acceso:')
  console.log('  Administrador      → admin       / Admin1234!       (SECRETO)')
  console.log('  Oficial Superior   → superior    / Superior1234!    (SECRETO, autorizado en "Operación Centinela")')
  console.log('  Oficial General    → general     / General1234!     (CONFIDENCIAL, sin necesidad de saber aún)')
  console.log('  Oficial Subalterno → subalterno  / Subalterno1234!  (RESERVADO, sin necesidad de saber aún)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
