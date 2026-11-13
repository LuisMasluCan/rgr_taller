import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleHelp,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QuotationPDFTemplate from '../components/QuotationPDFTemplate'
import NumericInput from '../components/NumericInput'
import { useDemoData } from '../contexts/useDemoData'
import type { BankAccount } from '../data/mockBanks'
import { laborConfig } from '../data/laborConfig'
import type { CashMovement, InventoryItem, OrderServiceItem, Payment } from '../types'

type Props = { mode: 'quote' | 'invoice' }
type Totals = { subtotal: number; discounts: number; base: number; taxes: number; total: number }

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const typeOptions: OrderServiceItem['type'][] = ['Mano de obra', 'Repuesto', 'Insumo', 'Servicio Compuesto', 'Adicional']
const cashPaymentMethodByLabel: Record<string, NonNullable<CashMovement['paymentMethod']>> = {
  Efectivo: 'Efectivo',
  Transferencia: 'Transferencia',
  Yape: 'Yape',
  Plin: 'Plin',
  'Tarjeta de crédito': 'Tarjeta de crédito',
  'Tarjeta de débito': 'Tarjeta de débito',
}

function getCashPaymentMethod(account: BankAccount): NonNullable<CashMovement['paymentMethod']> | null {
  const accountLabel = `${account.id} ${account.name} ${account.number}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (accountLabel.includes('yape')) return 'Yape'
  if (accountLabel.includes('plin')) return 'Plin'
  if (account.type === 'Tarjeta de crédito' || accountLabel.includes('credito')) return 'Tarjeta de crédito'
  if (accountLabel.includes('debito')) return 'Tarjeta de débito'
  if (accountLabel.includes('transfer')) return 'Transferencia'
  if (account.type === 'Efectivo' || accountLabel.includes('efectivo') || accountLabel.includes('cash')) return 'Efectivo'
  return null
}

function calculateTotals(items: OrderServiceItem[], globalDiscount: number, includeApprovedOnly: boolean): Totals {
  const applicableItems = includeApprovedOnly ? items.filter((item) => item.status === 'Aprobado') : items
  const discountRate = (item: OrderServiceItem) => 1 - (1 - item.discount / 100) * (1 - globalDiscount / 100)
  const subtotal = applicableItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discounts = applicableItems.reduce(
    (sum, item) => sum + item.price * item.quantity * discountRate(item),
    0,
  )
  const base = subtotal - discounts
  const taxes = applicableItems.reduce(
    (sum, item) => sum + item.price * item.quantity * (1 - discountRate(item)) * item.taxRate / 100,
    0,
  )
  return { subtotal, discounts, base, taxes, total: base + taxes }
}

function deductInvoicedInventory(inventory: InventoryItem[], items: OrderServiceItem[]) {
  const quantitiesByReference = new Map<string, number>()
  for (const item of items) {
    if (item.status !== 'Aprobado' || (item.type !== 'Repuesto' && item.type !== 'Insumo')) continue
    const reference = item.reference.trim().toUpperCase()
    const quantity = Math.max(0, Number(item.quantity) || 0)
    if (!reference || !quantity) continue
    quantitiesByReference.set(reference, (quantitiesByReference.get(reference) ?? 0) + quantity)
  }

  return inventory.map((item) => {
    const type = item.type ?? (item.id.startsWith('INS') ? 'Insumo' : item.id.startsWith('SRV') ? 'Mano de Obra' : 'Repuesto')
    if (type !== 'Repuesto' && type !== 'Insumo') return item
    const quantity = quantitiesByReference.get(item.reference.trim().toUpperCase())
    return quantity ? { ...item, stock: item.stock - quantity } : item
  })
}

function createInvoiceMovement(orderId: string, amount: number) {
  const issuedAt = new Date()
  return {
    issuedAt: issuedAt.toISOString(),
    movement: {
      id: `invoice-${orderId}-${issuedAt.getTime()}`,
      date: new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(issuedAt),
      concept: `Factura #${orderId}`,
      type: 'Ingreso' as const,
      amount,
    },
  }
}

