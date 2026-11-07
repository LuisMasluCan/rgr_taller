import { ArrowDownLeft, ArrowUpRight, Banknote, Clock3, FileDown, FileSpreadsheet, Plus, Wallet, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useDemoData } from '../contexts/useDemoData'
import NumericInput from '../components/NumericInput'
import type { CashMovement, ClosedCashSession } from '../types'
import { exportToExcel, exportToPdf, type ExportCell } from '../utils/exportUtils'

type ModalMode = 'open' | 'income' | 'expense' | 'close' | null

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const formatTime = (timestamp: string) => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
const formatDateTime = (timestamp: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
const fieldClass = 'mt-1.5 h-11 w-full rounded-lg border border-slate-700 px-3 text-sm text-slate-300 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30'

function CashRegisterView() {
  const { cashRegister, setCashRegister, closedSessions, setClosedSessions, orders, activeProfile } = useDemoData()
  const [modal, setModal] = useState<ModalMode>(null)
  const [detailSession, setDetailSession] = useState<ClosedCashSession | null>(null)
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<CashMovement['expenseCategory']>('Gasto General del Taller')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [observations, setObservations] = useState('')
  const [lastCloseObservations, setLastCloseObservations] = useState('')
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')

  const totals = useMemo(() => {
    const incomes = cashRegister?.movements
      .filter((movement) => movement.type === 'Ingreso')
      .reduce((total, movement) => total + movement.amount, 0) ?? 0
    const expenses = cashRegister?.movements
      .filter((movement) => movement.type === 'Egreso')
      .reduce((total, movement) => total + movement.amount, 0) ?? 0
    return {
      incomes,
      expenses,
      expected: (cashRegister?.initialAmount ?? 0) + incomes - expenses,
    }
  }, [cashRegister])
  const activeOrders = useMemo(
    () => orders.filter((order) => !order.convertedToOrderId && order.status !== 'Archivados'),
    [orders],
  )

  const openModal = (mode: Exclude<ModalMode, null>) => {
    setAmount('')
    setConcept('')
    setExpenseCategory('Gasto General del Taller')
    setSelectedOrderId('')
    setObservations('')
    setError('')
    setModal(mode)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0 ||
        ((modal === 'income' || modal === 'expense') && value <= 0)) {
      setError(modal === 'open' ? 'Ingresa un monto inicial válido.' : 'Ingresa un monto válido.')
      return
    }
    if (modal === 'expense' && expenseCategory === 'Asociado a Orden de Servicio' &&
        !activeOrders.some((order) => order.id === selectedOrderId)) {
      setError('Selecciona una orden de servicio activa.')
      return
    }

    if (modal === 'open') {
      setCashRegister({ openedAt: new Date().toISOString(), initialAmount: value, movements: [] })
      setLastCloseObservations('')
    } else if (modal === 'income' || modal === 'expense') {
      const movement: CashMovement = {
        id: `cash-movement-${Date.now()}`,
        type: modal === 'income' ? 'Ingreso' : 'Egreso',
        concept: concept.trim(),
        amount: value,
        timestamp: new Date().toISOString(),
        ...(modal === 'expense' ? {
          expenseCategory,
          ...(expenseCategory === 'Asociado a Orden de Servicio' ? { orderId: selectedOrderId } : {}),
        } : {}),
      }
      setCashRegister((current) => current ? { ...current, movements: [...current.movements, movement] } : current)
    } else if (modal === 'close') {
      if (!cashRegister) {
        setError('No hay una caja abierta para cerrar.')
        return
      }
      const closedAt = new Date().toISOString()
      const actualBalance = value
      const closedSession: ClosedCashSession = {
        id: `closed-cash-${Date.now()}`,
        openedAt: cashRegister.openedAt,
        closedAt,
        closedBy: activeProfile,
        initialAmount: cashRegister.initialAmount,
        totalIncomes: totals.incomes,
        totalExpenses: totals.expenses,
        expectedBalance: totals.expected,
        actualBalance,
        difference: actualBalance - totals.expected,
        observations: observations.trim(),
        movements: cashRegister.movements,
      }
      setClosedSessions((current) => [closedSession, ...current])
      setCashRegister(null)
      setLastCloseObservations(observations.trim())
    }
    setModal(null)
  }

  const difference = amount.trim() === '' ? null : Number(amount) - totals.expected
  const closedSessionColumns = ['Fecha y Hora de Cierre', 'Usuario que cerró', 'Monto Inicial', 'Total Ingresos', 'Total Egresos', 'Saldo Esperado', 'Saldo Real', 'Diferencia']
  const closedSessionRows: ExportCell[][] = closedSessions.map((session) => [
    formatDateTime(session.closedAt),
    session.closedBy,
    currency.format(session.initialAmount),
    currency.format(session.totalIncomes),
    currency.format(session.totalExpenses),
    currency.format(session.expectedBalance),
    currency.format(session.actualBalance),
    session.difference === 0
      ? currency.format(0)
      : `${session.difference < 0 ? 'Faltante' : 'Sobrante'} ${currency.format(Math.abs(session.difference))}`,
  ])
  const runExport = async (exporter: () => Promise<void>) => {
    setExportError('')
    try {
      await exporter()
    } catch (exportException) {
      console.error('No se pudo exportar el historial de cajas cerradas.', exportException)
      setExportError('No se pudo generar el archivo. Inténtalo nuevamente.')
    }
  }
  const modalTitle = modal === 'open'
    ? 'Abrir caja'
    : modal === 'income'
      ? 'Registrar ingreso'
      : modal === 'expense'
        ? 'Registrar egreso'
        : 'Cierre de caja'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-100">Caja</h2>
      </div>

      {!cashRegister ? (
        <section className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-5 py-10 text-center shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lime-950/30 text-lime-300"><Wallet size={29} /></div>
          <h3 className="mt-5 text-lg font-bold text-slate-100">No hay una caja abierta actualmente</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">Abre una caja para comenzar a registrar ingresos y egresos del día.</p>
          {lastCloseObservations && <p className="mt-4 max-w-md rounded-lg bg-slate-800 px-4 py-3 text-left text-xs text-slate-400"><strong className="text-slate-200">Observaciones del último cierre:</strong> {lastCloseObservations}</p>}
          <button onClick={() => openModal('open')} className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-lime-300 px-7 text-sm font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400">
            <Plus size={18} /> ABRIR CAJA
          </button>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg sm:p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Actual en Caja</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-100">{currency.format(totals.expected)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><Clock3 size={13} /> Abierta a las {formatTime(cashRegister.openedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openModal('income')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-lime-400"><ArrowDownLeft size={15} /> Registrar Ingreso</button>
              <button onClick={() => openModal('expense')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-700"><ArrowUpRight size={15} /> Registrar Egreso</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div><h3 className="text-sm font-bold text-slate-100">Historial de Movimientos del Día</h3><p className="mt-1 text-[11px] text-slate-400">{cashRegister.movements.length} movimientos registrados</p></div>
              <span className="rounded-full bg-lime-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-300">Caja abierta</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr><th className="px-5 py-3">Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Vinculación</th><th className="px-5 py-3 text-right">Monto</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashRegister.movements.map((movement) => (
                    <tr key={movement.id} className="text-xs text-slate-400">
                      <td className="px-5 py-4 tabular-nums">{formatTime(movement.timestamp)}</td>
                      <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${movement.type === 'Ingreso' ? 'bg-lime-950/30 text-lime-300' : 'bg-rose-950/30 text-rose-200'}`}>{movement.type === 'Ingreso' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}{movement.type}</span></td>
                      <td className="px-4 py-4 font-medium text-slate-300">{movement.concept}</td>
                      <td className="px-4 py-4 text-slate-400">{movement.orderId ? `#${movement.orderId}` : 'Taller'}</td>
                      <td className={`px-5 py-4 text-right font-bold tabular-nums ${movement.type === 'Ingreso' ? 'text-emerald-300' : 'text-rose-300'}`}>{movement.type === 'Ingreso' ? '+' : '-'}{currency.format(movement.amount)}</td>
                    </tr>
                  ))}
                  {cashRegister.movements.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-xs text-slate-400">Aún no hay movimientos registrados en esta caja.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-800 p-4">
              <button onClick={() => openModal('close')} className="h-10 rounded-lg bg-slate-900 px-5 text-xs font-extrabold tracking-wide text-white transition hover:bg-slate-800">CERRAR CAJA</button>
            </div>
          </section>
        </>
      )}

      {!cashRegister && (
        <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Historial de Cajas Cerradas</h3>
              <p className="mt-1 text-[11px] text-slate-400">{closedSessions.length} cierre(s) registrados</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void runExport(() => exportToPdf(closedSessionRows, closedSessionColumns, 'Historial de Cajas Cerradas'))}
                disabled={!closedSessions.length}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown size={14} /> Exportar PDF
              </button>
              <button
                onClick={() => void runExport(() => exportToExcel(closedSessionRows, closedSessionColumns, 'Historial de Cajas Cerradas'))}
                disabled={!closedSessions.length}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-800 px-3.5 text-xs font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet size={14} /> Exportar Excel
              </button>
            </div>
          </div>
          {exportError && <p role="alert" className="border-b border-rose-900/50 bg-rose-950/30 px-5 py-2.5 text-xs font-medium text-rose-200">{exportError}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora de Cierre</th>
                  <th className="px-4 py-3">Usuario que cerró</th>
                  <th className="px-4 py-3 text-right">Monto Inicial</th>
                  <th className="px-4 py-3 text-right">Total Ingresos</th>
                  <th className="px-4 py-3 text-right">Total Egresos</th>
                  <th className="px-4 py-3 text-right">Saldo Esperado</th>
                  <th className="px-4 py-3 text-right">Saldo Real</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closedSessions.map((session) => (
                  <tr key={session.id} className="text-xs text-slate-400 transition hover:bg-slate-900/70">
                    <td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatDateTime(session.closedAt)}</td>
                    <td className="px-4 py-4 font-medium text-slate-300">{session.closedBy}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{currency.format(session.initialAmount)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-emerald-300">{currency.format(session.totalIncomes)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-rose-300">{currency.format(session.totalExpenses)}</td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-200">{currency.format(session.expectedBalance)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{currency.format(session.actualBalance)}</td>
                    <td className={`px-4 py-4 text-right font-bold tabular-nums ${session.difference === 0 ? 'text-slate-400' : session.difference < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {session.difference === 0
                        ? currency.format(0)
                        : `${session.difference < 0 ? 'Faltante' : 'Sobrante'} ${currency.format(Math.abs(session.difference))}`}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button onClick={() => setDetailSession(session)} className="whitespace-nowrap rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800">Ver Detalle</button>
                    </td>
                  </tr>
                ))}
                {closedSessions.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-xs text-slate-400">Todavía no hay cajas cerradas para mostrar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="cash-modal-title" className={`w-full rounded-xl bg-slate-900 shadow-xl ${modal === 'close' || modal === 'expense' ? 'max-w-lg' : 'max-w-md'}`}>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2"><Banknote size={18} className="text-lime-300" /><h3 id="cash-modal-title" className="text-sm font-bold text-slate-100">{modalTitle}</h3></div>
              <button aria-label="Cerrar modal" onClick={() => setModal(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-300"><X size={17} /></button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              {modal === 'close' && (
                <div className="space-y-2 rounded-lg bg-slate-800 p-4 text-xs">
                  <SummaryRow label="Monto Inicial" amount={cashRegister ? currency.format(cashRegister.initialAmount) : currency.format(0)} />
                  <SummaryRow label="Total Ingresos del día" amount={currency.format(totals.incomes)} positive />
                  <SummaryRow label="Total Egresos del día" amount={currency.format(totals.expenses)} negative />
                  <div className="mt-2 border-t border-slate-700 pt-3"><SummaryRow label="Saldo Esperado" amount={currency.format(totals.expected)} strong /></div>
                </div>
              )}

              {modal === 'open' && (
                <label className="block text-xs font-semibold text-slate-300">Monto Inicial en Efectivo
                  <NumericInput autoFocus required min="0" step="0.01" value={amount} onChange={setAmount} placeholder="100.00" className={fieldClass} />
                </label>
              )}
              {modal === 'income' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">Concepto
                    <input autoFocus required value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. Pago de servicio" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Monto
                    <NumericInput required min="0.01" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                </>
              )}
              {modal === 'expense' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">Monto (S/)
                    <NumericInput autoFocus required min="0.01" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Concepto
                    <input required value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. Compra de aceite 15W40" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Tipo de Gasto
                    <select
                      value={expenseCategory}
                      onChange={(event) => {
                        const nextCategory = event.target.value
                        if (nextCategory === 'Gasto General del Taller' || nextCategory === 'Asociado a Orden de Servicio') {
                          setExpenseCategory(nextCategory)
                        }
                        setSelectedOrderId('')
                      }}
                      className={fieldClass}
                    >
                      <option value="Gasto General del Taller">Gasto General del Taller</option>
                      <option value="Asociado a Orden de Servicio">Asociado a Orden de Servicio</option>
                    </select>
                  </label>
                  {expenseCategory === 'Asociado a Orden de Servicio' && (
                    <label className="block text-xs font-semibold text-slate-300">Vincular Orden
                      <select
                        required
                        value={selectedOrderId}
                        onChange={(event) => setSelectedOrderId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Selecciona una orden activa</option>
                        {activeOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            #{order.id} - {order.vehicle.make} {order.vehicle.model} - Placa {order.vehicle.plate}
                          </option>
                        ))}
                      </select>
                      {activeOrders.length === 0 && <span className="mt-1.5 block text-[11px] font-medium text-rose-300">No hay órdenes activas disponibles.</span>}
                    </label>
                  )}
                </>
              )}
              {modal === 'close' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">Monto Real Contado en Caja
                    <NumericInput autoFocus required min="0" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                  {difference !== null && Number.isFinite(difference) && (
                    <p className={`rounded-lg px-3 py-2.5 text-xs font-bold ${difference < 0 ? 'bg-rose-950/30 text-rose-200' : difference > 0 ? 'bg-emerald-950/30 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                      {difference < 0 ? `Faltante: ${currency.format(Math.abs(difference))}` : difference > 0 ? `Sobrante: ${currency.format(difference)}` : `Sin diferencia: ${currency.format(0)}`}
                    </p>
                  )}
                  <label className="block text-xs font-semibold text-slate-300">Observaciones
                    <textarea rows={3} value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Notas sobre el cuadre de caja..." className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30" />
                  </label>
                </>
              )}
              {error && <p role="alert" className="text-xs font-medium text-rose-300">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancelar</button>
                <button type="submit" className={`rounded-lg px-5 py-2.5 text-xs font-extrabold transition ${modal === 'expense' ? 'bg-rose-600 text-white hover:bg-rose-700' : modal === 'close' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-lime-400 text-slate-950 hover:bg-lime-500'}`}>
                  {modal === 'open' ? 'Confirmar Apertura' : modal === 'income' ? 'Registrar Ingreso' : modal === 'expense' ? 'Guardar Egreso' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailSession(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="closed-session-title" className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 id="closed-session-title" className="text-sm font-bold text-slate-100">Detalle de Caja Cerrada</h3>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(detailSession.closedAt)} · {detailSession.closedBy}</p>
              </div>
              <button aria-label="Cerrar detalle" onClick={() => setDetailSession(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-300"><X size={17} /></button>
            </div>
            <div className="max-h-[calc(90vh-70px)] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SummaryRow label="Monto Inicial" amount={currency.format(detailSession.initialAmount)} />
                <SummaryRow label="Total Ingresos" amount={currency.format(detailSession.totalIncomes)} positive />
                <SummaryRow label="Total Egresos" amount={currency.format(detailSession.totalExpenses)} negative />
                <SummaryRow label="Saldo Esperado" amount={currency.format(detailSession.expectedBalance)} strong />
                <SummaryRow label="Saldo Real" amount={currency.format(detailSession.actualBalance)} strong />
                <SummaryRow
                  label="Diferencia"
                  amount={detailSession.difference === 0
                    ? currency.format(0)
                    : `${detailSession.difference < 0 ? 'Faltante' : 'Sobrante'} ${currency.format(Math.abs(detailSession.difference))}`}
                  negative={detailSession.difference < 0}
                  positive={detailSession.difference > 0}
                />
              </div>
              {detailSession.observations && (
                <p className="rounded-lg bg-slate-800 px-4 py-3 text-xs text-slate-400"><strong className="text-slate-200">Observaciones:</strong> {detailSession.observations}</p>
              )}
              <div className="overflow-hidden rounded-lg border border-slate-700">
                <div className="border-b border-slate-800 px-4 py-3">
                  <h4 className="text-xs font-bold text-slate-200">Movimientos de la caja</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Vinculación</th><th className="px-4 py-3 text-right">Monto</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailSession.movements.map((movement) => (
                        <tr key={movement.id} className="text-xs text-slate-400">
                          <td className="px-4 py-3 tabular-nums">{formatDateTime(movement.timestamp)}</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${movement.type === 'Ingreso' ? 'bg-lime-950/30 text-lime-300' : 'bg-rose-950/30 text-rose-200'}`}>{movement.type}</span></td>
                          <td className="px-4 py-3">{movement.concept}</td>
                          <td className="px-4 py-3">{movement.orderId ? `#${movement.orderId}` : 'Taller'}</td>
                          <td className={`px-4 py-3 text-right font-semibold tabular-nums ${movement.type === 'Ingreso' ? 'text-emerald-300' : 'text-rose-300'}`}>{movement.type === 'Ingreso' ? '+' : '-'}{currency.format(movement.amount)}</td>
                        </tr>
                      ))}
                      {detailSession.movements.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Esta caja no registró movimientos.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, amount, positive = false, negative = false, strong = false }: { label: string; amount: string; positive?: boolean; negative?: boolean; strong?: boolean }) {
  return <div className={`flex items-center justify-between ${strong ? 'text-sm font-extrabold text-slate-100' : 'text-xs'} ${positive ? 'text-emerald-300' : negative ? 'text-rose-300' : strong ? '' : 'text-slate-400'}`}><span>{label}</span><span className="tabular-nums">{amount}</span></div>
}

export default CashRegisterView
