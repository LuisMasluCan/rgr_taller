type PageSizeSelectorProps = {
  pageSize: number
  onPageSizeChange: (pageSize: number) => void
}

type PaginationFooterProps = {
  page: number
  pageCount: number
  pageSize: number
  total: number
  recordLabel: string
  onPageChange: (page: number) => void
}

const pageSizeOptions = [10, 20, 50]

export function PageSizeSelector({ pageSize, onPageSizeChange }: PageSizeSelectorProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      Mostrar
      <select
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white"
      >
        {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
      registros
    </label>
  )
}

export function PaginationFooter({
  page,
  pageCount,
  pageSize,
  total,
  recordLabel,
  onPageChange,
}: PaginationFooterProps) {
  const firstRecord = total ? (page - 1) * pageSize + 1 : 0
  const lastRecord = Math.min(page * pageSize, total)
  const pages = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [
        1,
        ...(page > 3 ? ['ellipsis-start'] : []),
        ...Array.from({ length: Math.min(pageCount - 1, page + 1) - Math.max(2, page - 1) + 1 }, (_, index) => Math.max(2, page - 1) + index),
        ...(page < pageCount - 2 ? ['ellipsis-end'] : []),
        pageCount,
      ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-400 sm:px-5">
      <span>Mostrando {firstRecord}–{lastRecord} de {total} {recordLabel}</span>
      <nav className="flex flex-wrap items-center justify-end gap-1" aria-label="Paginación">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)} className="rounded px-2 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600">Primero</button>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded px-2 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600">Anterior</button>
        {pages.map((pageNumber) => typeof pageNumber === 'string'
          ? <span key={pageNumber} className="px-1" aria-hidden="true">…</span>
          : <button
              key={pageNumber}
              type="button"
              aria-current={pageNumber === page ? 'page' : undefined}
              onClick={() => onPageChange(pageNumber)}
              className={`min-w-8 rounded px-2.5 py-1.5 font-semibold ${pageNumber === page ? 'bg-lime-400 text-slate-950' : 'hover:bg-slate-800'}`}
            >
              {pageNumber}
            </button>)}
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded px-2 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600">Siguiente</button>
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} className="rounded px-2 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600">Último</button>
      </nav>
    </div>
  )
}
