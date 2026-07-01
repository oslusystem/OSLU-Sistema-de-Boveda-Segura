'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import UsersTable from '@/components/usuarios/UsersTable'
import UserModal from '@/components/usuarios/UserModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DeleteAdminDialog from '@/components/usuarios/DeleteAdminDialog'
import { useToasts, ToastContainer } from '@/components/ui/Toast'
import { NIVEL_ROL } from '@/lib/constants'
import { Users } from 'lucide-react'
import type { Usuario, Rol, ClasificacionSeguridad } from '@/types'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Pick<Rol, 'id' | 'nombre_rol' | 'nivel_numerico'>[]>([])
  const [niveles, setNiveles] = useState<Pick<ClasificacionSeguridad, 'id' | 'nombre' | 'nivel_numerico'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Usuario | null>(null)
  const [toggling, setToggling] = useState(false)
  const { toasts, toast, dismiss } = useToasts()

  const isTargetAdmin = !!deleteTarget?.rol && deleteTarget.rol.nivel_numerico >= NIVEL_ROL.ADMIN

  const totalUsuarios = usuarios.length
  const totalActivos  = usuarios.filter((u) => u.activo).length
  const totalInactivos = totalUsuarios - totalActivos

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [ur, rr, cr] = await Promise.all([
      fetch('/api/usuarios'),
      fetch('/api/roles'),
      fetch('/api/clasificaciones'),
    ])
    const [uj, rj, cj] = await Promise.all([ur.json(), rr.json(), cr.json()])
    if (uj.ok) setUsuarios(uj.data)
    if (rj.ok) setRoles(rj.data)
    if (cj.ok) setNiveles(cj.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleSave(data: Record<string, unknown>) {
    const url = editing ? `/api/usuarios/${editing.id}` : '/api/usuarios'
    const method = editing ? 'PATCH' : 'POST'
    const payload = { ...data }
    if (editing && !payload.password) delete payload.password

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) { setShowModal(false); setEditing(null); loadAll() }
    else { const e = await res.json(); toast('error', e.error ?? 'Error') }
  }

  function handleToggle(u: Usuario) {
    setToggleTarget(u)
  }

  async function doToggle(u: Usuario) {
    setToggling(true)
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? 'Error al actualizar el usuario')
      }
      toast('success', `Usuario "${u.nombre_usuario}" ${u.activo ? 'desactivado' : 'activado'}`)
      setToggleTarget(null)
      loadAll()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setToggling(false)
    }
  }

  async function confirmDelete(passwords?: { actual: string; objetivo: string }) {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/usuarios/${deleteTarget.id}`, {
        method: 'DELETE',
        ...(passwords && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password_actual: passwords.actual, password_objetivo: passwords.objetivo }),
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? 'Error al eliminar el usuario')
      }
      toast('success', `Usuario "${deleteTarget.nombre_usuario}" eliminado`)
      setDeleteTarget(null)
      loadAll()
    } catch (e) {
      const msg = (e as Error).message
      if (passwords) setDeleteError(msg)
      else toast('error', msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Gestión de Usuarios"
        subtitle="Administrar accesos, roles y acreditaciones"
        icon={<Users />}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card border-t-4 border-t-purple-500">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Total usuarios</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalUsuarios}</p>
            <p className="text-slate-400 text-xs mt-1">cuentas registradas en el sistema</p>
          </div>
          <div className="card border-t-4 border-t-emerald-500">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Activos</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{totalActivos}</p>
            <p className="text-slate-400 text-xs mt-1">con acceso habilitado al sistema</p>
          </div>
          <div className="card border-t-4 border-t-amber-500">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Inactivos</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{totalInactivos}</p>
            <p className="text-slate-400 text-xs mt-1">acceso suspendido o bloqueado</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Cargando usuarios...</div>
        ) : (
          <UsersTable
            usuarios={usuarios}
            onCreate={() => { setEditing(null); setShowModal(true) }}
            onEdit={(u) => { setEditing(u); setShowModal(true) }}
            onToggle={handleToggle}
            onDelete={setDeleteTarget}
          />
        )}
      </main>

      {showModal && (
        <UserModal
          usuario={editing}
          roles={roles}
          niveles={niveles}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}

      {deleteTarget && isTargetAdmin && (
        <DeleteAdminDialog
          targetName={deleteTarget.nombre_usuario}
          loading={deleting}
          error={deleteError}
          onConfirm={(actual, objetivo) => confirmDelete({ actual, objetivo })}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
        />
      )}

      {deleteTarget && !isTargetAdmin && (
        <ConfirmDialog
          title="Eliminar usuario"
          message={`¿Eliminar permanentemente al usuario "${deleteTarget.nombre_usuario}"? Esta acción no se puede revertir.`}
          confirmLabel="Eliminar"
          loading={deleting}
          onConfirm={() => confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toggleTarget && (
        <ConfirmDialog
          title={toggleTarget.activo ? 'Desactivar usuario' : 'Activar usuario'}
          message={
            toggleTarget.activo
              ? `¿Desactivar al usuario "${toggleTarget.nombre_usuario}"? No podrá iniciar sesión hasta que se reactive su cuenta.`
              : `¿Reactivar al usuario "${toggleTarget.nombre_usuario}"? Podrá iniciar sesión nuevamente con su acceso anterior.`
          }
          confirmLabel={toggleTarget.activo ? 'Desactivar' : 'Activar'}
          variant={toggleTarget.activo ? 'danger' : 'default'}
          loading={toggling}
          onConfirm={() => doToggle(toggleTarget)}
          onCancel={() => setToggleTarget(null)}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
