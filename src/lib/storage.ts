/**
 * storage.ts — almacenamiento de archivos cifrados en Vercel Blob.
 *
 * El backend es serverless (Vercel): no hay disco persistente, así que los
 * blobs `.enc` (ya cifrados con AES-256-GCM por `crypto.ts`, ver
 * envelope encryption) se guardan en Vercel Blob en vez de en
 * `storage/vault/`. `archivos.ruta_cifrada` pasa a contener la URL del blob
 * en lugar de una ruta local — el contrato con el resto del sistema no
 * cambia (sigue siendo un string opaco que nunca se expone al cliente).
 *
 * El nombre del blob incluye un UUID aleatorio (impredecible) y el contenido
 * ya viene cifrado, así que aunque Vercel Blob sólo soporte acceso `public`
 * (no hay "privado" nativo), la confidencialidad depende del cifrado, no de
 * la URL — el mismo modelo que un bucket S3 "unlisted".
 */
import { put, del } from '@vercel/blob'

export async function storeEncrypted(key: string, data: Buffer): Promise<string> {
  const blob = await put(key, data, { access: 'public', addRandomSuffix: false })
  return blob.url
}

export async function readEncrypted(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`No se pudo leer el blob (HTTP ${res.status}): ${url}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function deleteEncrypted(url: string): Promise<void> {
  await del(url)
}
