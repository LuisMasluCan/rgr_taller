import { CalendarDays, CarFront, FileText, Gauge, Pencil, Search, ShieldCheck, UserRound, Wrench, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoData } from '../contexts/useDemoData'
import { orderStages } from '../data/orderStages'
import type { Order } from '../types'

const boardStages = orderStages.filter(({ name }) => name !== 'Archivados')
const stageLabels: Record<string, string> = {
  Recepción: 'RECEPCIÓN',
  Diagnóstico: 'DIAGNÓSTICO',
  Repuestos: 'REPUESTOS',
  Aprobación: 'APROBACIÓN',
  Reparación: 'REPARACIÓN',
  Control: 'CONTROL',
  Entrega: 'ENTREGA',
}

function DashboardView({ fullScreen = false }: { fullScreen?: boolean }) {
  const { orders } = useDemoData()
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (fullScreen) document.title = 'RGR Taller | Tablero de Control'
  }, [fullScreen])

  const boardOrders = orders

  const visibleOrders = useMemo(() => {
    const term = appliedQuery.trim().toLocaleLowerCase('es-PE')
    if (!term) return boardOrders
    return boardOrders.filter((order) =>
      `${order.id} ${order.customer} ${order.vehicle.make} ${order.vehicle.model} ${order.vehicle.plate} ${order.vehicle.vin} ${order.technician}`
        .toLocaleLowerCase('es-PE')
        .includes(term),
    )
  }, [appliedQuery, boardOrders])

  const selectedOrder = boardOrders.find((order) => order.id === selectedOrderId) ?? null
  const searchOrders = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppliedQuery(query)
  }

  const openOrderInOrdersView = (order: Order) => {
    const stage = boardStages.find(({ name }) => name === order.status)?.name ?? 'Entrega'
    navigate(`/orders?stage=${encodeURIComponent(stage)}`)
    setSelectedOrderId(null)
  }

  return (
    <div className={fullScreen ? 'flex h-screen min-h-screen w-full flex-col gap-5 bg-[#0B1120] p-4 text-white sm:p-6 lg:p-7' : 'space-y-6'}>
      <header className={`flex flex-col gap-5 ${fullScreen ? 'shrink-0' : ''}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300">Tablero de Control</p>
              <img src="/rgr-logo-transparente.png" alt="RGR Taller Automotriz" className="mt-1 h-auto w-64 sm:w-80" />
            </div>
          </div>
          {fullScreen && <button type="button" onClick={() => navigate('/dashboard')} className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-semibold text-slate-400 shadow-lg transition hover:border-slate-700 hover:bg-slate-800 sm:text-xs">Salir de Pantalla Completa</button>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="GARANTÍAS" value="0%" icon={<ShieldCheck size={17} />} />
          <MetricCard label="CITAS PARA HOY" value="0" icon={<CalendarDays size={17} />} />
          <MetricCard label="PUNTO DE EQUILIBRIO" value="0%" icon={<Gauge size={17} />} />
        </div>

        <form onSubmit={searchOrders} className="flex w-full rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-lg">
          <input
            aria-label="Buscar órdenes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por cliente, ods, placa o técnico"
            className="h-12 min-w-0 flex-1 rounded-lg bg-transparent px-4 text-sm text-slate-200 outline-none placeholder:text-slate-400"
          />
          <button type="submit" aria-label="Buscar" className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-lime-300 text-slate-950 transition hover:bg-lime-400">
            <Search size={20} />
          </button>
        </form>
      </header>

      <section aria-label="Tablero Kanban de órdenes" className={fullScreen ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">Órdenes de servicio</h3>
          <span className="text-[10px] font-semibold text-slate-400">{visibleOrders.length} órdenes</span>
        </div>
        <div className={fullScreen ? 'min-h-0 flex-1 overflow-x-auto pb-2' : '-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-7 sm:px-7 lg:-mx-9 lg:px-9'}>
          <div className={`flex min-w-max items-start gap-4 ${fullScreen ? 'h-full' : ''}`}>
            {boardStages.map(({ name }) => {
              const stageOrders = boardOrders.filter((order) => order.status === name)
              const matchingOrders = visibleOrders.filter((order) => order.status === name)
              return (
                <section key={name} aria-label={`${stageLabels[name]} ${stageOrders.length}`} className={`w-[278px] shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 ${fullScreen ? 'flex h-full flex-col' : ''}`}>
                  <header className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3.5 py-3">
                    <h4 className="text-[10px] font-extrabold tracking-wide text-slate-200">{stageLabels[name]}</h4>
                    <span className="text-[10px] font-bold text-lime-400">{stageOrders.length}</span>
                  </header>
                  <div className={`min-h-28 space-y-3 p-2.5 ${fullScreen ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}>
                    {matchingOrders.length ? matchingOrders.map((order) => (
                      <OrderCard key={order.id} order={order} onOpen={() => setSelectedOrderId(order.id)} />
                    )) : (
                      <p className="rounded-lg border border-dashed border-slate-700 px-3 py-5 text-center text-[10px] text-slate-400">
                        {stageOrders.length ? 'Sin coincidencias para esta búsqueda.' : 'Sin órdenes en esta fase.'}
                      </p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </section>

      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrderId(null)} onOpenOrder={() => openOrderInOrdersView(selectedOrder)} />}
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <section className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 shadow-lg">
      <div><p className="text-[9px] font-extrabold tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold text-white">{value}</p></div>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-900/40 text-lime-200">{icon}</span>
    </section>
  )
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  return (
    <article className="group relative rounded-lg border border-slate-700 bg-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:border-lime-400 hover:shadow-md">
      <button type="button" onClick={onOpen} className="block w-full rounded-lg p-3 pr-10 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500">
        <p className="text-[11px] font-extrabold text-slate-100">ODS #{order.id}</p>
        <div className="mt-2 space-y-2 text-[10px] leading-relaxed text-slate-400">
          <p className="flex items-start gap-1.5"><UserRound size={12} className="mt-0.5 shrink-0 text-slate-400" /><span><strong className="text-slate-200">Cliente:</strong> {order.customer}</span></p>
          <p className="flex items-start gap-1.5"><CarFront size={12} className="mt-0.5 shrink-0 text-slate-400" /><span><strong className="text-slate-200">Vehículo:</strong> {order.vehicle.make} {order.vehicle.model} · {order.vehicle.plate}<br /><span className="break-all text-[9px] text-slate-400">VIN: {order.vehicle.vin || 'No registrado'}</span></span></p>
          <p><strong className="text-slate-200">Motivo:</strong> {order.reason}</p>
          <p><strong className="text-slate-200">Comentarios:</strong> {order.comments || 'Sin comentarios'}</p>
          <p className="flex items-center gap-1.5"><Wrench size={12} className="text-slate-400" /><strong className="text-slate-200">Técnico:</strong> {order.technician || 'Por asignar'}</p>
        </div>
      </button>
      <button type="button" aria-label={`Editar o ver ODS ${order.id}`} onClick={onOpen} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-lime-900/40 hover:text-slate-100">
        <Pencil size={13} />
      </button>
    </article>
  )
}

function OrderDetailModal({ order, onClose, onOpenOrder }: { order: Order; onClose: () => void; onOpenOrder: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="dashboard-order-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="my-auto w-full max-w-xl rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{order.status}</p><h2 id="dashboard-order-title" className="mt-1 text-base font-extrabold text-slate-100">Orden de Servicio #{order.id}</h2></div>
          <button type="button" aria-label="Cerrar detalle" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
          <Detail label="Cliente" value={order.customer} />
          <Detail label="Teléfono" value={order.phone} />
          <Detail label="Vehículo" value={`${order.vehicle.make} ${order.vehicle.model} ${order.vehicle.year}`} />
          <Detail label="Placa / VIN" value={`${order.vehicle.plate} · ${order.vehicle.vin || 'No registrado'}`} />
          <Detail label="Motivo de ingreso" value={order.reason} />
          <Detail label="Técnico" value={order.technician || 'Por asignar'} />
          <Detail label="Comentarios" value={order.comments || 'Sin comentarios'} />
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">Cerrar</button>
          <button type="button" onClick={onOpenOrder} className="flex items-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400"><FileText size={14} /> Ir a etapa</button>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words font-medium leading-relaxed text-slate-200">{value}</p></div>
}

export default DashboardView
