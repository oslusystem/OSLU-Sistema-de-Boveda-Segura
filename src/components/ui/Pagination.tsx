'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page:         number
  totalPages:   number
  onPageChange: (page: number) => void
}

const MAX_VISIBLE = 5

type PageItem = number | 'ellipsis'

function getPageRange(current: number, total: number): PageItem[] {
  if (total <= MAX_VISIBLE + 2) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  let start = Math.max(1, current - Math.floor(MAX_VISIBLE / 2))
  let end   = start + MAX_VISIBLE - 1
  if (end > total) {
    end   = total
    start = end - MAX_VISIBLE + 1
  }

  const pages: PageItem[] = []
  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('ellipsis')
  }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total) {
    if (end < total - 1) pages.push('ellipsis')
    pages.push(total)
  }
  return pages
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const pages = getPageRange(page, Math.max(1, totalPages))

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex items-center gap-1 border border-slate-200 text-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Anterior
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex items-center gap-1 border border-slate-200 text-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Siguiente
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
