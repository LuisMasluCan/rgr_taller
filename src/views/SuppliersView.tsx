import { Building2, Eye, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import { useDemoData } from '../contexts/useDemoData'
import type { Supplier } from '../types'

type SupplierDraft = Omit<Supplier, 'id'>
type ModalState = { mode: 'create' } | { mode: 'view' | 'edit'; supplier: Supplier } | null

const blankDraft = (type: Supplier['type'] = 'Empresa'): SupplierDraft => ({
  type,
  name: '',
  identification: '',
  email: '',
  phone: '',
  address: '',
  observations: '',
})
const pageSize = 5

function SuppliersView() {
  const { suppliers, setSuppliers } = useDemoData()
  const [type, setType] = useState<Supplier['type']>('Empresa')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>(null)
  const [draft, setDraft] = useState<SupplierDraft>(blankDraft())
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null)

  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) =>
    supplier.type === type &&
    `${supplier.name} ${supplier.identification} ${supplier.email} ${supplier.phone} ${supplier.address} ${supplier.observations ?? ''}`
      .toLocaleLowerCase('es-PE')
      .includes(search.trim().toLocaleLowerCase('es-PE')),
  ), [suppliers, type, search])
  const pageCount = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openCreate = () => {
    setDraft(blankDraft(type))
    setModal({ mode: 'create' })
  }

  const openEdit = (supplier: Supplier) => {
    const { id: _id, ...supplierDraft } = supplier
    setDraft(supplierDraft)
    setModal({ mode: 'edit', supplier })
  }

  const saveSupplier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (modal?.mode === 'edit') {
      setSuppliers((current) => current.map((supplier) =>
        supplier.id === modal.supplier.id ? { ...draft, id: supplier.id } : supplier,
      ))
    } else {
      setSuppliers((current) => [{ ...draft, id: `supplier-${Date.now()}` }, ...current])
      setPage(1)
    }
    setModal(null)
  }

  const deleteSupplier = (supplier: Supplier) => {
    setConfirmation({
      title: 'Eliminar proveedor',
      message: `¿Deseas eliminar a ${supplier.name} de la lista de proveedores? Esta acción no se puede deshacer.`,
      confirmLabel: 'ELIMINAR PROVEEDOR',
      onConfirm: () => setSuppliers((current) => current.filter((entry) => entry.id !== supplier.id)),
    })
  }

  const changeType = (nextType: Supplier['type']) => {
    setType(nextType)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-100">Proveedores</h2>
        </div>
        <button onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400">
          <Plus size={16} /> Crear proveedor
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
          <div className="inline-flex rounded-lg bg-slate-800 p-1" role="group" aria-label="Tipo de proveedor">
            {(['Empresa', 'Persona'] as const).map((option) => (
              <button
                key={option}
                aria-pressed={type === option}
                onClick={() => changeType(option)}
                className={`rounded-md px-4 py-2 text-xs font-semibold transition ${type === option ? 'bg-slate-900 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {option === 'Empresa' ? 'Empresas' : 'Personas'}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Buscar proveedor..."
              aria-label="Buscar proveedor"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-xs text-slate-300 outline-none transition placeholder:text-slate-400 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-4 py-3">Identificación (RUC/DNI)</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Celular</th>
                <th className="px-4 py-3">Dirección</th>
                <th className="px-4 py-3 text-center">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSuppliers.map((supplier) => (
                <tr key={supplier.id} className="text-xs text-slate-400 transition hover:bg-slate-900/70">
                  <td className="px-5 py-4 font-semibold text-slate-200">{supplier.name}</td>
                  <td className="px-4 py-4 tabular-nums">{supplier.identification}</td>
                  <td className="px-4 py-4">{supplier.email}</td>
                  <td className="px-4 py-4">{supplier.phone}</td>
                  <td className="px-4 py-4">{supplier.address}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <ActionButton label={`Ver ${supplier.name}`} onClick={() => setModal({ mode: 'view', supplier })}><Eye size={15} /></ActionButton>
                      <ActionButton label={`Editar ${supplier.name}`} onClick={() => openEdit(supplier)}><Pencil size={15} /></ActionButton>
                      <ActionButton label={`Eliminar ${supplier.name}`} onClick={() => deleteSupplier(supplier)} danger><Trash2 size={15} /></ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleSuppliers.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">No hay proveedores que coincidan con la búsqueda.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-3 text-[11px] text-slate-400">
          <span>{filteredSuppliers.length === 0 ? 'Sin resultados' : `Mostrando ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredSuppliers.length)} de ${filteredSuppliers.length} proveedores`}</span>
          <div className="flex items-center gap-2">
            <button disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-slate-700 px-3 py-1.5 font-semibold text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <span className="min-w-16 text-center">Página {currentPage} de {pageCount}</span>
            <button disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-slate-700 px-3 py-1.5 font-semibold text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title" className="w-full max-w-lg rounded-xl bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                {draft.type === 'Empresa' ? <Building2 size={18} className="text-lime-300" /> : <UserRound size={18} className="text-lime-300" />}
                <h3 id="supplier-modal-title" className="text-sm font-bold text-slate-100">
                  {modal.mode === 'create' ? 'Nuevo Proveedor' : modal.mode === 'edit' ? 'Editar Proveedor' : 'Detalle del Proveedor'}
                </h3>
              </div>
              <button aria-label="Cerrar modal" onClick={() => setModal(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-300"><X size={17} /></button>
            </div>
            <form onSubmit={saveSupplier} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={draft.type === 'Empresa' ? 'Razón Social' : 'Nombre completo'}>
                  <input required value={draft.name} readOnly={modal.mode === 'view'} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={draft.type === 'Empresa' ? 'Nombre de la empresa' : 'Nombres y apellidos'} className={inputClass} />
                </FormField>
                <FormField label={draft.type === 'Empresa' ? 'RUC' : 'DNI'}>
                  <input required value={draft.identification} readOnly={modal.mode === 'view'} onChange={(event) => setDraft({ ...draft, identification: event.target.value })} placeholder={draft.type === 'Empresa' ? '20123456789' : '12345678'} className={inputClass} />
                </FormField>
                <FormField label="Email">
                  <input required type="email" value={draft.email} readOnly={modal.mode === 'view'} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="correo@empresa.com" className={inputClass} />
                </FormField>
                <FormField label="Celular">
                  <input required type="tel" value={draft.phone} readOnly={modal.mode === 'view'} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+51 999 999 999" className={inputClass} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Dirección">
                    <input required value={draft.address} readOnly={modal.mode === 'view'} onChange={(event) => setDraft({ ...draft, address: event.target.value })} placeholder="Dirección fiscal" className={inputClass} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Observaciones">
                    <textarea
                      rows={3}
                      value={draft.observations ?? ''}
                      readOnly={modal.mode === 'view'}
                      onChange={(event) => setDraft({ ...draft, observations: event.target.value })}
                      placeholder="Notas, condiciones de pago, horarios u otra información del proveedor"
                      className={`${inputClass} h-auto resize-y py-2.5`}
                    />
                  </FormField>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">{modal.mode === 'view' ? 'Cerrar' : 'Cancelar'}</button>
                {modal.mode !== 'view' && <button type="submit" className="rounded-lg bg-lime-300 px-5 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-lime-400">Guardar</button>}
              </div>
            </form>
          </section>
        </div>
      )}
      <ActionConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-700 px-3 text-xs text-slate-300 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30 read-only:bg-slate-800'

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold text-slate-400">{label}{children}</label>
}

function ActionButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button aria-label={label} onClick={onClick} className={`rounded-md p-2 transition ${danger ? 'text-rose-500 hover:bg-rose-950/30 hover:text-rose-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{children}</button>
}

export default SuppliersView
