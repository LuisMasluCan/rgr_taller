import { Printer } from 'lucide-react'
import type { Order, OrderServiceItem, WorkshopSettings } from '../types'
import { calculateOrderTotals } from '../utils/orderTotals'

type Props = {
  order: Order
  settings: WorkshopSettings
  items?: OrderServiceItem[]
  globalDiscount?: number
  customerDocument?: string
  issuedBy?: string
}

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })

function datePlusDays(date: string, days: number) {
  const parsedDate = new Date(`${date}T12:00:00`)
  parsedDate.setDate(parsedDate.getDate() + days)
  return parsedDate.toLocaleDateString('es-PE')
}

function QuotationPDFTemplate({
  order,
  settings,
  items = order.quoteItems ?? [],
  globalDiscount = order.quoteDiscountPercent ?? 0,
  customerDocument = 'No registrado',
  issuedBy = 'Luis Maslucan',
}: Props) {
  const totals = calculateOrderTotals(items, globalDiscount)
  const issueDate = order.dateISO
    ? new Date(`${order.dateISO}T12:00:00`).toLocaleDateString('es-PE')
    : order.date
  const dueDate = order.dateISO ? datePlusDays(order.dateISO, 15) : '15 días desde la emisión'

  return (
    <article className="print-a4-document printable-quote-document">
      <header className="flex items-start justify-between gap-5 border-b-2 border-slate-900 pb-5">
        <div>
          <img src="/rgr-logo.png" alt="RGR Taller Automotriz" className="h-auto w-44" />
          <div className="mt-3 space-y-0.5 text-[9px] text-slate-700">
            <p>RUC: 20601234567</p>
            <p>{settings.address || 'Dirección no registrada'}</p>
            <p>Celular: {settings.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-extrabold uppercase tracking-wide text-blue-950">Cotización</h1>
          <p className="mt-2 text-sm font-bold text-slate-900">N.º {order.quoteNumber ?? order.id}</p>
          <p className="mt-1 text-[9px] text-slate-600">Emisión: {issueDate}</p>
          <p className="text-[9px] text-slate-600">Vencimiento: {dueDate}</p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-slate-300 p-3 text-[9px]">
        <div><p className="mb-1 font-bold uppercase text-blue-950">Datos del cliente</p><p><strong>Nombre:</strong> {order.customer}</p><p><strong>Documento:</strong> {customerDocument}</p><p><strong>Dirección:</strong> No registrada</p><p><strong>Celular:</strong> {order.phone}</p></div>
        <div><p className="mb-1 font-bold uppercase text-blue-950">Datos del vehículo</p><p><strong>Marca:</strong> {order.vehicle.make}</p><p><strong>Modelo:</strong> {order.vehicle.model} {order.vehicle.year}</p><p><strong>Placa:</strong> {order.vehicle.plate}</p><p><strong>VIN:</strong> {order.vehicle.vin || 'No registrado'}</p></div>
      </section>

      <table className="mt-5 w-full border-collapse text-[8px]">
        <thead><tr className="bg-blue-950 text-left text-white">
          {['Item', 'Ref.', 'Precio', '% Desc.', 'Impuestos', 'Subtotal', 'Cant.', 'Total'].map((column) => <th key={column} className="border border-blue-950 px-1.5 py-2">{column}</th>)}
        </tr></thead>
        <tbody>
          {items.length ? items.map((item, index) => {
            const lineSubtotal = item.price * item.quantity
            const discountRate = 1 - (1 - item.discount / 100) * (1 - globalDiscount / 100)
            const itemDiscount = lineSubtotal * discountRate
            const taxable = lineSubtotal - itemDiscount
            const lineTax = taxable * item.taxRate / 100
            return <tr key={item.id} className="text-slate-800">
              <td className="border border-slate-300 px-1.5 py-2">{index + 1}. {item.description}</td>
              <td className="border border-slate-300 px-1.5 py-2">{item.reference || '—'}</td>
              <td className="border border-slate-300 px-1.5 py-2 text-right">{currency.format(item.price)}</td>
              <td className="border border-slate-300 px-1.5 py-2 text-right">{item.discount}%</td>
              <td className="border border-slate-300 px-1.5 py-2 text-right">{item.taxRate}% · {currency.format(lineTax)}</td>
              <td className="border border-slate-300 px-1.5 py-2 text-right">{currency.format(taxable)}</td>
              <td className="border border-slate-300 px-1.5 py-2 text-center">{item.quantity}</td>
              <td className="border border-slate-300 px-1.5 py-2 text-right font-semibold">{currency.format(taxable + lineTax)}</td>
            </tr>
          }) : <tr><td colSpan={8} className="border border-slate-300 px-2 py-5 text-center text-slate-500">No hay ítems agregados a esta cotización.</td></tr>}
        </tbody>
      </table>

      <section className="mt-4 ml-auto w-64 text-[9px]">
        {([
          ['Subtotal', totals.subtotal],
          ['Descuentos', -totals.discounts],
          ['Base imponible', totals.base],
          ['Impuestos', totals.taxes],
          ['Total', totals.total],
        ] as [string, number][]).map(([label, amount], index) => (
          <div key={label} className={`flex justify-between border-b border-slate-200 px-2 py-1.5 ${index === 4 ? 'border-b-2 border-slate-900 text-sm font-extrabold text-blue-950' : 'text-slate-700'}`}>
            <span>{label}</span><span>{amount < 0 ? `− ${currency.format(Math.abs(amount))}` : currency.format(amount)}</span>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-slate-300 pt-4 text-[8px] text-slate-600">
        <p className="font-bold uppercase text-blue-950">Políticas</p>
        <p className="mt-1 leading-relaxed">Cotización válida hasta la fecha de vencimiento indicada. Los trabajos adicionales requieren aprobación del cliente. Los repuestos y servicios se garantizan según las condiciones informadas por el taller.</p>
        <div className="mt-12 grid grid-cols-2 gap-10 text-center">
          <div className="border-t border-slate-500 pt-2"><p className="font-semibold">Aceptada, firma y/o sello</p><p className="mt-1">Cliente</p></div>
          <div className="border-t border-slate-500 pt-2"><p className="font-semibold">{issuedBy}</p><p className="mt-1">Emitido por RGR Taller</p></div>
        </div>
      </footer>
      <button type="button" onClick={() => window.print()} className="no-print mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700"><Printer size={15} /> Imprimir / Guardar PDF</button>
    </article>
  )
}

export default QuotationPDFTemplate
