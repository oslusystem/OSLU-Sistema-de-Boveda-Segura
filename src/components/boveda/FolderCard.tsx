'use client'

import { useState } from 'react'
import { Folder, Info, Pencil, Trash2, X } from 'lucide-react'
import type { Proyecto } from '@/types'
import { clasificacionBadge } from '@/lib/utils'

interface FolderCardProps {
  proyecto: Proyecto
  canEdit?: boolean
  canDelete?: boolean
  onClick?:  (id: string) => void
  onEdit?:   (p: Proyecto) => void
  onDelete?: (p: Proyecto) => void
}

/*
  Tarjeta de proyecto / compartimento.
  Muestra nombre, nivel mínimo de clasificación (badge) y nº de archivos.
  Editar y eliminar son permisos independientes; aparecen al hover según corresponda.
  Si tiene descripción, un botón de info abre un modal con el texto completo.
*/
export default function FolderCard({ proyecto, canEdit, canDelete, onClick, onEdit, onDelete }: FolderCardProps) {
  const nivel = proyecto.nivel_clasificacion_minimo?.nombre ?? 'RESERVADO'
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
    <div
      onClick={() => onClick?.(proyecto.id)}
      className="group relative bg-white rounded-xl border border-slate-200 shadow-sm p-4
                 cursor-pointer hover:shadow-card-hover hover:border-slate-300
                 transition-all duration-150"
    >
      <div className="flex items-start justify-between mb-3">
        <Folder className="w-10 h-10 text-brand-500" style={{ fill: '#DBEAFE' }} />
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${clasificacionBadge(nivel)}`}>
          {nivel}
        </span>
      </div>

      <p className="font-semibold text-brand-600 text-sm truncate" title={proyecto.nombre_proyecto}>
        {proyecto.nombre_proyecto}
      </p>
      <p className="text-slate-400 text-xs mt-0.5">{proyecto._count?.archivos ?? 0} archivo(s)</p>

      {proyecto.descripcion && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowInfo(true) }}
          title="Ver descripción"
          className="absolute bottom-3 right-3 text-slate-300 hover:text-brand-500 transition-colors"
        >
          <Info className="w-4 h-4" />
        </button>
      )}

      {(canEdit || canDelete) && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(proyecto) }}
              title="Editar proyecto"
              className="w-7 h-7 rounded-lg bg-white/90 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-500 hover:bg-white transition-colors shadow-sm"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(proyecto) }}
              title="Eliminar proyecto"
              className="w-7 h-7 rounded-lg bg-white/90 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>

    {showInfo && proyecto.descripcion && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInfo(false)} />

        <div className="relative bg-surface-card rounded-2xl shadow-modal w-full max-w-sm animate-slide-up">
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="absolute top-3 right-3 btn-ghost w-8 h-8 p-0 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4 bg-brand-50 text-brand-500">
              <Info className="w-5 h-5" />
            </div>

            <h2 className="font-semibold text-slate-900 text-lg truncate" title={proyecto.nombre_proyecto}>
              {proyecto.nombre_proyecto}
            </h2>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
              {proyecto.descripcion}
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
