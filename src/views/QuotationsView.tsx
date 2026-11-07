import { FileStack, Plus, Printer, SquarePen, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import NumericInput from '../components/NumericInput'
import { useDemoData } from '../contexts/useDemoData'
import { calculateOrderTotals } from '../utils/orderTotals'
import type { Order } from '../types'

const todayISO = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const currentTimestamp = () => new Date().toISOString()
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 })
const pageSizeOptions = [10, 25, 50]

function createOrderId(dateISO: string, orders: Order[]) {
  const datePart = dateISO.replaceAll('-', '')
  let suffix = String(Date.now() % 10000).padStart(4, '0')
  let id = `${datePart}${suffix}`
  while (orders.some((order) => order.id === id)) {
    suffix = String((Number(suffix) + 1) % 10000).padStart(4, '0')
    id = `${datePart}${suffix}`
  }
  return id
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={checked} onClick={onChange} className="flex items-center gap-2 text-xs font-medium text-white">
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-lime-400' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full transition ${checked ? 'left-[18px] bg-slate-950' : 'left-0.5 bg-slate-200'}`} />
      </span>
      {children}
    </button>
  )
}

function QuotationsView() {
  const { orders, setOrders, clients, inventory } = useDemoData()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [reason, setReason] = useState('')
  const [mileage, setMileage] = useState('')
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [hidePrices, setHidePrices] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null)
  const navigate = useNavigate()
  const selectedClient = clients.find((client) => client.id === clientId)
  const availableClients = clients.filter((client) => client.vehicles.length > 0)
  const availableVehicles = selectedClient?.vehicles ?? []

  const savedQuotes = useMemo(
    () => orders
      .filter((order) => order.quoteSaved || Boolean(order.quoteNumber) || Boolean(order.quoteItems?.length))
      .filter((order) => !order.sourceQuoteId)
      .filter((order) => `${order.quoteNumber ?? order.id} ${order.id} ${order.customer} ${order.vehicle.plate}`.toLowerCase().includes(search.trim().toLowerCase())),
    [orders, search],
  )
  const pageCount = Math.max(1, Math.ceil(savedQuotes.length / pageSize))
  const visibleQuotes = savedQuotes.slice((page - 1) * pageSize, page * pageSize)

  const openCreateQuotation = () => {
    setClientId('')
    setVehicleId('')
    setReason('')
    setMileage('')
    setCreateOpen(true)
  }

  const createQuotation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedClient) return
    const vehicle = selectedClient.vehicles.find((candidate) => candidate.id === vehicleId)
    if (!vehicle) return

    const dateISO = todayISO()
    const date = new Date(`${dateISO}T12:00:00`)
    const id = createOrderId(dateISO, orders)
    const createdAt = currentTimestamp()
    const newOrder: Order = {
      id,
      status: 'Recepción',
      timestamps: { fechaIngreso: createdAt },
      invoiced: false,
      dateISO,
      date: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
      customer: selectedClient.name,
      email: selectedClient.email,
      phone: selectedClient.phone,
      mileage: Number(mileage),
      arrivalPhotos: [],
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate,
        vin: vehicle.vin,
      },
      reason: reason.trim(),
      technician: 'Por asignar',
      comments: '',
      quoteItems: [],
      quoteInitialized: true,
      quoteDiscountPercent: 0,
      quoteSaved: false,
      payments: [],
    }

    setOrders((current) => [newOrder, ...current])
    setCreateOpen(false)
    navigate(`/quotes/${id}`)
  }

  const removeQuote = (order: Order) => {
    setConfirmation({
      title: 'Eliminar cotización',
      message: `¿Deseas quitar la cotización #${order.quoteNumber ?? order.id}? Los datos de la orden de servicio se conservarán.`,
      confirmLabel: 'ELIMINAR COTIZACIÓN',
      onConfirm: () => {
        setOrders((current) => current.map((candidate) => candidate.id === order.id
          ? { ...candidate, quoteSaved: false, quoteNumber: undefined, quoteItems: [], quoteInitialized: true, quoteDiscountPercent: 0 }
          : candidate))
        setPage(1)
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-white">Cotizaciones</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={showItemDetails} onChange={() => setShowItemDetails((current) => !current)}>Detalles Ítems Compuestos</Toggle>
          <Toggle checked={hidePrices} onChange={() => setHidePrices((current) => !current)}>Ocultar Precios</Toggle>
          <button type="button" onClick={openCreateQuotation} aria-label="Nueva cotización" title="Nueva cotización" className="flex h-9 w-9 items-center justify-center rounded-full border border-lime-400 text-lime-400 transition hover:bg-lime-400 hover:text-black">
            <Plus size={19} />
          </button>
        </div>
        <ActionConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />
      </div>

      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-white">
              Mostrar
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-8 rounded-md border border-slate-700 bg-[#0B1120] px-2 text-xs text-white">
                {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              registros
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-white">
              Buscar:
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} className="h-9 w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 text-xs text-white outline-none focus:border-lime-400 sm:w-48" />
            </label>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead className="bg-slate-800/50 text-white">
                <tr>{['Cotización', 'ODS', 'Fecha', 'Cliente', 'Placa Vehículo', 'Valor', 'Opciones'].map((column) => <th key={column} className="border-b border-slate-700 px-3 py-3 font-bold">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleQuotes.map((order) => {
                  const total = calculateOrderTotals(order.quoteItems ?? [], order.quoteDiscountPercent ?? 0).total
                  return (
                    <tr key={order.id} className="text-slate-200 transition hover:bg-slate-800/50">
                      <td className="px-3 py-3 text-right">{order.quoteNumber ?? order.id}</td>
                      <td className="px-3 py-3">{order.id}</td>
                      <td className="px-3 py-3">{order.dateISO ?? order.date}</td>
                      <td className="px-3 py-3 text-white">{order.customer}</td>
                      <td className="px-3 py-3">{order.vehicle.plate || '(Sin Placa)'}</td>
                      <td className="px-3 py-3 text-right">{hidePrices ? '••••' : currency.format(total)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" title="Ver / editar cotización" aria-label={`Ver o editar cotización ${order.quoteNumber ?? order.id}`} onClick={() => navigate(`/quotes/${order.id}`)} className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400 text-sky-400 transition hover:bg-sky-400/15"><SquarePen size={14} /></button>
                          <button type="button" title="Imprimir cotización" aria-label={`Imprimir cotización ${order.quoteNumber ?? order.id}`} onClick={() => navigate(`/quotes/${order.id}?print=1`)} className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400 text-emerald-400 transition hover:bg-emerald-400/15"><Printer size={14} /></button>
                          <button type="button" title="Eliminar cotización" aria-label={`Eliminar cotización ${order.quoteNumber ?? order.id}`} onClick={() => removeQuote(order)} className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400 text-red-400 transition hover:bg-red-400/15"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!visibleQuotes.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No hay cotizaciones guardadas.</td></tr>}
              </tbody>
              {showItemDetails && visibleQuotes.length > 0 && <tfoot><tr><td colSpan={7} className="border-t border-slate-800 p-0">
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {visibleQuotes.map((order) => <div key={order.id} className="rounded-lg border border-slate-800 bg-[#0B1120] p-3">
                    <p className="mb-2 text-[10px] font-bold text-lime-400">#{order.quoteNumber ?? order.id} · {order.customer}</p>
                    {(order.quoteItems ?? []).length ? order.quoteItems?.map((item) => {
                      const inventoryItem = inventory.find((candidate) => candidate.reference === item.reference)
                      return <div key={item.id} className="py-1 text-[10px] text-slate-300">
                        <div className="flex justify-between gap-3">
                          <span>{item.description || item.type} · {item.quantity} un.</span>
                          {!hidePrices && <span>{currency.format(item.price * item.quantity)}</span>}
                        </div>
                        {inventoryItem?.components?.map((component) => {
                          const componentItem = inventory.find((candidate) => candidate.id === component.itemId)
                          return <p key={component.itemId} className="ml-3 mt-1 text-slate-400">↳ {componentItem?.description ?? component.itemId} × {component.quantity * item.quantity}</p>
                        })}
                      </div>
                    }) : <p className="text-[10px] text-slate-400">No hay ítems registrados.</p>}
                  </div>)}
                </div>
              </td></tr></tfoot>}
            </table>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white">
            <span>Mostrando {savedQuotes.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, savedQuotes.length)} de {savedQuotes.length} cotizaciones</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page === 1} onClick={() => setPage(1)} className="rounded px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:text-slate-600">Primero</button>
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:text-slate-600">Anterior</button>
              <span className="rounded bg-lime-400 px-3 py-1.5 font-bold text-black">{page}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:text-slate-600">Siguiente</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(pageCount)} className="rounded px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:text-slate-600">Último</button>
            </div>
          </div>
      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="create-quote-title">
        <form onSubmit={createQuotation} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-center justify-between"><h2 id="create-quote-title" className="text-base font-bold text-white">Crear cotización</h2><button type="button" aria-label="Cerrar" onClick={() => setCreateOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button></div>
          {availableClients.length > 0 ? <div className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Cliente</span><select required value={clientId} onChange={(event) => { setClientId(event.target.value); setVehicleId('') }} className="h-10 w-full rounded-lg border border-slate-700 bg-[#0B1120] px-3 text-xs text-white outline-none focus:border-lime-400"><option value="">Selecciona un cliente</option>{availableClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Vehículo</span><select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={!selectedClient} className="h-10 w-full rounded-lg border border-slate-700 bg-[#0B1120] px-3 text-xs text-white outline-none focus:border-lime-400 disabled:bg-slate-800"><option value="">Selecciona un vehículo</option>{availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} {vehicle.year} · {vehicle.plate}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Motivo / descripción</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Describe brevemente el servicio a cotizar" className="w-full resize-y rounded-lg border border-slate-700 bg-[#0B1120] px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Kilometraje actual</span><NumericInput required min="0" step="1" value={mileage} onChange={setMileage} placeholder="Ej. 28450" className="h-10 w-full rounded-lg border border-slate-700 bg-[#0B1120] px-3 text-xs text-white outline-none focus:border-lime-400" /></label>
          </div> : <p className="rounded-lg bg-amber-950/30 p-3 text-xs text-amber-200">Primero registra un cliente con al menos un vehículo para crear una cotización.</p>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancelar</button><button type="submit" disabled={!availableClients.length} className="flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"><FileStack size={14} /> Crear y agregar ítems</button></div>
        </form>
      </div>}
    </div>
  )
}

export default QuotationsView
