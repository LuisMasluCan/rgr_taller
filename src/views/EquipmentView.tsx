import { ClipboardList, DollarSign, FileText, List, Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import NumericInput from '../components/NumericInput'
import { PageSizeSelector, PaginationFooter } from '../components/TablePagination'
import { useDemoData } from '../contexts/useDemoData'
import type { WorkshopAsset } from '../types'

type AssetDraft = Omit<WorkshopAsset, 'id' | 'value' | 'quantity'> & {
  value: string
  quantity: string
}

const emptyDraft = (): AssetDraft => ({
  name: '',
  reference: '',
  description: '',
  value: '',
  quantity: '1',
  observations: '',
})

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
})

function EquipmentView() {
  const { workshopAssets, setWorkshopAssets } = useDemoData()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AssetDraft>(emptyDraft)
  const [formError, setFormError] = useState('')
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null)

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-PE')
    if (!query) return workshopAssets
    return workshopAssets.filter((asset) =>
      `${asset.name} ${asset.reference} ${asset.description} ${asset.observations}`.toLocaleLowerCase('es-PE').includes(query),
    )
  }, [search, workshopAssets])
  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleAssets = filteredAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const investedCapital = workshopAssets.reduce((total, asset) => total + asset.value * asset.quantity, 0)

  const openNewAsset = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setFormError('')
    setModalOpen(true)
  }

  const openEditAsset = (asset: WorkshopAsset) => {
    setEditingId(asset.id)
    setDraft({
      name: asset.name,
      reference: asset.reference,
      description: asset.description,
      value: String(asset.value),
      quantity: String(asset.quantity),
      observations: asset.observations,
    })
    setFormError('')
    setModalOpen(true)
  }

  const saveAsset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(draft.value)
    const quantity = Number(draft.quantity)
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(quantity) || quantity < 1) {
      setFormError('Ingresa un valor válido y una cantidad entera mayor que cero.')
      return
    }

    const asset: WorkshopAsset = {
      id: editingId ?? `asset-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      reference: draft.reference.trim(),
      description: draft.description.trim(),
      value,
      quantity,
      observations: draft.observations.trim(),
    }

    setWorkshopAssets((current) => editingId
      ? current.map((existing) => existing.id === editingId ? asset : existing)
      : [asset, ...current])
    if (!editingId) setPage(1)
    setModalOpen(false)
  }

  const deleteAsset = (asset: WorkshopAsset) => {
    setConfirmation({
      title: 'Eliminar herramienta o equipo',
      message: `¿Deseas eliminar el registro "${asset.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'ELIMINAR REGISTRO',
      onConfirm: () => setWorkshopAssets((current) => current.filter((entry) => entry.id !== asset.id)),
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/25 bg-lime-400/10 text-lime-300">
            <Wrench size={21} />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">Planta y Equipo</h1>
            <p className="mt-1 text-xs text-slate-400">Herramientas y activos fijos del taller</p>
          </div>
        </div>
        <button type="button" onClick={openNewAsset} className="flex h-10 w-fit items-center gap-2 rounded-lg bg-lime-400 px-4 text-xs font-extrabold text-black shadow-sm transition hover:bg-lime-300">
          <Plus size={16} /> + NUEVO REGISTRO
        </button>
      </header>

      <section className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-300">
          <DollarSign size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Capital invertido total</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-white">{currency.format(investedCapital)}</p>
          <p className="mt-1 text-[10px] text-slate-500">Valor de compra por unidad multiplicado por la cantidad registrada</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Herramientas registradas</h2>
            <p className="mt-1 text-[11px] text-slate-400">{workshopAssets.length} activos fijos · No se incluyen en el inventario de venta</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PageSizeSelector pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
            <label className="relative block w-full sm:max-w-[300px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} type="search" placeholder="Buscar nombre o referencia..." className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-lime-400" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-slate-950/60 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Nombre de la herramienta</th>
                <th className="px-4 py-3.5">Referencia</th>
                <th className="px-4 py-3.5">Descripción</th>
                <th className="px-4 py-3.5">Valor</th>
                <th className="px-4 py-3.5">Cantidad</th>
                <th className="px-4 py-3.5">Observaciones</th>
                <th className="px-4 py-3.5 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleAssets.map((asset) => (
                <tr key={asset.id} className="text-xs text-slate-400 transition hover:bg-slate-800/40">
                  <td className="px-5 py-4 font-semibold text-slate-100">{asset.name}</td>
                  <td className="px-4 py-4 font-mono text-[10px] text-lime-200">{asset.reference || '—'}</td>
                  <td className="max-w-[240px] whitespace-normal px-4 py-4">{asset.description || '—'}</td>
                  <td className="px-4 py-4 font-semibold text-slate-200">{currency.format(asset.value)}</td>
                  <td className="px-4 py-4">{asset.quantity}</td>
                  <td className="max-w-[220px] whitespace-normal px-4 py-4">{asset.observations || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Editar ${asset.name}`} onClick={() => openEditAsset(asset)} className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-300 transition hover:bg-violet-950/40"><Pencil size={14} /></button>
                      <button type="button" aria-label={`Eliminar ${asset.name}`} onClick={() => deleteAsset(asset)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-300 transition hover:bg-red-950/40"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-slate-400">{search ? 'No hay herramientas que coincidan con la búsqueda.' : 'Aún no se registran herramientas o equipos.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter page={currentPage} pageCount={pageCount} pageSize={pageSize} total={filteredAssets.length} recordLabel="registros" onPageChange={setPage} />
      </section>

      {modalOpen && (
        <Modal title={editingId ? 'Editar herramienta' : 'Nuevo Registro'} onClose={() => setModalOpen(false)}>
          <form onSubmit={saveAsset} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <AssetField label="Nombre de la herramienta" required icon={<Wrench size={15} />}>
                <input autoFocus required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Escáner Automotriz Launch" className={inputClass} />
              </AssetField>
              <AssetField label="Referencia de la herramienta" required icon={<List size={15} />}>
                <input required value={draft.reference} onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))} placeholder="Ej. LAUNCH-X431" className={inputClass} />
              </AssetField>
              <AssetField label="Descripción de la herramienta" icon={<FileText size={15} />}>
                <input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción del equipo" className={inputClass} />
              </AssetField>
              <AssetField label="Valor de la herramienta" required icon={<DollarSign size={15} />}>
                <NumericInput required min="0" step="0.01" value={draft.value} onChange={(value) => setDraft((current) => ({ ...current, value }))} placeholder="1500.00" className={inputClass} />
              </AssetField>
              <AssetField label="Cantidad existente" required icon={<ClipboardList size={15} />}>
                <NumericInput required min="1" step="1" value={draft.quantity} onChange={(value) => setDraft((current) => ({ ...current, quantity: value }))} placeholder="1" className={inputClass} />
              </AssetField>
              <AssetField label="Observaciones" icon={<FileText size={15} />} wide>
                <textarea rows={3} value={draft.observations} onChange={(event) => setDraft((current) => ({ ...current, observations: event.target.value }))} placeholder="Estado, mantenimiento u otras notas..." className={`${inputClass} h-auto min-h-20 resize-y py-2.5`} />
              </AssetField>
            </div>
            {formError && <p role="alert" className="text-xs font-medium text-red-300">{formError}</p>}
            <footer className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-violet-600">SALIR</button>
              <button type="submit" className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black transition hover:bg-lime-300">GUARDAR</button>
            </footer>
          </form>
        </Modal>
      )}
      <ActionConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-lime-400'

function AssetField({ label, required, icon, wide, children }: { label: string; required?: boolean; icon: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}{required && <span className="ml-1 text-lime-300">*</span>}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        <span className="block [&>input]:pl-9 [&>textarea]:pl-9">{children}</span>
      </span>
    </label>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <header className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
          <div><h2 className="text-base font-bold text-white">{title}</h2><p className="mt-1 text-[10px] text-slate-500">Registro de activos fijos del taller</p></div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

export default EquipmentView
