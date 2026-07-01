'use client'

import { useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'

interface DeleteAdminDialogProps {
  targetName: string
  loading?:   boolean
  error?:     string | null
  onConfirm:  (passwordActual: string, passwordObjetivo: string) => void
  onCancel:   () => void
}

/**
 * Confirmación reforzada para eliminar una cuenta con rol Administrador: exige
 * la contraseña de quien elimina y la del administrador objetivo.
 */
export default function DeleteAdminDialog({ targetName, loading, error, onConfirm, onCancel }: DeleteAdminDialogProps) {
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordObjetivo, setPasswordObjetivo] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(passwordActual, passwordObjetivo)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative bg-surface-card rounded-2xl shadow-modal w-full max-w-sm animate-slide-up">
        <button type="button" onClick={onCancel} className="absolute top-3 right-3 btn-ghost w-8 h-8 p-0 rounded-full">
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4 bg-status-danger-bg text-status-danger">
            <ShieldAlert className="w-5 h-5" />
          </div>

          <h2 className="font-semibold text-slate-900 text-lg">Eliminar administrador</h2>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Está eliminando una cuenta con rol Administrador (&quot;{targetName}&quot;). Por seguridad, confirme ambas contraseñas.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Su contraseña (sesión actual)</label>
              <input
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña de &quot;{targetName}&quot;</label>
              <input
                type="password"
                value={passwordObjetivo}
                onChange={(e) => setPasswordObjetivo(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-status-danger">{error}</p>}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">Cancelar</button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-status-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Eliminar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
