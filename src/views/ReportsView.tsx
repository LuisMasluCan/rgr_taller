import {
  BadgeDollarSign,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Clock3,
  FileDown,
  FileSpreadsheet,
  Search,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDemoData } from '../contexts/useDemoData'
import { formatDuration, getStageAverages, orderCost, orderTotal, orderWorkshopMinutes } from '../data/mockReports'
import { exportToExcel, exportToPdf, type ExportCell } from '../utils/exportUtils'

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const reportTitles: Record<string, string> = {
  sales: 'Ventas Generales',
  items: 'Ventas Por Ítems',
  operations: 'Operaciones',
  profitability: 'Rentabilidades',
  technicians: 'Técnicos',
}
const defaultMonth = new Date().toISOString().slice(0, 7)

function ReportsView() {
  const { reportId = 'sales' } = useParams()
  const report = reportTitles[reportId] ? reportId : 'sales'
  const { orders } = useDemoData()
  const serviceOrders = useMemo(() => orders.filter((order) => !order.convertedToOrderId), [orders])
  const [query, setQuery] = useState('')
  const [exportError, setExportError] = useState('')
  const [month, setMonth] = useState(() => {
    const latestInvoiceDate = serviceOrders.filter((order) => order.invoiced)
      .map((order) => order.dateISO ?? '')
      .sort((left, right) => right.localeCompare(left))[0]
    return latestInvoiceDate ? latestInvoiceDate.slice(0, 7) : defaultMonth
  })
  const invoicedOrders = useMemo(() => serviceOrders.filter((order) => order.invoiced), [serviceOrders])
  const monthlyOrders = invoicedOrders.filter((order) => !month || (order.dateISO ?? '').startsWith(month))
  const filteredSales = invoicedOrders.filter((order) => {
    const searchText = `${order.id} ${order.customer}`.toLowerCase()
    return searchText.includes(query.toLowerCase()) && (!month || (order.dateISO ?? '').startsWith(month))
  })
  const monthlySales = monthlyOrders.reduce((sum, order) => sum + orderTotal(order), 0)
  const stageAverages = getStageAverages(serviceOrders)
  const itemRows = useMemo(() => {
    const types = ['Mano de obra', 'Repuesto', 'Insumo'] as const
    return types.map((type) => {
      const items = invoicedOrders.flatMap((order) => order.quoteItems ?? []).filter((item) => item.type === type)
      const sales = items.reduce((sum, item) => {
        const base = item.price * item.quantity * (1 - item.discount / 100)
        return sum + base + base * item.taxRate / 100
      }, 0)
      return { type, quantity: items.reduce((sum, item) => sum + item.quantity, 0), sales }
    })
  }, [invoicedOrders])
  const technicians = useMemo(() => {
    const names = new Set(serviceOrders.map((order) => order.technician).filter(Boolean))
    return [...names].map((name) => {
      const assigned = serviceOrders.filter((order) => order.technician === name)
      const durations = assigned.map((order) => orderWorkshopMinutes(order)).filter((duration): duration is number => duration !== null)
      const billed = assigned.filter((order) => order.invoiced).reduce((sum, order) => sum + orderTotal(order), 0)
      return {
        name,
        vehicles: assigned.length,
        averageMinutes: durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null,
        billed,
      }
    }).filter((technician) => technician.name.toLowerCase().includes(query.toLowerCase()))
  }, [serviceOrders, query])

  const profitability = invoicedOrders.filter((order) =>
    `${order.id} ${order.customer}`.toLowerCase().includes(query.toLowerCase()),
  )
  const exportTitle = `Reporte de ${reportTitles[report]}`
  const exportColumns: string[] = report === 'sales'
    ? ['Fecha', 'Consecutivo', 'Cliente', 'Total facturado', 'Estado']
    : report === 'items'
      ? ['Categoría', 'Cantidad', 'Total vendido', 'Participación']
      : report === 'operations'
        ? ['Etapa', 'Tiempo promedio', 'Órdenes']
        : report === 'profitability'
          ? ['Consecutivo', 'Cliente', 'Costo total', 'Venta total', 'Ganancia', 'Rentabilidad']
          : ['Nombre del técnico', 'Vehículos atendidos', 'Tiempo promedio por vehículo', 'Total facturado']
  const exportData: ExportCell[][] = report === 'sales'
    ? filteredSales.map((order) => {
      const total = orderTotal(order)
      const paid = (order.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
      return [order.date, `#${order.id}`, order.customer, currency.format(total), paid >= total ? 'Pagado' : 'Pendiente']
    })
    : report === 'items'
      ? itemRows.map((item) => {
        const total = itemRows.reduce((sum, row) => sum + row.sales, 0)
        const percentage = total ? item.sales / total * 100 : 0
        return [item.type, item.quantity, currency.format(item.sales), `${percentage.toFixed(0)}%`]
      })
      : report === 'operations'
        ? stageAverages.map((stage) => [stage.label, formatDuration(stage.averageMinutes), stage.samples])
        : report === 'profitability'
          ? profitability.map((order) => {
            const cost = orderCost(order)
            const total = orderTotal(order)
            const gain = total - cost
            const margin = total ? gain / total * 100 : 0
            return [`#${order.id}`, order.customer, currency.format(cost), currency.format(total), currency.format(gain), `${margin.toFixed(1)}%`]
          })
          : technicians.map((technician) => [
            technician.name,
            technician.vehicles,
            formatDuration(technician.averageMinutes),
            currency.format(technician.billed),
          ])
  const runExport = async (exporter: () => Promise<void>) => {
    setExportError('')
    try {
      await exporter()
    } catch (error) {
      console.error('No se pudo exportar el reporte.', error)
      setExportError('No se pudo generar el archivo. Inténtalo nuevamente.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mt-1 text-[11px] text-slate-400">Los datos se guardan localmente y no representan reportes contables oficiales.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-400">
            <CalendarDays size={14} />
            <span>Datos actuales del taller</span>
          </div>
          <button onClick={() => void runExport(() => exportToPdf(exportData, exportColumns, exportTitle))} className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700">
            <FileDown size={15} /> Exportar PDF
          </button>
          <button onClick={() => void runExport(() => exportToExcel(exportData, exportColumns, exportTitle))} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900">
            <FileSpreadsheet size={15} /> Exportar Excel
          </button>
        </div>
      </section>
      {exportError && <p role="alert" className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2.5 text-xs font-medium text-rose-200">{exportError}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <ReportTab href="/reports/sales" active={report === 'sales'}>Ventas Generales</ReportTab>
        <ReportTab href="/reports/items" active={report === 'items'}>Ventas Por Ítems</ReportTab>
        <ReportTab href="/reports/operations" active={report === 'operations'}>Operaciones</ReportTab>
        <ReportTab href="/reports/profitability" active={report === 'profitability'}>Rentabilidades</ReportTab>
        <ReportTab href="/reports/technicians" active={report === 'technicians'}>Técnicos</ReportTab>
      </div>

      {report === 'sales' && (
        <>
          <KpiCard title="Total vendido en el mes" value={currency.format(monthlySales)} detail={`${monthlyOrders.length} factura(s) en el periodo`} icon={<BadgeDollarSign size={19} />} />
          <ReportTable title="Ventas generales" description="Órdenes con factura emitida" tools={<><label className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar orden o cliente" className="h-9 w-full rounded-lg border border-slate-700 pl-8 pr-3 text-xs outline-none focus:border-slate-700 sm:w-48" /></label><input aria-label="Filtrar por mes" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 rounded-lg border border-slate-700 px-2 text-xs text-slate-400" /></>}>
            <thead><tr><Th>Fecha</Th><Th>Consecutivo</Th><Th>Cliente</Th><Th align="right">Total facturado</Th><Th>Estado</Th></tr></thead>
            <tbody>{filteredSales.map((order) => {
              const paid = (order.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
              const total = orderTotal(order)
              return <tr key={order.id}><Td>{order.date}</Td><Td strong>#{order.id}</Td><Td>{order.customer}</Td><Td align="right" strong>{currency.format(total)}</Td><Td><StatusBadge paid={paid >= total} /></Td></tr>
            })}{filteredSales.length === 0 && <tr><td colSpan={5}><EmptyState>No hay facturas para el periodo seleccionado.</EmptyState></td></tr>}</tbody>
          </ReportTable>
        </>
      )}

      {report === 'items' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {itemRows.map((item) => <KpiCard key={item.type} title={item.type} value={currency.format(item.sales)} detail={`${item.quantity} unidades/servicios facturados`} icon={item.type === 'Insumo' ? <Boxes size={19} /> : <ChartNoAxesColumnIncreasing size={19} />} />)}
          </div>
          <ReportTable title="Ventas por categoría" description="Distribución de los ítems incluidos en órdenes facturadas">
            <thead><tr><Th>Categoría</Th><Th>Cantidad</Th><Th align="right">Total vendido</Th><Th>Participación</Th></tr></thead>
            <tbody>{itemRows.map((item) => {
              const total = itemRows.reduce((sum, row) => sum + row.sales, 0)
              const percentage = total ? item.sales / total * 100 : 0
              return <tr key={item.type}><Td strong>{item.type}</Td><Td>{item.quantity}</Td><Td align="right" strong>{currency.format(item.sales)}</Td><Td><div className="flex min-w-32 items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-lime-400" style={{ width: `${percentage}%` }} /></div><span className="w-9 text-right text-[10px] text-slate-400">{percentage.toFixed(0)}%</span></div></Td></tr>
            })}</tbody>
          </ReportTable>
        </>
      )}

      {report === 'operations' && (
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg sm:p-6">
          <div className="mb-5 flex items-start justify-between"><div><h2 className="text-sm font-bold text-slate-100">Tiempo promedio por etapa</h2><p className="mt-1 text-[11px] text-slate-400">Promedio calculado con los cambios de estado registrados.</p></div><Clock3 size={19} className="text-blue-300" /></div>
          <div className="space-y-4">{stageAverages.map((stage) => {
            const max = Math.max(1, ...stageAverages.map((row) => row.averageMinutes ?? 0))
            return <div key={stage.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-300">Promedio en {stage.label}</span><span className="font-bold text-slate-100">{formatDuration(stage.averageMinutes)} <span className="font-normal text-slate-400">· {stage.samples} orden(es)</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${stage.averageMinutes === null ? 0 : Math.max(4, stage.averageMinutes / max * 100)}%` }} /></div></div>
          })}</div>
          {!orders.length && <EmptyState>Registra órdenes y cambios de etapa para calcular tiempos promedio.</EmptyState>}
        </section>
      )}

      {report === 'profitability' && (
        <ReportTable title="Rentabilidad por orden" description="Comparativa entre el costo registrado y el valor facturado" tools={<SearchInput value={query} onChange={setQuery} />}>
          <thead><tr><Th>Consecutivo</Th><Th>Cliente</Th><Th align="right">Costo total</Th><Th align="right">Venta total</Th><Th align="right">Ganancia</Th><Th align="right">Rentabilidad</Th></tr></thead>
          <tbody>{profitability.map((order) => {
            const cost = orderCost(order)
            const total = orderTotal(order)
            const gain = total - cost
            const margin = total ? gain / total * 100 : 0
            return <tr key={order.id}><Td strong>#{order.id}</Td><Td>{order.customer}</Td><Td align="right">{currency.format(cost)}</Td><Td align="right">{currency.format(total)}</Td><Td align="right" strong>{currency.format(gain)}</Td><Td align="right"><span className="rounded-full bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{margin.toFixed(1)}%</span></Td></tr>
          })}{profitability.length === 0 && <tr><td colSpan={6}><EmptyState>No hay órdenes facturadas para mostrar.</EmptyState></td></tr>}</tbody>
        </ReportTable>
      )}

      {report === 'technicians' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard title="Técnicos registrados" value={String(technicians.length)} detail="Personal con órdenes asignadas o perfil de técnico" icon={<Users size={19} />} />
            <KpiCard title="Vehículos atendidos" value={String(technicians.reduce((sum, technician) => sum + technician.vehicles, 0))} detail="Órdenes registradas por técnico" icon={<BriefcaseBusiness size={19} />} />
          </div>
          <ReportTable title="Rendimiento de técnicos" description="Atenciones, tiempo promedio por vehículo y ventas emitidas" tools={<SearchInput value={query} onChange={setQuery} />}>
            <thead><tr><Th>Nombre del técnico</Th><Th>Vehículos atendidos</Th><Th>Tiempo promedio por vehículo</Th><Th align="right">Total facturado</Th></tr></thead>
            <tbody>{technicians.map((technician) => <tr key={technician.name}><Td strong>{technician.name}</Td><Td>{technician.vehicles}</Td><Td>{formatDuration(technician.averageMinutes)}</Td><Td align="right" strong>{currency.format(technician.billed)}</Td></tr>)}</tbody>
          </ReportTable>
        </>
      )}
    </div>
  )
}

function ReportTab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return <Link to={href} className={`rounded-lg border px-3 py-3 text-center text-xs font-semibold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>{children}</Link>
}

function KpiCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-950/30 text-lime-300">{icon}</span></div><p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-100">{value}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p></section>
}

function ReportTable({ title, description, tools, children }: { title: string; description: string; tools?: React.ReactNode; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg"><div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:px-5"><div><h2 className="text-sm font-bold text-slate-100">{title}</h2><p className="mt-1 text-[11px] text-slate-400">{description}</p></div>{tools && <div className="flex flex-wrap gap-2">{tools}</div>}</div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs">{children}</table></div></section>
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`bg-slate-800 px-4 py-3 text-[9px] font-bold uppercase tracking-wide text-slate-400 ${align === 'right' ? 'text-right' : ''}`}>{children}</th>
}

function Td({ children, align = 'left', strong = false }: { children: React.ReactNode; align?: 'left' | 'right'; strong?: boolean }) {
  return <td className={`border-t border-slate-800 px-4 py-3.5 text-[11px] ${strong ? 'font-semibold text-slate-200' : 'text-slate-400'} ${align === 'right' ? 'text-right tabular-nums' : ''}`}>{children}</td>
}

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Buscar orden o cliente" className="h-9 w-full rounded-lg border border-slate-700 pl-8 pr-3 text-xs outline-none focus:border-slate-700 sm:w-48" /></label>
}

function StatusBadge({ paid }: { paid: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${paid ? 'bg-emerald-950/30 text-emerald-300' : 'bg-amber-950/30 text-amber-300'}`}>{paid ? 'Pagado' : 'Pendiente'}</span>
}

function EmptyState({ children }: { children: string }) {
  return <p className="mt-5 rounded-lg border border-dashed border-slate-700 bg-slate-800 p-4 text-center text-xs text-slate-400">{children}</p>
}

export default ReportsView