function OrderQuoteView({ mode }: Props) {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const printOnOpen = searchParams.get('print') === '1'
  const { orders, setOrders, inventory, setInventory, bankAccounts, setBankAccounts, setBankMovements, cashRegister, setCashRegister, settings, clients, activeProfile } = useDemoData()
  const order = orders.find((candidate) => candidate.id === orderId)
  const invoiceAllowed = order?.status === 'Entrega'
  const [items, setItems] = useState<OrderServiceItem[]>(() => order?.quoteItems ?? [])
  const [globalDiscount, setGlobalDiscount] = useState(order?.quoteDiscountPercent ?? 0)
  const [query, setQuery] = useState('')
  const [activeQuoteItemId, setActiveQuoteItemId] = useState<string | null>(null)
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [taxRate, setTaxRate] = useState('18')
  const [depositModal, setDepositModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [invoicePaymentAccountId, setInvoicePaymentAccountId] = useState(
    bankAccounts.find((account) => account.name === order?.invoicePaymentMethod)?.id ?? bankAccounts[0]?.id ?? '',
  )
  const [paymentConcept, setPaymentConcept] = useState('Abono a cuenta')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paymentWarning, setPaymentWarning] = useState('')
  const [savedNotice, setSavedNotice] = useState('')
  const [invoiceSuccessOpen, setInvoiceSuccessOpen] = useState(false)
  const [invoiceSuccessMessage, setInvoiceSuccessMessage] = useState('')
  const invoiceIssuanceStarted = useRef(false)
  const [quotePrintOpen, setQuotePrintOpen] = useState(mode === 'quote' && printOnOpen)

  const selectedInventoryItem = inventory.find((item) => item.id === selectedInventoryItemId)
  const suggestions = useMemo(
    () => inventory.filter((item) => `${item.description} ${item.reference}`.toLowerCase().includes(query.trim().toLowerCase())),
    [inventory, query],
  )

  const quotedTotals = calculateTotals(items, globalDiscount, false)
  const approvedTotals = calculateTotals(items, globalDiscount, true)
  const payments = order?.payments ?? []
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const pendingTotal = Math.max(0, approvedTotals.total - paidTotal)
  const selectedTax = Number(taxRate)

  const updateItem = (id: string, patch: Partial<OrderServiceItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
    setSavedNotice('')
  }

  const addInventoryItem = () => {
    if (!selectedInventoryItem) return
    const itemType: OrderServiceItem['type'] = selectedInventoryItem.type === 'Mano de Obra' || selectedInventoryItem.id.startsWith('SRV')
      ? 'Mano de obra'
      : selectedInventoryItem.type === 'Servicio Compuesto'
        ? 'Servicio Compuesto'
        : selectedInventoryItem.type === 'Insumo' || selectedInventoryItem.id.startsWith('INS')
        ? 'Insumo'
        : 'Repuesto'
    setItems((current) => [...current, {
      id: `${selectedInventoryItem.id}-${Date.now()}`,
      type: itemType,
      description: selectedInventoryItem.description,
      reference: selectedInventoryItem.reference,
      cost: selectedInventoryItem.cost,
      price: Number(unitPrice) || selectedInventoryItem.price,
      discount: 0,
      taxRate: selectedTax,
      quantity: 1,
      status: 'Aprobado',
      laborHours: selectedInventoryItem.laborHours ?? (itemType === 'Mano de obra' ? selectedInventoryItem.price / laborConfig.hourlySaleRate : undefined),
    }])
    setQuery('')
    setSelectedInventoryItemId('')
    setUnitPrice('')
    setSavedNotice('')
  }

  const addBlankItem = () => {
    setItems((current) => [...current, {
      id: `manual-${Date.now()}`,
      type: 'Adicional',
      description: '',
      reference: '',
      cost: 0,
      marginPercent: 30,
      price: 0,
      discount: 0,
      taxRate: 0,
      quantity: 1,
      status: 'Pendiente',
    }])
    setSavedNotice('')
  }

  const updateItemCost = (item: OrderServiceItem, cost: number) => {
    const marginPercent = item.marginPercent ?? (item.cost > 0 ? (item.price / item.cost - 1) * 100 : 0)
    updateItem(item.id, { cost, marginPercent, price: cost * (1 + marginPercent / 100) })
  }

  const updateItemMargin = (item: OrderServiceItem, marginPercent: number) => {
    updateItem(item.id, { marginPercent, price: item.cost * (1 + marginPercent / 100) })
  }

  const updateItemPrice = (item: OrderServiceItem, price: number) => {
    updateItem(item.id, {
      price,
      marginPercent: item.cost > 0 ? (price / item.cost - 1) * 100 : item.marginPercent,
    })
  }

  const saveQuote = () => {
    if (!order) return
    const nextQuoteNumber = String(Math.max(
      616,
      ...orders.map((candidate) => Number(candidate.quoteNumber) || 0),
    ) + 1)
    setOrders((current) => current.map((candidate) => candidate.id === order.id
      ? {
          ...candidate,
          quoteItems: items,
          quoteInitialized: true,
          quoteDiscountPercent: globalDiscount,
          quoteSaved: true,
          quoteNumber: candidate.quoteNumber ?? nextQuoteNumber,
        }
      : candidate))
    setSavedNotice('Cotización guardada en esta orden.')
  }

  const addPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!order) return
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Ingresa un monto mayor a cero.')
      return
    }
    if (amount > pendingTotal) {
      setPaymentError(`El abono no puede superar el pendiente de ${currency.format(pendingTotal)}.`)
      return
    }
    const cashPaymentMethod = cashPaymentMethodByLabel[paymentMethod]
    if (!cashPaymentMethod) {
      setPaymentError('Selecciona un medio de pago válido.')
      return
    }
    const timestamp = new Date().toISOString()
    const payment: Payment = {
      id: `payment-${Date.now()}`,
      date: new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(timestamp)),
      timestamp,
      method: paymentMethod,
      concept: paymentConcept,
      amount,
    }
    if (cashRegister) {
      const movement: CashMovement = {
        id: `cash-${payment.id}`,
        type: 'Ingreso',
        concept: `${paymentConcept.trim()} · Orden #${order.id}`,
        amount,
        timestamp,
        paymentMethod: cashPaymentMethod,
        currency: 'PEN',
        orderId: order.id,
        contact: order.customer,
      }
      setCashRegister((current) => current ? { ...current, movements: [...current.movements, movement] } : current)
      setPaymentWarning('')
      setSavedNotice('Abono registrado y agregado automáticamente a la caja abierta.')
    } else {
      setPaymentWarning('Abono guardado fuera de caja y no aparecerá en este reporte de cierre. Concílialo con el medio de pago correspondiente.')
    }
    setOrders((current) => current.map((candidate) => candidate.id === order.id
      ? { ...candidate, quoteItems: items, quoteInitialized: true, quoteDiscountPercent: globalDiscount, payments: [...(candidate.payments ?? []), payment] }
      : candidate))
    setPaymentAmount('')
    setPaymentError('')
    setDepositModal(false)
  }

  const emitInvoice = () => {
    if (!order || mode !== 'invoice' || !invoiceAllowed || order.invoiced || invoiceIssuanceStarted.current) return
    const account = bankAccounts.find((candidate) => candidate.id === invoicePaymentAccountId)
    if (!account) {
      setSavedNotice('La cuenta de pago seleccionada ya no está disponible.')
      return
    }
    invoiceIssuanceStarted.current = true
    const { issuedAt, movement: invoiceMovement } = createInvoiceMovement(order.id, approvedTotals.total)
    const pendingAmount = Math.max(0, approvedTotals.total - paidTotal)
    const cashPaymentMethod = getCashPaymentMethod(account)
    const cashMovementId = `cash-invoice-${order.id}`
    setInventory((current) => deductInvoicedInventory(current, items))
    setOrders((current) => current.map((candidate) => candidate.id === order.id
      ? {
          ...candidate,
          quoteItems: items,
          quoteInitialized: true,
          quoteDiscountPercent: globalDiscount,
          invoiced: true,
          invoiceTotal: approvedTotals.total,
          invoicePaymentMethod: account.name,
          status: 'Archivados',
          timestamps: { ...candidate.timestamps, fechaArchivado: issuedAt },
        }
      : candidate))
    setBankAccounts((current) => current.map((candidate) => candidate.id === account.id
      ? { ...candidate, currentBalance: candidate.currentBalance + approvedTotals.total }
      : candidate))
    setBankMovements((current) => ({
      ...current,
      [account.id]: [invoiceMovement, ...(current[account.id] ?? [])],
    }))
    if (cashRegister && pendingAmount > 0 && cashPaymentMethod) {
      const cashMovement: CashMovement = {
        id: cashMovementId,
        type: 'Ingreso',
        concept: `Factura #${order.id}`,
        amount: pendingAmount,
        timestamp: issuedAt,
        paymentMethod: cashPaymentMethod,
        currency: 'PEN',
        orderId: order.id,
        contact: order.customer,
      }
      setCashRegister((current) => {
        if (!current || current.movements.some((movement) => movement.id === cashMovementId)) return current
        return { ...current, movements: [...current.movements, cashMovement] }
      })
    }
    const cashNotice = pendingAmount === 0
      ? 'Los abonos previos ya registrados no se duplicaron en el cierre de caja.'
      : !cashRegister
        ? 'No había una caja abierta; este ingreso no aparecerá en un reporte de cierre.'
        : !cashPaymentMethod
          ? `No se pudo agregar el ingreso a caja porque no se reconoció el medio de pago de ${account.name}.`
          : `Se agregó el saldo pendiente de ${currency.format(pendingAmount)} a la caja abierta, vinculado a la OT #${order.id}.`
    setInvoiceSuccessMessage(`Factura emitida con éxito. Se han sumado ${currency.format(approvedTotals.total)} a la cuenta ${account.name}. ${cashNotice}`)
    setInvoiceSuccessOpen(true)
  }

  if (!order) {
    return <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center"><p className="text-sm font-semibold text-slate-200">No encontramos la orden solicitada.</p><button onClick={() => navigate(mode === 'quote' ? '/quotes' : '/orders')} className="mt-4 text-xs font-bold text-slate-300 underline">Volver</button></div>
  }

  const isInvoice = mode === 'invoice'
  const canIssueInvoice = isInvoice && invoiceAllowed && !order.invoiced

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2 text-[11px] text-slate-400"><span>{isInvoice ? 'Órdenes de servicio' : 'Cotizaciones'}</span><span>/</span><span className="font-semibold text-slate-400">#{order.id}</span></div><h2 className="mt-1 text-lg font-bold tracking-tight text-slate-100">{isInvoice ? 'Facturación final' : 'Cotización de servicio'}</h2></div>
        <button onClick={() => navigate(isInvoice ? '/orders' : '/quotes')} className="no-print flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400 shadow-lg hover:bg-slate-800"><ArrowLeft size={15} /> Volver</button>
      </div>

      <section className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:grid-cols-2 lg:grid-cols-4">
        <OrderInfo label="CLIENTE" value={order.customer} />
        <OrderInfo label="VEHÍCULO" value={`${order.vehicle.make} ${order.vehicle.model} · ${order.vehicle.plate}`} />
        <OrderInfo label="VIN / KM INGRESO" value={`${order.vehicle.vin || 'VIN no registrado'} · ${order.mileage.toLocaleString('es-PE')} km`} />
        <OrderInfo label="ESTADO DE ORDEN" value={order.status} />
      </section>

      {isInvoice && (!invoiceAllowed || order.invoiced) && (
        <div role="status" className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
          {order.invoiced
            ? `Esta orden ya tiene una factura registrada${order.invoiceTotal !== undefined ? ` por ${currency.format(order.invoiceTotal)}` : ''}.`
            : 'La factura final solo está disponible cuando la orden se encuentra en Entrega.'}
        </div>
      )}

      <div className="flex gap-5 border-b border-slate-700 px-2">
        <button className="relative border-b-2 border-lime-400 px-1 pb-3 text-[10px] font-extrabold tracking-wider text-slate-100">COTIZACIÓN</button>
        <button onClick={() => setSavedNotice('El cotizador beta estará disponible próximamente.')} className="no-print px-1 pb-3 text-[10px] font-bold tracking-wider text-slate-400 hover:text-slate-300">COTIZADOR BETA</button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-4 py-4 sm:px-5">
          <div><h3 className="text-sm font-bold text-slate-100">Ítems de la {isInvoice ? 'factura' : 'cotización'}</h3><p className="mt-0.5 text-[11px] text-slate-400">{items.length} conceptos asociados a la orden</p></div>
          <button onClick={addBlankItem} className="flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[10px] font-extrabold text-slate-950 hover:bg-lime-400"><Plus size={14} /> AGREGAR ÍTEM</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1590px] border-collapse text-left">
            <thead><tr className="bg-slate-900 text-[9px] font-bold uppercase tracking-wider text-white">{['ID', 'Tipo', 'Ítem', 'Referencia', 'Costo', 'Rent. %', 'Valor/unitario', 'Desc. %', 'Impuesto', 'Subtotal', 'Cantidad', 'Total', 'Estado', 'Opciones'].map((column) => <th key={column} className="px-3 py-3.5 first:pl-5">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const discount = 1 - (1 - item.discount / 100) * (1 - globalDiscount / 100)
                const subtotal = item.price * item.quantity
                const lineBase = subtotal * (1 - discount)
                const lineTotal = lineBase * (1 + item.taxRate / 100)
                const profitability = item.marginPercent ?? (item.cost > 0 ? (item.price / item.cost - 1) * 100 : 0)
                const typeColor = item.type === 'Repuesto' ? 'bg-emerald-950/30 text-emerald-300' : item.type === 'Insumo' ? 'bg-orange-950/30 text-orange-200' : item.type === 'Adicional' ? 'bg-cyan-950/40 text-cyan-300' : 'bg-slate-800 text-slate-300'
                return (
                  <tr key={item.id} className="text-[10px] text-slate-400 hover:bg-slate-900/70">
                    <td className="px-3 py-3 pl-5 font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-3 py-3"><select aria-label={`Tipo de ${item.description || `ítem ${index + 1}`}`} value={item.type} onChange={(event) => updateItem(item.id, { type: event.target.value as OrderServiceItem['type'] })} className={`h-8 w-[120px] rounded-md border border-slate-700 px-2 text-[10px] font-semibold ${typeColor}`}>{typeOptions.map((type) => <option key={type}>{type}</option>)}</select></td>
                    <td className="px-3 py-3"><div className="w-[190px]"><input aria-label={`Ítem ${index + 1}`} value={item.description} onFocus={() => setActiveQuoteItemId(item.id)} onBlur={() => window.setTimeout(() => setActiveQuoteItemId((activeId) => activeId === item.id ? null : activeId), 150)} onChange={(event) => { setActiveQuoteItemId(item.id); updateItem(item.id, { description: event.target.value }) }} className="h-8 w-full rounded-md border border-slate-700 px-2 text-[10px] outline-none focus:border-slate-700" />{activeQuoteItemId === item.id && item.description.trim() && (() => {
                      const matches = inventory.filter((candidate) =>
                        `${candidate.description} ${candidate.reference}`.toLowerCase().includes(item.description.trim().toLowerCase()),
                      )
                      return matches.length ? <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-slate-700 bg-slate-900">{matches.slice(0, 8).map((candidate) => {
                        const type: OrderServiceItem['type'] = candidate.type === 'Mano de Obra' || candidate.id.startsWith('SRV')
                          ? 'Mano de obra'
                          : candidate.type === 'Servicio Compuesto'
                            ? 'Servicio Compuesto'
                            : candidate.type === 'Insumo' || candidate.id.startsWith('INS')
                              ? 'Insumo'
                              : 'Repuesto'
                        return <button type="button" key={candidate.id} onClick={() => {
                          updateItem(item.id, {
                            type,
                            description: candidate.description,
                            reference: candidate.reference,
                            cost: candidate.cost,
                            marginPercent: candidate.marginPercent ?? (candidate.cost > 0 ? (candidate.price / candidate.cost - 1) * 100 : 0),
                            price: candidate.price,
                            taxRate: candidate.taxRate,
                            laborHours: candidate.laborHours,
                          })
                          setActiveQuoteItemId(null)
                        }} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10px] hover:bg-slate-800"><span className="min-w-0"><strong className="block truncate text-slate-200">{candidate.description}</strong><span className="text-slate-400">{candidate.reference} · Stock {candidate.stock}</span></span><span className="shrink-0 text-slate-300">{currency.format(candidate.price)}</span></button>
                      })}</div> : null
                    })()}</div></td>
                    <td className="px-3 py-3"><input aria-label={`Referencia ${index + 1}`} value={item.reference} onChange={(event) => updateItem(item.id, { reference: event.target.value })} className="h-8 w-[105px] rounded-md border border-slate-700 px-2 font-mono text-[9px] outline-none focus:border-slate-700" /></td>
                    <td className="px-3 py-3"><NumberCell label={`Costo ${index + 1}`} value={item.cost} onChange={(value) => updateItemCost(item, value)} /></td>
                    <td className="px-3 py-3"><NumberCell label={`Rentabilidad ${index + 1}`} value={profitability} min={1} max={100} onChange={(value) => updateItemMargin(item, value)} suffix="%" /></td>
                    <td className="px-3 py-3"><NumberCell label={`Valor unitario ${index + 1}`} value={item.price} onChange={(value) => updateItemPrice(item, value)} /></td>
                    <td className="px-3 py-3"><NumberCell label={`Descuento ${index + 1}`} value={item.discount} max={100} onChange={(value) => updateItem(item.id, { discount: value })} suffix="%" /></td>
                    <td className="px-3 py-3"><select aria-label={`Impuesto ${index + 1}`} value={item.taxRate} onChange={(event) => updateItem(item.id, { taxRate: Number(event.target.value) })} className="h-8 w-[105px] rounded-md border border-slate-700 bg-slate-900 px-2 text-[9px]"><option value="0">Sin impuesto</option><option value="18">IGV 18%</option></select></td>
                    <td className="px-3 py-3 font-medium text-slate-300">{currency.format(subtotal)}</td>
                    <td className="px-3 py-3"><NumberCell label={`Cantidad ${index + 1}`} value={item.quantity} min={1} onChange={(value) => updateItem(item.id, { quantity: Math.max(1, value) })} /></td>
                    <td className="px-3 py-3 font-bold text-slate-100">{currency.format(lineTotal)}</td>
                    <td className="px-3 py-3"><select aria-label={`Estado ${index + 1}`} value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as OrderServiceItem['status'] })} className={`h-7 rounded-full border-0 px-2 text-[9px] font-bold ${item.status === 'Aprobado' ? 'bg-emerald-950/30 text-emerald-300' : 'bg-amber-950/30 text-amber-300'}`}><option>Aprobado</option><option>Pendiente</option></select></td>
                    <td className="px-3 py-3"><button aria-label={`Eliminar ${item.description || `ítem ${index + 1}`}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-950/30"><Trash2 size={14} /></button></td>
                  </tr>
                )
              })}
              {!items.length && <tr><td colSpan={14} className="py-12 text-center text-xs text-slate-400">No hay ítems agregados.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3 sm:px-5">
          <button onClick={addBlankItem} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/30"><Plus size={15} /> Agregar ítem</button>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-semibold text-slate-400"><span>% Descuento a todos los ítems</span><NumericInput aria-label="Descuento general" min="0" max="100" step="0.1" value={globalDiscount} onChange={(value) => { setGlobalDiscount(Math.min(100, Math.max(0, Number(value) || 0))); setSavedNotice('') }} className="h-7 w-16 rounded border border-slate-700 bg-slate-900 px-2 text-right text-xs outline-none focus:border-slate-700" /><span>%</span></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-100">Nuevos Ítems</h3><span className="flex items-center gap-1 text-[10px] text-slate-400"><CircleHelp size={13} /> Catálogo de inventario</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(190px,1.4fr)_minmax(130px,.7fr)_minmax(130px,.7fr)_auto]">
          <div className="relative"><label htmlFor="quote-item-search" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Buscar ítem</label><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input id="quote-item-search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedInventoryItemId('') }} placeholder="Nombre o referencia..." className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" /></div>
            {query && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg">{suggestions.map((item) => <button key={item.id} onClick={() => { setSelectedInventoryItemId(item.id); setQuery(item.description); setUnitPrice(String(item.price)); setTaxRate(String(item.taxRate)) }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-800"><span><span className="block text-xs font-semibold text-slate-200">{item.description}</span><span className="text-[10px] text-slate-400">{item.reference} · Stock: {item.stock}</span></span><span className="text-xs font-semibold">{currency.format(item.price)}</span></button>)}</div>}
          </div>
          <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Base imponible</span><div className="relative"><select value={taxRate} onChange={(event) => setTaxRate(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 pr-8 text-xs"><option value="0">Sin impuesto</option><option value="18">IGV 18%</option></select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></div></label>
          <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Precio unitario</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">S/</span><NumericInput min="0" step="0.01" value={unitPrice} onChange={setUnitPrice} placeholder="0.00" className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" /></div></label>
          <div className="flex items-end"><button disabled={!selectedInventoryItem} onClick={addInventoryItem} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-extrabold text-slate-950 hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Plus size={15} /> AGREGAR</button></div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-100">Abonos / pagos</h3><p className="mt-0.5 text-[11px] text-slate-400">Registra pagos parciales asociados a esta orden.</p></div><button onClick={() => { setPaymentError(''); setPaymentWarning(''); setPaymentAmount(''); setDepositModal(true) }} className="flex h-9 items-center gap-1.5 rounded-lg bg-lime-300 px-3 text-[10px] font-extrabold text-slate-950 hover:bg-lime-400"><Plus size={14} /> REGISTRAR ABONO</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left"><thead className="bg-slate-800 text-[9px] font-bold uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2.5">Fecha</th><th className="px-3 py-2.5">Método</th><th className="px-3 py-2.5">Concepto</th><th className="px-3 py-2.5 text-right">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id} className="text-[10px] text-slate-400"><td className="px-3 py-3">{payment.date}</td><td className="px-3 py-3">{payment.method}</td><td className="px-3 py-3">{payment.concept}</td><td className="px-3 py-3 text-right font-semibold">{currency.format(payment.amount)}</td></tr>)}{!payments.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-400">Todavía no hay abonos registrados.</td></tr>}</tbody></table></div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3.5 text-white"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Pendiente por pagar</span><strong className="text-lg">{currency.format(pendingTotal)}</strong></div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-100">Presupuesto</h3><p className="mt-0.5 text-[11px] text-slate-400">Comparativa de cotizado y aprobado.</p></div>          <span className="rounded-md border border-slate-700 bg-transparent px-2 py-1 text-[9px] font-bold uppercase text-slate-400">PEN · Soles</span></div>
          <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-2 text-[9px] font-bold uppercase tracking-wide text-slate-400"><span>Concepto</span><span className="text-right">Cotizado</span><span className="text-right">Aprobado</span></div>
          <div className="space-y-3 pt-3 text-[11px]">{(['subtotal', 'discounts', 'base', 'taxes', 'total'] as const).map((field) => <div key={field} className={`grid grid-cols-3 items-center ${field === 'total' ? 'border-t border-slate-800 pt-3 font-extrabold text-slate-100' : 'text-slate-400'}`}><span>{({ subtotal: 'SUBTOTAL', discounts: 'DESCUENTOS', base: 'BASE IMPONIBLE', taxes: 'IMPUESTOS', total: 'TOTAL' })[field]}</span><span className={`text-right ${field === 'discounts' ? 'text-red-500' : ''}`}>{field === 'discounts' && quotedTotals[field] > 0 ? '− ' : ''}{currency.format(quotedTotals[field])}</span><span className={`text-right ${field === 'discounts' ? 'text-red-500' : ''}`}>{field === 'discounts' && approvedTotals[field] > 0 ? '− ' : ''}{currency.format(approvedTotals[field])}</span></div>)}</div>
          {isInvoice && <label className="mt-4 block border-t border-slate-800 pt-4"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Método de Pago</span><select required value={invoicePaymentAccountId} onChange={(event) => setInvoicePaymentAccountId(event.target.value)} disabled={order.invoiced || bankAccounts.length === 0} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 outline-none focus:border-lime-400 disabled:opacity-60"><option value="">No hay cuentas registradas</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
        </section>
      </div>

      {savedNotice && <p role="status" className="text-xs font-semibold text-emerald-300">{savedNotice}</p>}
      {paymentWarning && <p role="alert" className="text-xs font-semibold text-amber-300">{paymentWarning}</p>}
      <footer className="no-print flex flex-col-reverse justify-between gap-3 border-t border-slate-700 pt-5 sm:flex-row sm:items-center">
        <button onClick={() => navigate(isInvoice ? '/orders' : '/quotes')} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-xs font-bold text-white hover:bg-violet-700"><X size={15} /> SALIR</button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button onClick={() => isInvoice ? window.print() : setQuotePrintOpen(true)} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-lime-400 bg-transparent px-4 text-xs font-bold text-lime-400 hover:bg-lime-400/15"><Printer size={14} /> IMPRIMIR</button>
          {!isInvoice && <button onClick={saveQuote} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-5 text-xs font-extrabold text-black hover:bg-lime-300"><Check size={14} /> EMITIR COTIZACIÓN</button>}
          {canIssueInvoice && <button onClick={emitInvoice} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-300 px-5 text-xs font-extrabold text-slate-950 hover:bg-lime-400"><Check size={15} /> EMITIR FACTURA</button>}
          {isInvoice && order.invoiced && <span className="flex h-10 items-center gap-2 rounded-lg bg-emerald-950/30 px-4 text-xs font-bold text-emerald-300"><Check size={14} /> FACTURA EMITIDA</span>}
        </div>
      </footer>

      {quotePrintOpen && (
        <div className="print-preview-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Cotización #${order.id}`}>
          <div className="no-print mx-auto mb-4 flex max-w-[900px] items-center justify-between rounded-xl bg-slate-900 px-4 py-3 shadow-lg">
            <div><p className="text-sm font-bold text-slate-100">Vista previa de cotización</p><p className="mt-0.5 text-[10px] text-slate-400">#{order.id} · Listo para imprimir o guardar como PDF</p></div>
            <button type="button" aria-label="Cerrar" onClick={() => setQuotePrintOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={18} /></button>
          </div>
          <QuotationPDFTemplate
            order={{ ...order, quoteItems: items, quoteDiscountPercent: globalDiscount }}
            settings={settings}
            items={items}
            globalDiscount={globalDiscount}
            customerDocument={clients.find((client) => client.name === order.customer)?.id}
            issuedBy={activeProfile}
          />
        </div>
      )}

      {depositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="deposit-title">
          <form onSubmit={addPayment} className="w-full max-w-md rounded-2xl bg-slate-900 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="deposit-title" className="text-base font-bold text-slate-100">Registrar abono</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setDepositModal(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800"><X size={17} /></button>
            </div>
            {!cashRegister && <p role="alert" className="mb-3 rounded-lg bg-amber-950/30 px-3 py-2 text-xs text-amber-200">No hay una caja abierta. Este abono se guardará fuera del cierre de caja; para incluir futuros abonos, abre la caja antes de registrarlos.</p>}
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Método</span>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs">
                  {Object.keys(cashPaymentMethodByLabel).map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Concepto</span>
                <input required value={paymentConcept} onChange={(event) => setPaymentConcept(event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none focus:border-slate-700" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Valor (pendiente {currency.format(pendingTotal)})</span>
                <NumericInput required min="0.01" max={pendingTotal} step="0.01" value={paymentAmount} onChange={setPaymentAmount} className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none focus:border-slate-700" />
              </label>
              {paymentError && <p role="alert" className="text-xs text-red-300">{paymentError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDepositModal(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400">Cancelar</button>
              <button type="submit" className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950">Guardar abono</button>
            </div>
          </form>
        </div>
      )}
      {invoiceSuccessOpen && <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-success-title"><div className="w-full max-w-sm rounded-2xl bg-slate-900 p-7 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lime-900/40 text-lime-300"><Check size={27} strokeWidth={2.5} /></div><h2 id="invoice-success-title" className="mt-4 text-lg font-bold text-slate-100">¡Factura emitida!</h2><p role="status" className="mt-2 text-xs leading-relaxed text-slate-400">{invoiceSuccessMessage}</p><p className="mt-2 text-xs text-slate-400">Orden <strong className="text-slate-300">#{order.id}</strong> archivada correctamente.</p><button onClick={() => navigate('/orders')} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-xs font-bold text-white hover:bg-slate-700">Volver a órdenes <Check size={14} /></button></div></div>}
    </div>
  )
}

function OrderInfo({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-semibold text-slate-200">{value}</p></div>
}

function NumberCell({ label, value, onChange, suffix, min = 0, max }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; min?: number; max?: number }) {
  return <div className="relative"><NumericInput aria-label={label} min={min} max={max} step="0.01" value={value} onChange={(rawValue) => onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, Number(rawValue) || 0)))} className={`h-8 w-[82px] rounded-md border border-slate-700 px-2 text-[10px] outline-none focus:border-slate-700 ${suffix ? 'pr-5' : ''}`} />{suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">{suffix}</span>}</div>
}

export default OrderQuoteView
