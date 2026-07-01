'use client'

import { useState } from 'react'
import { PenLine, UserX, UserCheck, Trash2, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatDate, clasificacionBadge } from '@/lib/utils'
import Pagination from '@/components/ui/Pagination'
import type { Usuario } from '@/types'

function rolBadge(nivel: number): string {
  if (nivel >= 4) return 'badge-danger'
  if (nivel === 3) return 'badge-pending'
  if (nivel === 2) return 'badge-info'
  return 'badge-active'
}

type SortKey = 'nombre_usuario' | 'rol' | 'nivel_clasificacion' | 'fecha_creacion'
type SortDir = 'asc' | 'desc'

function sortValue(u: Usuario, key: SortKey): string | number {
  switch (key) {
    case 'nombre_usuario':       return u.nombre_usuario.toLowerCase()
    case 'rol':                  return u.rol?.nivel_numerico ?? 0
    case 'nivel_clasificacion':  return u.nivel_clasificacion?.nivel_numerico ?? 0
    case 'fecha_creacion':       return u.fecha_creacion
  }
}

interface UsersTableProps {
  usuarios: Usuario[]
  onCreate: () => void
  onEdit:   (u: Usuario) => void
  onToggle: (u: Usuario) => void
  onDelete: (u: Usuario) => void
}

export default function UsersTable({ usuarios, onCreate, onEdit, onToggle, onDelete }: UsersTableProps) {
  const [search,  setSearch]  = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page,    setPage]    = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('fecha_creacion')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const filtered = usuarios.filter((u) =>
    u.nombre_usuario.toLowerCase().includes(search.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const paginated  = sorted.slice((safePage - 1) * perPage, safePage * perPage)
  const total      = sorted.length
  const rangeStart = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const rangeEnd   = Math.min(safePage * perPage, total)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown className="w-3 h-3 ml-1 text-slate-400 inline" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 text-brand-500 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-brand-500 inline" />
  }

  return (
    <div className="card">
      <div className="flex flex-col gap-4 mb-4">
        <button onClick={onCreate} className="btn-primary gap-1.5 self-start">
          <Plus className="w-4 h-4" /> Crear usuario
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            Mostrar
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {[5, 10, 25, 50].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            registros
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            Buscar:
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="border border-slate-200 rounded px-2 py-0.5 text-sm bg-slate-50 text-slate-700 w-44 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="table-header-cell">#</th>
              <th className="table-header-cell cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('nombre_usuario')}>
                Usuario <SortIcon k="nombre_usuario" />
              </th>
              <th className="table-header-cell cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('rol')}>
                Rol <SortIcon k="rol" />
              </th>
              <th className="table-header-cell cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('nivel_clasificacion')}>
                Acreditación <SortIcon k="nivel_clasificacion" />
              </th>
              <th className="table-header-cell">Estado</th>
              <th className="table-header-cell cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('fecha_creacion')}>
                Creado <SortIcon k="fecha_creacion" />
              </th>
              <th className="table-header-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-10">{search ? 'No se encontraron resultados' : 'Sin resultados'}</td></tr>
            ) : paginated.map((u, i) => (
              <tr key={u.id} className="table-row">
                <td className="table-cell text-slate-400 font-mono text-xs">{(safePage - 1) * perPage + i + 1}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {u.nombre_usuario.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-800">{u.nombre_usuario}</span>
                  </div>
                </td>
                <td className="table-cell">
                  <span className={rolBadge(u.rol?.nivel_numerico ?? 1)}>{u.rol?.nombre_rol ?? '—'}</span>
                </td>
                <td className="table-cell">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${clasificacionBadge(u.nivel_clasificacion?.nombre ?? '')}`}>
                    {u.nivel_clasificacion?.nombre ?? '—'}
                  </span>
                </td>
                <td className="table-cell">
                  <span className={u.activo ? 'badge-active' : 'badge-inactive'}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="table-cell text-slate-500">{formatDate(u.fecha_creacion)}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(u)} title="Editar" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-500 hover:bg-brand-50 transition-colors">
                      <PenLine className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onToggle(u)} title={u.activo ? 'Desactivar' : 'Activar'} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-status-pending hover:bg-status-pending-bg transition-colors">
                      {u.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => onDelete(u)} title="Eliminar" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-status-danger hover:bg-status-danger-bg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between mt-4 gap-2 text-sm text-slate-500">
        <span>Mostrando registros del {rangeStart} al {rangeEnd} de un total de {total} registros</span>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}
