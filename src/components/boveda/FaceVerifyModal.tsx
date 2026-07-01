'use client'

import { useState } from 'react'
import { X, ScanFace } from 'lucide-react'
import FaceCapture from '@/components/auth/FaceCapture'

interface FaceVerifyModalProps {
  archivoId:      string
  archivoNombre:  string
  actionLabel:    'ver' | 'descargar'
  onVerified:     (token: string) => void
  onCancel:       () => void
}

/**
 * Re-verificación facial puntual antes de ver/descargar un archivo. Reutiliza
 * el mismo FaceCapture del login (mode="verify"), pero contra
 * /api/auth/verify-face, que exige sesión ya iniciada y emite un token corto
 * atado a este archivo en vez de una cookie de sesión.
 */
export default function FaceVerifyModal({
  archivoId, archivoNombre, actionLabel, onVerified, onCancel,
}: FaceVerifyModalProps) {
  const [busy, setBusy] = useState(false)

  async function handleDescriptor(descriptor: number[]) {
    setBusy(true)
    try {
      const res = await fetch('/api/auth/verify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor, archivoId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error ?? 'No se pudo verificar el rostro' }
      }
      onVerified(json.data.token as string)
      return { ok: true }
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative bg-surface-card rounded-2xl shadow-modal w-full max-w-sm animate-slide-up">
        <button onClick={onCancel} className="absolute top-3 right-3 btn-ghost w-8 h-8 p-0 rounded-full">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4 bg-brand-50 text-brand-500">
            <ScanFace className="w-5 h-5" />
          </div>

          <h2 className="font-semibold text-slate-900 text-lg">Verificación facial requerida</h2>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Confirma tu identidad para {actionLabel} &quot;{archivoNombre}&quot;.
          </p>

          <div className="mt-5">
            <FaceCapture mode="verify" onDescriptor={handleDescriptor} busy={busy} />
          </div>
        </div>
      </div>
    </div>
  )
}
