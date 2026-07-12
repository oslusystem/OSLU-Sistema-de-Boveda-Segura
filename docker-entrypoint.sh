#!/bin/sh
set -e

echo "[BOOT] $(date -Iseconds) Aplicando migraciones de Prisma..."
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

echo "[BOOT] $(date -Iseconds) Aplicando reglas de inmutabilidad de la bitácora..."
./node_modules/.bin/prisma db execute --file prisma/immutability.sql --schema prisma/schema.prisma

echo "[BOOT] $(date -Iseconds) Iniciando servidor Next.js..."
exec node server.js
