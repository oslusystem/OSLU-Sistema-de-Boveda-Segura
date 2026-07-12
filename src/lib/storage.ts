/**
 * storage.ts — almacenamiento de archivos cifrados en Netlify Blobs.
 *
 * El backend corre como funciones serverless (Netlify): no hay disco
 * persistente, así que los blobs `.enc` (ya cifrados con AES-256-GCM por
 * `crypto.ts`, ver envelope encryption) se guardan en Netlify Blobs en vez de
 * en `storage/vault/`. `archivos.ruta_cifrada` pasa a contener la *key* del
 * blob dentro del store en lugar de una ruta local — el contrato con el
 * resto del sistema no cambia (sigue siendo un string opaco que nunca se
 * expone al cliente).
 *
 * `getStore` con `siteID`/`token` explícitos funciona tanto dentro del
 * runtime de Netlify (deploy real) como fuera de él (scripts locales, CI) —
 * ver NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN en .env.example.
 */
import { getStore } from '@netlify/blobs'

function vaultStore() {
  const siteID = process.env.NETLIFY_SITE_ID
  const token  = process.env.NETLIFY_BLOBS_TOKEN
  if (siteID && token) {
    return getStore({ name: 'vault', siteID, token })
  }
  // Dentro del runtime de Netlify (Functions) el contexto se inyecta solo.
  return getStore('vault')
}

export async function storeEncrypted(key: string, data: Buffer): Promise<string> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  await vaultStore().set(key, arrayBuffer)
  return key
}

export async function readEncrypted(key: string): Promise<Buffer> {
  const data = await vaultStore().get(key, { type: 'arrayBuffer' })
  if (!data) {
    throw new Error(`Blob no encontrado: ${key}`)
  }
  return Buffer.from(data)
}

export async function deleteEncrypted(key: string): Promise<void> {
  await vaultStore().delete(key)
}
