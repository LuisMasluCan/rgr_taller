import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDemoData } from '../contexts/useDemoData'
import NumericInput from '../components/NumericInput'
import type { InvoiceItem } from '../types'

type InvoiceTotals = {
  costs: number
  subtotal: number
  discounts: number
  taxableBase: number
  taxes: number
  retention: number
  total: number
  profit: number
  margin: number
}

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
})

function InvoicingView() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { inventory, orders, setOrders, setCashRegister } = useDemoData()
  const order = orders.find((item) => item.id === orderId)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [retentionApplied, setRetentionApplied] = useState(false)
  const totals = useMemo<InvoiceTotals>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const discounts = items.reduce((sum, item) => sum + item.price * item.quantity * (item.discount / 100), 0)
    const taxableBase = subtotal - discounts
    const taxes = items.reduce(
      (sum, item) => sum + item.price * item.quantity * (1 - item.discount / 100) * (item.taxRate / 100),
      0,
    )
    const costs = items.reduce((sum, item) => sum + item.cost * item.quantity, 0)
    const retention = retentionApplied ? taxableBase * 0.03 : 0
    const salesBeforeTax = taxableBase
    const profit = salesBeforeTax - costs
    return {
      costs,
      subtotal,
      discounts,
      taxableBase,
      taxes,
      retention,
      total: taxableBase + taxes - retention,
      profit,
      margin: salesBeforeTax > 0 ? (profit / salesBeforeTax) * 100 : 0,
    }
  }, [items, retentionApplied])
  const [query, setQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<(typeof inventory)[number] | null>(null)
  const [unitPrice, setUnitPrice] = useState('')
  const [newTaxRate, setNewTaxRate] = useState('18')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [paymentReceived, setPaymentReceived] = useState('')
  const [observation, setObservation] = useState(() =>
    order
      ? `Vehículo: ${order.vehicle.make} ${order.vehicle.model} ${order.vehicle.year} | Placa: ${order.vehicle.plate} | VIN: ${order.vehicle.vin || 'No registrado'} | Kilometraje al ingreso: ${order.mileage.toLocaleString('es-PE')} km`
      : '',
  )
  const [successOpen, setSuccessOpen] = useState(false)

  useEffect(() => {
    if (!order) return
    document.title = `RGR Taller | Factura #${order.id}`
    return () => {
      document.title = 'RGR Taller | Órdenes de servicio'
    }
  }, [order])

  const suggestions = useMemo(
    () =>
      inventory.filter((item) =>
        `${item.description} ${item.reference}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [inventory, query],
  )

  const changeItem = (id: string, field: keyof InvoiceItem, value: string) => {
    const numericFields: (keyof InvoiceItem)[] = ['cost', 'price', 'discount', 'taxRate', 'quantity']
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: numericFields.includes(field) ? Math.max(0, Number(value) || 0) : value,
            }
          : item,
      ),
    )
  }

  const addSelectedItem = () => {
    if (!selectedItem) return
    setItems((current) => [
      ...current,
      {
        id: `${selectedItem.id}-${Date.now()}`,
        description: selectedItem.description,
        reference: selectedItem.reference,
        cost: selectedItem.cost,
        price: Number(selectedItem.price.toFixed(2)),
        discount: 0,
        taxRate: 0,
        quantity: 1,
      },
    ])
    setQuery('')
    setSelectedItem(null)
    setUnitPrice('')
    setShowSuggestions(false)
  }

  const emitInvoice = () => {
    if (!order || !items.length || order.invoiced) return
    setOrders((current) =>
      current.map((entry) =>
        entry.id === order.id
          ? { ...entry, invoiced: true, invoiceTotal: totals.total }
          : entry,
      ),
    )
    setCashRegister((current) => current ? {
      ...current,
      movements: [...current.movements, {
        id: `invoice-${order.id}-${Date.now()}`,
        type: 'Ingreso',
        concept: `Factura #${order.id}`,
        amount: totals.total,
        timestamp: new Date().toISOString(),
      }],
    } : current)
    setSuccessOpen(true)
  }

  const selectSuggestion = (item: (typeof inventory)[number]) => {
    setSelectedItem(item)
    setQuery(item.description)
    setUnitPrice(String(item.price))
    setNewTaxRate(String(item.taxRate))
    setShowSuggestions(false)
  }

  const amountReceived = Number(paymentReceived) || 0
  const changeDue = Math.max(0, amountReceived - totals.total)

  if (!order) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center">
        <p className="text-sm font-semibold text-slate-200">No encontramos la orden solicitada.</p>
        <button onClick={() => navigate('/orders')} className="mt-4 text-xs font-bold text-slate-300 underline">Volver a órdenes</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Órdenes de servicio</span><span>/</span><span>Entrega</span><span>/</span>
            <span className="font-semibold text-slate-400">#{order.id}</span>
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-100">Factura de venta</h2>
        </div>
        <button onClick={() => navigate('/orders')} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 shadow-lg hover:bg-slate-800">
          <ArrowLeft size={15} /> Volver a órdenes
        </button>
      </div>

      <section className="grid overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Costos totales" value={currency.format(totals.costs)} detail="Costo de repuestos e insumos" />
        <SummaryCard label="Ventas antes de impuestos" value={currency.format(totals.taxableBase)} detail="Importe neto de descuentos" />
        <SummaryCard label="Ganancias" value={currency.format(totals.profit)} detail="Venta neta menos costos" />
        <SummaryCard label="% Rentabilidad" value={`${totals.margin.toFixed(1)}%`} detail="Ganancia sobre ventas netas" accent />
      </section>
      {order.invoiced && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
          <span>Esta orden ya fue facturada{order.invoiceTotal !== undefined ? ` por ${currency.format(order.invoiceTotal)}` : ''}. No se puede emitir otra factura.</span>
          <button onClick={() => navigate('/orders')} className="font-bold underline underline-offset-2">Volver a órdenes</button>
        </div>
      )}

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Agregar productos o servicios</h3>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-slate-400"><CircleHelp size={13} /> Precios en soles (S/)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(190px,1.5fr)_minmax(130px,.7fr)_minmax(130px,.7fr)_auto]">
          <div className="relative">
            <label htmlFor="item-search" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Buscar ítem</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="item-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedItem(null)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Nombre o referencia..."
                className="h-10 w-full rounded-lg border border-slate-700 px-9 pr-3 text-xs outline-none focus:border-slate-700"
              />
            </div>
            {showSuggestions && query && (
              <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg">
                {suggestions.length ? suggestions.map((item) => (
                  <button key={item.id} onClick={() => selectSuggestion(item)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-800">
                    <span><span className="block text-xs font-semibold text-slate-200">{item.description}</span><span className="text-[10px] text-slate-400">{item.reference} · Stock: {item.stock}</span></span>
                    <span className="text-xs font-semibold text-slate-300">{currency.format(item.price)}</span>
                  </button>
                )) : <p className="px-3 py-2 text-xs text-slate-400">No hay coincidencias en el inventario.</p>}
              </div>
            )}
          </div>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Impuesto</span>
            <select value={newTaxRate} onChange={(event) => setNewTaxRate(event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs outline-none focus:border-slate-700">
              <option value="0">Sin impuesto</option><option value="18">IGV 18%</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Precio unitario</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">S/</span>
              <NumericInput value={unitPrice} onChange={setUnitPrice} min="0" placeholder="0.00" className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" />
            </div>
          </label>
          <div className="flex items-end">
            <button disabled={!selectedItem} onClick={addSelectedItem} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-extrabold text-slate-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              <Plus size={15} /> AGREGAR
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Ítems a facturar</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">{items.length} conceptos incluidos en esta factura</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRetentionApplied((current) => !current)} className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${retentionApplied ? 'border-red-900/50 bg-red-950/30 text-red-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              {retentionApplied ? 'RETENCIÓN 3% APLICADA' : 'APLICAR RETENCIÓN GENERAL'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-900 text-[9px] font-bold uppercase tracking-wider text-white">
                {['ID', 'Ítem / descripción', 'Referencia', 'Costo', 'Rent. %', 'Precio', 'Desc. %', 'Impuesto', 'Cant.', 'Total', 'Opciones'].map((column) => (
                  <th key={column} className="px-3 py-3.5 first:pl-5">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const lineBase = item.price * item.quantity * (1 - item.discount / 100)
                const lineTotal = lineBase * (1 + item.taxRate / 100)
                const profitability = lineBase > 0 ? ((lineBase - item.cost * item.quantity) / lineBase) * 100 : 0
                return (
                  <tr key={item.id} className="text-[11px] text-slate-400 hover:bg-slate-900/70">
                    <td className="px-3 py-3.5 pl-5 font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                    <td className="max-w-[200px] px-3 py-3.5"><span className="block truncate font-semibold text-slate-200">{item.description}</span></td>
                    <td className="px-3 py-3.5 font-mono text-[10px] text-slate-400">{item.reference}</td>
                    <td className="px-3 py-3.5"><MoneyInput ariaLabel={`Costo de ${item.description}`} value={item.cost} onChange={(value) => changeItem(item.id, 'cost', value)} /></td>
                    <td className="px-3 py-3.5"><span className={`font-semibold ${profitability < 20 ? 'text-orange-300' : 'text-emerald-300'}`}>{profitability.toFixed(0)}%</span></td>
                    <td className="px-3 py-3.5"><MoneyInput ariaLabel={`Precio de ${item.description}`} value={item.price} onChange={(value) => changeItem(item.id, 'price', value)} /></td>
                    <td className="px-3 py-3.5"><SmallNumberInput ariaLabel={`Descuento de ${item.description}`} value={item.discount} suffix="%" onChange={(value) => changeItem(item.id, 'discount', value)} /></td>
                    <td className="px-3 py-3.5">
                      <select value={item.taxRate} onChange={(event) => changeItem(item.id, 'taxRate', event.target.value)} aria-label={`Impuesto de ${item.description}`} className="h-8 w-[106px] rounded-md border border-slate-700 bg-slate-900 px-2 text-[10px] outline-none focus:border-slate-700">
                        <option value="0">Sin impuesto</option><option value="18">IGV 18%</option>
                      </select>
                    </td>
                    <td className="px-3 py-3.5"><SmallNumberInput ariaLabel={`Cantidad de ${item.description}`} value={item.quantity} onChange={(value) => changeItem(item.id, 'quantity', value)} /></td>
                    <td className="px-3 py-3.5 font-bold text-slate-100">{currency.format(lineTotal)}</td>
                    <td className="px-3 py-3.5">
                      <button aria-label={`Eliminar ${item.description}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-950/30 hover:text-red-200">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!items.length && (
                <tr><td colSpan={11} className="py-12 text-center text-xs text-slate-400">No hay ítems agregados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3.5 sm:px-5">
          <button onClick={() => { setQuery(''); setSelectedItem(null); setShowSuggestions(false) }} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/30">
            <Plus size={15} /> Agregar ítem
          </button>
          <span className="text-[10px] text-slate-400">Los totales se actualizan automáticamente</span>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Información de pago</h3>
              <span className="rounded-md border border-slate-700 bg-transparent px-2 py-1 text-[10px] font-semibold text-slate-400">PEN · Soles</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Método de pago</span>
                <div className="relative">
                  <select className="h-10 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 pr-9 text-xs outline-none focus:border-slate-700">
                    <option>Caja - Efectivo</option><option>Transferencia bancaria</option><option>Tarjeta de crédito / débito</option><option>Yape / Plin</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Efectivo recibido</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">S/</span>
                  <NumericInput value={paymentReceived} onChange={setPaymentReceived} min="0" placeholder={totals.total.toFixed(2)} className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" />
                </div>
              </label>
            </div>
            {amountReceived > 0 && <p className="mt-3 text-right text-[11px] text-slate-400">Vuelto: <strong className="text-slate-200">{currency.format(changeDue)}</strong></p>}
          </section>
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div><h3 className="text-sm font-bold text-slate-100">Observaciones</h3><p className="mt-0.5 text-[11px] text-slate-400">Esta información aparecerá en el comprobante.</p></div>
              <FileText size={17} className="text-slate-400" />
            </div>
            <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-slate-700 p-3 text-xs leading-relaxed text-slate-400 outline-none focus:border-slate-700" />
          </section>
        </div>

        <section className="h-fit rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">Resumen de factura</h3>
            <span className="rounded-md border border-slate-700 bg-transparent px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">Detalle</span>
          </div>
          <div className="space-y-3 text-xs">
            <TotalRow label="Subtotal" value={totals.subtotal} />
            <TotalRow label="Descuentos" value={totals.discounts} negative />
            <div className="border-t border-dashed border-slate-700 pt-3"><TotalRow label="Base imponible" value={totals.taxableBase} strong /></div>
            <TotalRow label="Impuestos (IGV)" value={totals.taxes} />
            <TotalRow label="Retenciones" value={totals.retention} negative />
          </div>
          <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-4 text-white">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300">Total a pagar</p><p className="mt-0.5 text-[10px] text-slate-400">Incluye impuestos y descuentos</p></div>
            <p className="text-xl font-extrabold tracking-tight">{currency.format(totals.total)}</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400">
            <span>Comprobante</span><span className="font-semibold text-slate-400">Boleta electrónica</span>
          </div>
        </section>
      </div>

      <footer className="flex flex-col-reverse justify-between gap-3 border-t border-slate-700 pt-5 sm:flex-row sm:items-center">
        <button onClick={() => navigate('/orders')} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-xs font-bold text-white transition hover:bg-violet-700">
          <X size={15} /> SALIR
        </button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button onClick={() => navigate('/orders')} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-800/60 bg-amber-900/40 px-5 text-xs font-bold text-amber-100 transition hover:bg-amber-800/50">
            <ArrowLeft size={14} /> ATRÁS
          </button>
          <button disabled={!items.length || order.invoiced} onClick={emitInvoice} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-300 px-5 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">
            <Check size={15} /> EMITIR FACTURA
          </button>
        </div>
      </footer>

      {successOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-success-title">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lime-900/40 text-lime-300"><Check size={27} strokeWidth={2.5} /></div>
            <h2 id="invoice-success-title" className="mt-4 text-lg font-bold text-slate-100">¡Factura emitida!</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">La factura de la orden <strong className="text-slate-300">#{order.id}</strong> se emitió correctamente por <strong className="text-slate-300">{currency.format(totals.total)}</strong>.</p>
            <button onClick={() => navigate('/orders')} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-xs font-bold text-white transition hover:bg-slate-700">Volver a órdenes <Check size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className="relative p-4 sm:p-5">
      <div className={`absolute inset-y-4 left-0 w-0.5 rounded-full ${accent ? 'bg-lime-400' : 'bg-slate-700'}`} />
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-extrabold tracking-tight text-slate-100">{value}</p>
      <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
    </div>
  )
}

function MoneyInput({ value, onChange, ariaLabel }: { value: number; onChange: (value: string) => void; ariaLabel: string }) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">S/</span>
      <NumericInput aria-label={ariaLabel} min="0" step="0.01" value={value} onChange={onChange} className="h-8 w-[92px] rounded-md border border-slate-700 pl-7 pr-2 text-[10px] outline-none focus:border-slate-700" />
    </div>
  )
}

function SmallNumberInput({ value, onChange, ariaLabel, suffix }: { value: number; onChange: (value: string) => void; ariaLabel: string; suffix?: string }) {
  return (
    <div className="relative">
      <NumericInput aria-label={ariaLabel} min="0" step={suffix ? '0.1' : '1'} value={value} onChange={onChange} className={`h-8 w-[62px] rounded-md border border-slate-700 px-2 text-[10px] outline-none focus:border-slate-700 ${suffix ? 'pr-5' : ''}`} />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">{suffix}</span>}
    </div>
  )
}

function TotalRow({ label, value, negative = false, strong = false }: { label: string; value: number; negative?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'font-bold text-slate-200' : 'text-slate-400'}`}>
      <span>{label}</span><span className={negative && value > 0 ? 'text-red-500' : strong ? 'text-slate-100' : 'text-slate-300'}>{negative && value > 0 ? '− ' : ''}{currency.format(value)}</span>
    </div>
  )
}

export default InvoicingView
