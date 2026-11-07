import { BarChart3, CalendarDays, Filter } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyMetric } from '../data/mockMetrics'
import { useDemoData } from '../contexts/useDemoData'
import { orderWorkshopMinutes } from '../data/mockReports'

type MetricKey = Exclude<keyof MonthlyMetric, 'month'>
type MetricTab = 'principal' | 'ventas' | 'general' | 'satisfaccion'

type ChartDefinition = {
  title: string
  description: string
  dataKey: MetricKey
  color: string
  format: (value: number) => string
}

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 0,
})
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const monthFormatter = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit', timeZone: 'UTC' })

const principalCharts: ChartDefinition[] = [
  { title: 'Horas hombre vendidas', description: 'Horas facturadas por mes', dataKey: 'hoursSold', color: '#3b82f6', format: (value) => `${number.format(value)} h` },
  { title: 'Vehículos atendidos', description: 'Unidades atendidas por mes', dataKey: 'vehiclesAttended', color: '#facc15', format: (value) => number.format(value) },
  { title: 'Ticket promedio servicio', description: 'Venta promedio por orden', dataKey: 'averageServiceTicket', color: '#60a5fa', format: (value) => currency.format(value) },
  { title: 'Utilización de capacidad productiva', description: 'Porcentaje de capacidad utilizada', dataKey: 'capacityUtilization', color: '#a3e635', format: (value) => `${number.format(value)}%` },
  { title: 'Garantías', description: 'Servicios que regresaron por garantía', dataKey: 'warrantyRate', color: '#f87171', format: (value) => `${number.format(value)}%` },
  { title: 'Tiempo promedio de permanencia', description: 'Tiempo promedio del vehículo en taller', dataKey: 'averageStayHours', color: '#cbd5e1', format: (value) => `${number.format(value)} h` },
]

const salesCharts: ChartDefinition[] = [
  { title: 'Ventas totales', description: 'Ingresos mensuales del taller', dataKey: 'totalSales', color: '#3b82f6', format: (value) => currency.format(value) },
  { title: 'Ventas de mano de obra', description: 'Ingresos por servicios de mano de obra', dataKey: 'laborSales', color: '#60a5fa', format: (value) => currency.format(value) },
  { title: 'Ventas de repuestos e insumos', description: 'Ingresos por repuestos e insumos', dataKey: 'partsSales', color: '#3b82f6', format: (value) => currency.format(value) },
  { title: 'Ventas de servicios externos', description: 'Ingresos por servicios tercerizados', dataKey: 'externalServiceSales', color: '#a3e635', format: (value) => currency.format(value) },
  { title: 'Utilidad de repuestos e insumos', description: 'Utilidad mensual en repuestos e insumos', dataKey: 'partsProfit', color: '#fb923c', format: (value) => currency.format(value) },
  { title: 'Rentabilidad de repuestos e insumos', description: 'Rentabilidad mensual sobre ventas de repuestos', dataKey: 'partsProfitability', color: '#f97316', format: (value) => `${number.format(value)}%` },
  { title: 'Utilidad de servicios externos', description: 'Utilidad mensual en servicios externos', dataKey: 'externalServiceProfit', color: '#4ade80', format: (value) => currency.format(value) },
]

const tabs: { id: MetricTab; label: string; enabled: boolean }[] = [
  { id: 'principal', label: 'PRINCIPAL', enabled: true },
  { id: 'general', label: 'GENERAL', enabled: false },
  { id: 'ventas', label: 'VENTAS', enabled: true },
  { id: 'satisfaccion', label: 'SATISFACCIÓN DEL CLIENTE', enabled: false },
]

