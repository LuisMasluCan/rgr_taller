import { FileStack, Plus, Printer, Search, SquarePen, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import NumericInput from '../components/NumericInput'
import { PageSizeSelector, PaginationFooter } from '../components/TablePagination'
import { useDemoData } from '../contexts/useDemoData'
import { calculateOrderTotals } from '../utils/orderTotals'
import type { Order, Quotation } from '../types'

const todayISO = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 })
type QuoteRow = {
  id: string
  quoteNumber: string
  date: string
  customer: string
  plate: string
  items: Order['quoteItems']
  discount: number
  status: string
  serviceOrderId?: string
  legacyOrder?: Order
}

function quoteStatusLabel(status: Quotation['status']): string {
  return {
    DRAFT: 'Borrador',
    SENT: 'Emitida',
    APPROVED: 'Aceptada',
    REJECTED: 'Rechazada',
    EXPIRED: 'Vencida',
  }[status]
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
  const { orders, setOrders, quotations, setQuotations, clients, inventory } = useDemoData()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
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
  const clientSuggestions = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    if (!query || selectedClient) return []
    return availableClients.filter((client) =>
      `${client.name} ${client.vehicles.map((vehicle) => vehicle.plate).join(' ')}`
        .toLowerCase()
        .includes(query),
    )
  }, [availableClients, clientSearch, selectedClient])

  const savedQuotes = useMemo(() => {
    const newQuotes: QuoteRow[] = quotations.map((quote) => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      date: quote.dateISO,
      customer: quote.customer,
      plate: quote.vehicle.plate,
      items: quote.quoteItems,
      discount: quote.quoteDiscountPercent,
      status: quoteStatusLabel(quote.status),
      serviceOrderId: quote.serviceOrderId,
    }))
    const legacyQuotes: QuoteRow[] = orders
      .filter((order) => (order.quoteSaved || Boolean(order.quoteNumber) || Boolean(order.quoteItems?.length)) && !order.sourceQuoteId)
      .map((order) => ({
        id: order.id,
        quoteNumber: order.quoteNumber ?? order.id,
        date: order.dateISO ?? order.date,
        customer: order.customer,
        plate: order.vehicle.plate,
        items: order.quoteItems,
        discount: order.quoteDiscountPercent ?? 0,
        status: order.quoteSaved ? 'Emitida (registro anterior)' : 'Registro anterior',
        serviceOrderId: order.convertedToOrderId ?? order.id,
        legacyOrder: order,
      }))
    const query = search.trim().toLowerCase()
    return [...newQuotes, ...legacyQuotes]
      .filter((quote) => `${quote.quoteNumber} ${quote.id} ${quote.customer} ${quote.plate}`.toLowerCase().includes(query))
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [orders, quotations, search])
  const pageCount = Math.max(1, Math.ceil(savedQuotes.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleQuotes = savedQuotes.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openCreateQuotation = () => {
    setClientId('')
    setClientSearch('')
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
    const quoteNumber = String(Math.max(
      616,
      ...quotations.map((quote) => Number(quote.quoteNumber) || 0),
      ...orders.map((order) => Number(order.quoteNumber) || 0),
    ) + 1)
    const quotation: Quotation = {
      id: crypto.randomUUID(),
      quoteNumber,
      status: 'DRAFT',
      date: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
      dateISO,
      customerId: selectedClient.id,
      vehicleId: vehicle.id,
      customer: selectedClient.name,
      email: selectedClient.email,
      phone: selectedClient.phone,
      mileage: Number(mileage),
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate,
        vin: vehicle.vin,
      },
      reason: reason.trim(),
      quoteItems: [],
      quoteDiscountPercent: 0,
    }

    setQuotations((current) => [quotation, ...current])
    setCreateOpen(false)
    navigate(`/quotes/${quotation.id}`)
  }

  const removeQuote = (quote: QuoteRow) => {
    if (quote.serviceOrderId && !quote.legacyOrder) return
    setConfirmation({
      title: 'Eliminar cotización',
      message: `¿Deseas quitar la cotización #${quote.quoteNumber}?`,
      confirmLabel: 'ELIMINAR COTIZACIÓN',
      onConfirm: () => {
        if (quote.legacyOrder) {
          setOrders((current) => current.map((candidate) => candidate.id === quote.id
            ? { ...candidate, quoteSaved: false, quoteNumber: undefined, quoteItems: [], quoteInitialized: true, quoteDiscountPercent: 0 }
            : candidate))
        } else {
          setQuotations((current) => current.filter((candidate) => candidate.id !== quote.id))
        }
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
            <PageSizeSelector pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
            <label className="flex items-center gap-2 text-xs font-semibold text-white">
              Buscar:
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} className="h-9 w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 text-xs text-white outline-none focus:border-lime-400 sm:w-48" />
            </label>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead className="bg-slate-800/50 text-white">
                <tr>{['Cotización', 'ODS', 'Fecha', 'Cliente', 'Placa Vehículo', 'Valor', 'Estado', 'Opciones'].map((column) => <th key={column} className="border-b border-slate-700 px-3 py-3 font-bold">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleQuotes.map((quote) => {
                  const total = calculateOrderTotals(quote.items ?? [], quote.discount).total
                  return (
                    <tr key={quote.id} className="text-slate-200 transition hover:bg-slate-800/50">
                      <td className="px-3 py-3 text-right">{quote.quoteNumber}</td>
                      <td className="px-3 py-3">{quote.serviceOrderId ?? '—'}</td>
                      <td className="px-3 py-3">{quote.date}</td>
                      <td className="px-3 py-3 text-white">{quote.customer}</td>
                      <td className="px-3 py-3">{quote.plate || '(Sin Placa)'}</td>
                      <td className="px-3 py-3 text-right">{hidePrices ? '••••' : currency.format(total)}</td>
                      <td className="px-3 py-3">{quote.status}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" title="Ver / editar cotización" aria-label={`Ver o editar cotización ${quote.quoteNumber}`} onClick={() => navigate(`/quotes/${quote.id}`)} className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400 text-sky-400 transition hover:bg-sky-400/15"><SquarePen size={14} /></button>
                          <button type="button" title="Imprimir cotización" aria-label={`Imprimir cotización ${quote.quoteNumber}`} onClick={() => navigate(`/quotes/${quote.id}?print=1`)} className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400 text-emerald-400 transition hover:bg-emerald-400/15"><Printer size={14} /></button>
                          <button type="button" title={quote.serviceOrderId && !quote.legacyOrder ? 'No se puede eliminar una cotización convertida en ODS' : 'Eliminar cotización'} aria-label={`Eliminar cotización ${quote.quoteNumber}`} disabled={Boolean(quote.serviceOrderId && !quote.legacyOrder)} onClick={() => removeQuote(quote)} className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400 text-red-400 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!visibleQuotes.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No hay cotizaciones guardadas.</td></tr>}
              </tbody>
              {showItemDetails && visibleQuotes.length > 0 && <tfoot><tr><td colSpan={8} className="border-t border-slate-800 p-0">
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {visibleQuotes.map((quote) => <div key={quote.id} className="rounded-lg border border-slate-800 bg-[#0B1120] p-3">
                    <p className="mb-2 text-[10px] font-bold text-lime-400">#{quote.quoteNumber} · {quote.customer}</p>
                    {(quote.items ?? []).length ? quote.items?.map((item) => {
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
          <PaginationFooter page={currentPage} pageCount={pageCount} pageSize={pageSize} total={savedQuotes.length} recordLabel="cotizaciones" onPageChange={setPage} />
      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="create-quote-title">
        <form onSubmit={createQuotation} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-center justify-between"><h2 id="create-quote-title" className="text-base font-bold text-white">Crear cotización</h2><button type="button" aria-label="Cerrar" onClick={() => setCreateOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button></div>
          {availableClients.length > 0 ? <div className="space-y-3">
            <div className="relative">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Cliente</span>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={clientSearch}
                    onChange={(event) => {
                      setClientSearch(event.target.value)
                      setClientId('')
                      setVehicleId('')
                    }}
                    placeholder="Escribe el nombre o la placa"
                    autoComplete="off"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-[#0B1120] pl-9 pr-3 text-xs text-white outline-none focus:border-lime-400"
                  />
                </div>
              </label>
              {clientSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                  {clientSuggestions.map((client) => (
                    <button
                      type="button"
                      key={client.id}
                      onClick={() => {
                        setClientId(client.id)
                        setVehicleId('')
                        setClientSearch(`${client.name} · ${client.vehicles.map((vehicle) => vehicle.plate).join(', ')}`)
                      }}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-800"
                    >
                      <span className="text-xs font-semibold text-slate-100">{client.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {client.vehicles.map((vehicle) => vehicle.plate).join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
