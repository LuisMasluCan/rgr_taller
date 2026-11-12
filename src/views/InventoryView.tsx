import { Boxes, Package, Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import NumericInput from '../components/NumericInput'
import { useLocation } from 'react-router-dom'
import { PageSizeSelector, PaginationFooter } from '../components/TablePagination'
import { useDemoData } from '../contexts/useDemoData'
import { getLaborSuggestedPrice, laborConfig, type LaborComplexity } from '../data/laborConfig'
import type { InventoryItem } from '../types'

type InventoryType = NonNullable<InventoryItem['type']>
type ComponentDraft = { itemId: string; quantity: string }
type InventoryDraft = {
  id: string
  description: string
  reference: string
  type: InventoryType
  specialty: string
  category: string
  brand: string
  unit: string
  cost: string
  marginPercent: string
  price: string
  taxRate: string
  stock: string
  location: string
  details: string
  laborHours: string
  complexity: LaborComplexity
  components: ComponentDraft[]
}

const emptyDraft = (): InventoryDraft => ({
  id: '',
  description: '',
  reference: '',
  type: 'Repuesto',
  specialty: '',
  category: '',
  brand: '',
  unit: 'Unidad (und)',
  cost: '0',
  marginPercent: '35',
  price: '0',
  taxRate: String(laborConfig.taxRate),
  stock: '0',
  location: '',
  details: '',
  laborHours: '1',
  complexity: 'A',
  components: [],
})

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const inputClass = 'h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-300 outline-none placeholder:text-slate-400 focus:border-slate-700'
const inventoryTypes: InventoryType[] = ['Mano de Obra', 'Repuesto', 'Insumo', 'Servicio Compuesto']

function InventoryView() {
  const { inventory, setInventory, settings } = useDemoData()
  const location = useLocation()
  const currentSection = location.pathname.endsWith('/equipment')
    ? 'equipment'
    : location.pathname.endsWith('/categories')
      ? 'categories'
      : 'items'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<InventoryDraft>(emptyDraft)
  const [formError, setFormError] = useState('')

  const filteredItems = useMemo(
    () => inventory.filter((item) =>
      `${item.id} ${item.description} ${item.reference} ${item.brand ?? ''}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [inventory, search],
  )

  const lowStock = inventory.filter((item) =>
    item.type !== 'Mano de Obra' && item.type !== 'Servicio Compuesto' &&
    !((!item.type && item.id.startsWith('SRV'))) && item.stock < settings.lowStockThreshold,
  ).length

  const setDraftPrice = (next: InventoryDraft) => {
    const cost = next.type === 'Servicio Compuesto'
      ? next.components.reduce((total, component) => {
          const item = inventory.find((entry) => entry.id === component.itemId)
          return total + (item?.cost ?? 0) * (Number(component.quantity) || 0)
        }, 0)
      : Number(next.cost) || 0
    const price = next.type === 'Mano de Obra'
      ? getLaborSuggestedPrice(Number(next.laborHours) || 0, next.complexity)
      : cost * (1 + (Number(next.marginPercent) || 0) / 100)
    setDraft({
      ...next,
      cost: next.type === 'Servicio Compuesto' ? cost.toFixed(2) : next.cost,
      price: price.toFixed(2),
    })
  }

  const openNewItem = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setFormError('')
    setModalOpen(true)
  }

  const openEditItem = (item: InventoryItem) => {
    setEditingId(item.id)
    setDraft({
      ...emptyDraft(),
      id: item.id,
      description: item.description,
      reference: item.reference,
      type: item.type ?? (item.id.startsWith('SRV') ? 'Mano de Obra' : item.id.startsWith('INS') ? 'Insumo' : 'Repuesto'),
      specialty: item.specialty ?? '',
      category: item.category ?? '',
      brand: item.brand ?? '',
      unit: item.unit ?? 'Unidad (und)',
      cost: String(item.cost),
      marginPercent: String(item.marginPercent ?? 0),
      price: String(item.price),
      taxRate: String(item.taxRate),
      stock: String(item.stock),
      location: item.location ?? '',
      details: item.details ?? '',
      laborHours: String(item.laborHours ?? 1),
      complexity: item.complexity ?? 'A',
      components: item.components?.map((component) => ({ itemId: component.itemId, quantity: String(component.quantity) })) ?? [],
    })
    setFormError('')
    setModalOpen(true)
  }

  const saveItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = editingId ?? draft.id.trim().toUpperCase()
    const duplicate = inventory.some((item) => item.id === id && item.id !== editingId)
    if (duplicate) {
      setFormError('Ya existe un ítem con este código. Usa un código diferente.')
      return
    }

    const item: InventoryItem = {
      id,
      description: draft.description.trim(),
      reference: draft.reference.trim().toUpperCase() || id,
      type: draft.type,
      specialty: draft.specialty.trim(),
      category: draft.category.trim(),
      brand: draft.brand.trim(),
      unit: draft.unit.trim(),
      cost: Math.max(0, Number(draft.cost) || 0),
      marginPercent: Math.max(0, Number(draft.marginPercent) || 0),
      price: Math.max(0, Number(draft.price) || 0),
      taxRate: Number(draft.taxRate),
      stock: draft.type === 'Mano de Obra' || draft.type === 'Servicio Compuesto' ? 999 : Math.max(0, Number(draft.stock) || 0),
      location: draft.location.trim(),
      details: draft.details.trim(),
      laborHours: draft.type === 'Mano de Obra' ? Math.max(0, Number(draft.laborHours) || 0) : undefined,
      complexity: draft.type === 'Mano de Obra' ? draft.complexity : undefined,
      components: draft.type === 'Servicio Compuesto'
        ? draft.components.filter((component) => component.itemId).map((component) => ({ itemId: component.itemId, quantity: Math.max(1, Number(component.quantity) || 1) }))
        : undefined,
    }

    setInventory((current) => editingId
      ? current.map((existing) => existing.id === editingId ? item : existing)
      : [item, ...current])
    if (!editingId) setPage(1)
    setModalOpen(false)
  }

  const deleteItem = (id: string) => setInventory((current) => current.filter((item) => item.id !== id))

  if (currentSection !== 'items') {
    const label = currentSection === 'equipment' ? 'Planta y equipo' : 'Categorías'
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center shadow-lg">
        <Boxes size={25} className="mx-auto text-slate-400" />
        <h2 className="mt-3 text-base font-bold text-slate-100">{label}</h2>
        <p className="mt-2 text-xs text-slate-400">Esta sección estará disponible próximamente en la demo.</p>
      </section>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const visibleCount = filteredItems.length

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-900/40 text-orange-300"><Boxes size={14} /></span>
            <span><strong className="font-semibold text-slate-300">{inventory.length} ítems</strong> en catálogo</span>
            <span className="mx-1 h-1 w-1 rounded-full bg-slate-600" /><span>{lowStock} con stock bajo</span>
          </div>
        </div>
        <button type="button" onClick={openNewItem} className="flex h-10 w-fit items-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400"><Plus size={16} /> + NUEVO REGISTRO</button>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ítems en catálogo" value={String(inventory.length)} icon={<Package size={17} />} />
        <StatCard label="Unidades disponibles" value={inventory.filter((item) => item.type !== 'Mano de Obra' && item.type !== 'Servicio Compuesto' && !(item.id.startsWith('SRV') && !item.type)).reduce((total, item) => total + item.stock, 0).toLocaleString('es-PE')} icon={<Boxes size={17} />} />
        <StatCard label="Stock bajo" value={String(lowStock)} icon={<Wrench size={17} />} warning={lowStock > 0} />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-100">Ítem de venta</h2><p className="mt-0.5 text-[11px] text-slate-400">Repuestos, insumos y servicios que pueden agregarse a órdenes y facturas.</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <PageSizeSelector pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
            <label className="relative w-full sm:max-w-[280px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} type="search" placeholder="Buscar descripción o referencia..." className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" /></label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="bg-slate-900 text-[9px] font-bold uppercase tracking-wider text-white"><tr><th className="px-5 py-3.5">Ítem</th><th className="px-4 py-3.5">Tipo</th><th className="px-4 py-3.5">Código</th><th className="px-4 py-3.5">Costo</th><th className="px-4 py-3.5">Precio venta</th><th className="px-4 py-3.5">Impuesto</th><th className="px-4 py-3.5">Stock</th><th className="px-4 py-3.5 text-right">Opciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map((item) => {
                const itemType = item.type ?? (item.id.startsWith('SRV') ? 'Mano de Obra' : item.id.startsWith('INS') ? 'Insumo' : 'Repuesto')
                const service = itemType === 'Mano de Obra' || itemType === 'Servicio Compuesto'
                return (
                  <tr key={item.id} className="text-xs text-slate-400 hover:bg-slate-900/70">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${service ? 'bg-violet-950/30 text-violet-300' : 'bg-orange-950/30 text-orange-300'}`}>{service ? <Wrench size={16} /> : <Package size={16} />}</div><div><p className="font-semibold text-slate-200">{item.description}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.reference}</p></div></div></td>
                    <td className="px-4 py-4">{itemType}</td><td className="px-4 py-4 font-mono text-[10px] text-slate-400">{item.id}</td>
                    <td className="px-4 py-4">{currency.format(item.cost)}</td><td className="px-4 py-4 font-semibold text-slate-200">{currency.format(item.price)}</td><td className="px-4 py-4">{item.taxRate === 0 ? 'Sin impuesto' : `IGV ${item.taxRate}%`}</td>
                    <td className="px-4 py-4">{service ? <span className="text-slate-400">No aplica</span> : <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.stock < settings.lowStockThreshold ? 'bg-orange-950/30 text-orange-200' : 'bg-emerald-950/30 text-emerald-300'}`}>{item.stock} un.</span>}</td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-1"><button type="button" aria-label={`Editar ${item.description}`} onClick={() => openEditItem(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-300 hover:bg-violet-950/30"><Pencil size={14} /></button><button type="button" aria-label={`Eliminar ${item.description}`} onClick={() => deleteItem(item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-950/30"><Trash2 size={14} /></button></div></td>
                  </tr>
                )
              })}
              {!visibleCount && <tr><td colSpan={8} className="px-5 py-12 text-center text-xs text-slate-400">No hay ítems que coincidan con la búsqueda.</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginationFooter page={currentPage} pageCount={pageCount} pageSize={pageSize} total={filteredItems.length} recordLabel="ítems" onPageChange={setPage} />
      </section>

      {modalOpen && (
        <Modal title={editingId ? 'Editar registro' : 'Nuevo Registro'} onClose={() => setModalOpen(false)}>
          <form onSubmit={saveItem} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de ítem" required><select required value={draft.type} onChange={(event) => {
                const type = inventoryTypes.find((option) => option === event.target.value)
                if (type) setDraftPrice({ ...draft, type, taxRate: type === 'Mano de Obra' ? String(laborConfig.taxRate) : draft.taxRate })
              }} className={inputClass}>{inventoryTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
              <Field label="Código" required><input required name="inventory-id" disabled={Boolean(editingId)} value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} placeholder={draft.type === 'Mano de Obra' ? 'SRV-HH-001' : 'REP-005'} className={`${inputClass} disabled:bg-slate-800`} /></Field>
              <Field label="Nombre del ítem" required><input required autoFocus value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Nombre del ítem" className={inputClass} /></Field>
              <Field label="Referencia"><input value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="Referencia" className={inputClass} /></Field>
              <Field label="Especialidad"><input value={draft.specialty} onChange={(event) => setDraft({ ...draft, specialty: event.target.value })} placeholder="Ej. Mecánica general" className={inputClass} /></Field>
              <Field label="Categoría"><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Ej. Servicio de motor" className={inputClass} /></Field>
              <Field label="Marca"><input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} placeholder="Marca" className={inputClass} /></Field>
              <Field label="Unidad de medida"><select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} className={inputClass}><option>Unidad (und)</option><option>Hora Hombre (h)</option><option>Litro (L)</option><option>Servicio (srv)</option><option>Juego (jgo)</option></select></Field>

              {draft.type === 'Mano de Obra' && <>
                <Field label="Tiempo estimado (horas)" required><NumericInput required min="0.1" step="0.1" value={draft.laborHours} onChange={(value) => setDraftPrice({ ...draft, laborHours: value })} className={inputClass} /></Field>
                <Field label="Factor de complejidad"><select value={draft.complexity} onChange={(event) => {
                  const complexity = event.target.value
                  if (complexity === 'A' || complexity === 'B' || complexity === 'C') setDraftPrice({ ...draft, complexity })
                }} className={inputClass}><option value="A">A · Estándar (×1.00)</option><option value="B">B · Media (×1.15)</option><option value="C">C · Alta (×1.30)</option></select></Field>
                <p className="sm:col-span-2 rounded-lg bg-violet-950/30 px-3 py-2 text-[10px] font-medium text-violet-100">Precio sugerido: {draft.laborHours || 0} h × {currency.format(laborConfig.hourlySaleRate)} × factor {laborConfig.complexityFactors[draft.complexity]}.</p>
              </>}

              {draft.type === 'Servicio Compuesto' && (
                <div className="sm:col-span-2 rounded-lg border border-slate-700 p-3">
                  <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase text-slate-400">Componentes del servicio</p><button type="button" onClick={() => setDraft((current) => ({ ...current, components: [...current.components, { itemId: '', quantity: '1' }] }))} className="flex items-center gap-1 text-[10px] font-bold text-emerald-300"><Plus size={13} /> Agregar componente</button></div>
                  <div className="space-y-2">{draft.components.map((component, index) => <div key={`component-${index}`} className="flex gap-2"><select aria-label={`Componente ${index + 1}`} value={component.itemId} onChange={(event) => setDraftPrice({ ...draft, components: draft.components.map((entry, componentIndex) => componentIndex === index ? { ...entry, itemId: event.target.value } : entry) })} className={inputClass}><option value="">Selecciona un componente</option>{inventory.filter((item) => item.id !== editingId).map((item) => <option key={item.id} value={item.id}>{item.description} · {item.reference}</option>)}</select><NumericInput aria-label={`Cantidad del componente ${index + 1}`} min="1" value={component.quantity} onChange={(value) => setDraftPrice({ ...draft, components: draft.components.map((entry, componentIndex) => componentIndex === index ? { ...entry, quantity: value } : entry) })} className={`${inputClass} max-w-24`} /><button type="button" aria-label="Quitar componente" onClick={() => setDraftPrice({ ...draft, components: draft.components.filter((_, componentIndex) => componentIndex !== index) })} className="px-2 text-slate-400 hover:text-rose-300"><X size={15} /></button></div>)}</div>
                </div>
              )}

              <Field label="Costo (sin impuesto)"><NumericInput min="0" step="0.01" value={draft.cost} readOnly={draft.type === 'Servicio Compuesto'} onChange={(value) => setDraftPrice({ ...draft, cost: value })} className={`${inputClass} ${draft.type === 'Servicio Compuesto' ? 'bg-slate-800' : ''}`} /></Field>
              <Field label="Rentabilidad (%)"><NumericInput min="0" step="0.1" value={draft.marginPercent} disabled={draft.type === 'Mano de Obra'} onChange={(value) => setDraftPrice({ ...draft, marginPercent: value })} className={`${inputClass} disabled:bg-slate-800`} /></Field>
              <Field label="Precio de venta (sin impuesto)" required><NumericInput required min="0" step="0.01" value={draft.price} readOnly={draft.type === 'Mano de Obra'} onChange={(value) => setDraft({ ...draft, price: value })} className={`${inputClass} ${draft.type === 'Mano de Obra' ? 'bg-slate-800' : ''}`} /></Field>
              <Field label="Impuesto"><select value={draft.taxRate} onChange={(event) => setDraft({ ...draft, taxRate: event.target.value })} className={inputClass}><option value="0">Sin impuesto</option><option value="18">IGV 18%</option></select></Field>
              <Field label="Precio de venta final" required><NumericInput required min="0" step="0.01" value={((Number(draft.price) || 0) * (1 + (Number(draft.taxRate) || 0) / 100)).toFixed(2)} onChange={(value) => setDraft({ ...draft, price: value === '' ? '' : String(Number(value) / (1 + (Number(draft.taxRate) || 0) / 100)) })} className={`${inputClass} font-bold`} /></Field>
              {draft.type !== 'Mano de Obra' && draft.type !== 'Servicio Compuesto' && <Field label="Stock disponible"><NumericInput min="0" step="1" value={draft.stock} onChange={(value) => setDraft({ ...draft, stock: value })} className={inputClass} /></Field>}
              <Field label="Ubicación"><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Ej. Almacén A · Estante 2" className={inputClass} /></Field>
              <Field label="Descripción"><textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Descripción adicional" rows={2} className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs outline-none focus:border-slate-700" /></Field>
            </div>
            {formError && <p role="alert" className="text-xs font-medium text-rose-300">{formError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancelar</button><button type="submit" className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400">{editingId ? 'Guardar cambios' : 'Crear registro'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, warning = false }: { label: string; value: string; icon: ReactNode; warning?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg"><div className={`flex h-10 w-10 items-center justify-center rounded-lg ${warning ? 'bg-orange-950/30 text-orange-300' : 'bg-slate-800 text-slate-400'}`}>{icon}</div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-0.5 text-lg font-extrabold ${warning ? 'text-orange-300' : 'text-slate-100'}`}>{value}</p></div></div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>{children}</label>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="my-auto w-full max-w-3xl rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-slate-100">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button></div>{children}</div></div>
}

export default InventoryView