function monthLabel(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`)).replace('.', '')
}

function metricsForPeriod(orders: ReturnType<typeof useDemoData>['orders'], start: string, end: string): MonthlyMetric[] {
  const metrics = new Map<string, MonthlyMetric>()
  const startDate = new Date(`${start}-01T00:00:00Z`)
  const endDate = new Date(`${end}-01T00:00:00Z`)
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const month = cursor.toISOString().slice(0, 7)
    metrics.set(month, {
      month,
      hoursSold: 0,
      vehiclesAttended: 0,
      averageServiceTicket: 0,
      capacityUtilization: 0,
      warrantyRate: 0,
      averageStayHours: 0,
      totalSales: 0,
      laborSales: 0,
      partsSales: 0,
      externalServiceSales: 0,
      partsProfit: 0,
      partsProfitability: 0,
      externalServiceProfit: 0,
    })
  }

  const ordersByMonth = new Map<string, typeof orders>()
  for (const order of orders) {
    const month = order.dateISO?.slice(0, 7)
    if (!month || !metrics.has(month)) continue
    const monthlyOrders = ordersByMonth.get(month) ?? []
    monthlyOrders.push(order)
    ordersByMonth.set(month, monthlyOrders)
  }

  for (const [month, monthlyOrders] of ordersByMonth) {
    const row = metrics.get(month)
    if (!row) continue
    const billedOrders = monthlyOrders.filter((order) => order.invoiced)
    const partItems = billedOrders.flatMap((order) => order.quoteItems ?? [])
      .filter((item) => item.type === 'Repuesto' || item.type === 'Insumo')
    const externalItems = billedOrders.flatMap((order) => order.quoteItems ?? [])
      .filter((item) => item.type === 'Servicio Compuesto')
    row.vehiclesAttended = monthlyOrders.length
    row.hoursSold = billedOrders.flatMap((order) => order.quoteItems ?? [])
      .filter((item) => item.type === 'Mano de obra')
      .reduce((sum, item) => sum + (item.laborHours ?? item.quantity), 0)
    row.totalSales = billedOrders.reduce((sum, order) => sum + (order.invoiceTotal ?? 0), 0)
    row.averageServiceTicket = billedOrders.length ? row.totalSales / billedOrders.length : 0
    row.laborSales = billedOrders.flatMap((order) => order.quoteItems ?? [])
      .filter((item) => item.type === 'Mano de obra')
      .reduce((sum, item) => sum + item.price * item.quantity, 0)
    row.partsSales = partItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    row.partsProfit = partItems.reduce((sum, item) => sum + (item.price - item.cost) * item.quantity, 0)
    row.partsProfitability = row.partsSales ? row.partsProfit / row.partsSales * 100 : 0
    row.externalServiceSales = externalItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    row.externalServiceProfit = externalItems.reduce((sum, item) => sum + (item.price - item.cost) * item.quantity, 0)
    const completedDurations = monthlyOrders
      .filter((order) => order.status === 'Entrega' || order.status === 'Archivados')
      .map((order) => orderWorkshopMinutes(order))
      .filter((duration): duration is number => duration !== null)
    row.averageStayHours = completedDurations.length
      ? completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length / 60
      : 0
  }

  return [...metrics.values()]
}

function compactChartLabel(chart: ChartDefinition, value: number) {
  const formatted = chart.format(value)
  if (!formatted.startsWith('S/')) return formatted
  return value >= 1000 ? `${number.format(value / 1000)}k` : number.format(value)
}

function MetricsView() {
  const { orders } = useDemoData()
  const serviceOrders = useMemo(() => orders.filter((order) => !order.convertedToOrderId), [orders])
  const [activeTab, setActiveTab] = useState<MetricTab>('principal')
  const [startDate, setStartDate] = useState('2025-12-01')
  const [endDate, setEndDate] = useState('2026-11-30')
  const [appliedRange, setAppliedRange] = useState({ start: '2025-12', end: '2026-11' })
  const [dateError, setDateError] = useState('')

  const filteredMetrics = useMemo(
    () => metricsForPeriod(serviceOrders, appliedRange.start, appliedRange.end),
    [serviceOrders, appliedRange],
  )

  const applyDateFilter = () => {
    if (!startDate || !endDate) {
      setDateError('Selecciona una fecha de inicio y una fecha de fin.')
      return
    }
    if (startDate > endDate) {
      setDateError('La fecha de inicio no puede ser posterior a la fecha de fin.')
      return
    }
    setDateError('')
    setAppliedRange({ start: startDate.slice(0, 7), end: endDate.slice(0, 7) })
  }

  const charts = activeTab === 'ventas' ? salesCharts : principalCharts

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lime-400/25 bg-lime-400/10 text-lime-300">
            <BarChart3 size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Métricas</h1>
            <p className="mt-1 text-xs text-slate-400">Inteligencia de negocio · Rendimiento del taller</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Fecha inicio</span>
            <span className="relative block">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Fecha Inicio" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-lime-400/60" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Fecha fin</span>
            <span className="relative block">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Fecha Fin" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-lime-400/60" />
            </span>
          </label>
          <button type="button" onClick={applyDateFilter} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-[10px] font-extrabold tracking-wide text-slate-950 transition hover:bg-lime-300">
            <Filter size={14} /> FILTRAR
          </button>
        </div>
      </header>

      {dateError && <p role="alert" className="text-xs font-medium text-red-300">{dateError}</p>}

      <nav aria-label="Secciones de métricas" className="flex gap-1 overflow-x-auto border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={!tab.enabled}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            title={tab.enabled ? undefined : 'Próximamente'}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-[10px] font-extrabold tracking-wide transition ${
              activeTab === tab.id
                ? 'border-lime-400 text-lime-300'
                : tab.enabled
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'cursor-not-allowed border-transparent text-slate-600'
            }`}
          >
            {tab.label}
            {!tab.enabled && <span className="ml-2 text-[8px] font-medium normal-case tracking-normal">Próximamente</span>}
          </button>
        ))}
      </nav>

      {serviceOrders.length === 0 || filteredMetrics.every((metric) => metric.vehiclesAttended === 0) ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-16 text-center">
          <p className="text-sm font-bold text-slate-200">No hay datos para el periodo seleccionado</p>
          <p className="mt-2 text-xs text-slate-400">Se actualizarán automáticamente al registrar órdenes y facturas en la base de datos.</p>
        </div>
      ) : (
        <section aria-label={activeTab === 'ventas' ? 'Métricas de ventas' : 'Métricas principales'} className="grid gap-5 md:grid-cols-2">
          {charts.map((chart, index) => (
            <MetricChart
              key={chart.dataKey}
              chart={chart}
              data={filteredMetrics}
              wide={index === 0}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function MetricChart({ chart, data, wide }: { chart: ChartDefinition; data: MonthlyMetric[]; wide: boolean }) {
  return (
    <article className={`min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:p-5 ${wide ? 'md:col-span-2' : ''}`}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-100">{chart.title}</h2>
        <p className="mt-1 text-[10px] text-slate-400">{chart.description}</p>
      </div>
      <div className="h-[270px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={wide ? 60 : 48}
              tickFormatter={(value: number) => chart.format(value)}
            />
            <Tooltip
              cursor={{ fill: '#1e293b', opacity: 0.45 }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 10, color: '#f8fafc', fontSize: 11 }}
              labelStyle={{ color: '#cbd5e1', marginBottom: 4, textTransform: 'capitalize' }}
              labelFormatter={(label) => monthLabel(String(label))}
              formatter={(value) => [chart.format(Number(value)), chart.title]}
            />
            <Bar dataKey={chart.dataKey} fill={chart.color} radius={[4, 4, 0, 0]} maxBarSize={wide ? 46 : 36}>
              <LabelList
                dataKey={chart.dataKey}
                position="top"
                formatter={(value) => compactChartLabel(chart, Number(value))}
                fill="#cbd5e1"
                fontSize={8}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

export default MetricsView
