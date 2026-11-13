import { ArrowDownLeft, ArrowUpRight, Banknote, Clock3, FileDown, FileSpreadsheet, Plus, Trash2, Wallet, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useDemoData } from '../contexts/useDemoData'
import NumericInput from '../components/NumericInput'
import type { CashMovement, ClosedCashSession } from '../types'
import CashClosureReport from './CashClosureReport'
import { getCashMovementOrderId } from '../utils/cashMovementOrder'
import { exportToExcel, type ExportCell } from '../utils/exportUtils'

type ModalMode = 'open' | 'income' | 'expense' | 'close' | null

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const usdCurrency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const formatTime = (timestamp: string) => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
const formatDateTime = (timestamp: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
const fieldClass = 'mt-1.5 h-11 w-full rounded-lg border border-slate-700 px-3 text-sm text-slate-300 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30'
const paymentMethods: NonNullable<CashMovement['paymentMethod']>[] = [
  'Efectivo',
  'Transferencia',
  'Yape',
  'Plin',
  'Tarjeta de crédito',
  'Tarjeta de débito',
]

function formatAmount(amount: number, cashCurrency: 'PEN' | 'USD' = 'PEN') {
  return (cashCurrency === 'USD' ? usdCurrency : currency).format(amount)
}

function formatBothCurrencies(penAmount: number, usdAmount: number) {
  return `${formatAmount(penAmount)} · ${formatAmount(usdAmount, 'USD')}`
}

function getPaymentBreakdown(movements: CashMovement[]) {
  return paymentMethods.map((method) => {
    const methodMovements = movements.filter((movement) => (movement.paymentMethod ?? 'Efectivo') === method)
    const sum = (type: CashMovement['type'], cashCurrency: 'PEN' | 'USD') => methodMovements
      .filter((movement) => movement.type === type && (movement.currency ?? 'PEN') === cashCurrency)
      .reduce((total, movement) => total + movement.amount, 0)
    return {
      method,
      incomesPen: sum('Ingreso', 'PEN'),
      expensesPen: sum('Egreso', 'PEN'),
      incomesUsd: sum('Ingreso', 'USD'),
      expensesUsd: sum('Egreso', 'USD'),
    }
  })
}

function CashRegisterView() {
  const { cashRegister, setCashRegister, closedSessions, setClosedSessions, orders, activeProfile } = useDemoData()
  const [modal, setModal] = useState<ModalMode>(null)
  const [detailSession, setDetailSession] = useState<ClosedCashSession | null>(null)
  const [amount, setAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<NonNullable<CashMovement['paymentMethod']>>('Efectivo')
  const [movementCurrency, setMovementCurrency] = useState<'PEN' | 'USD'>('PEN')
  const [incomeLinkedToOrder, setIncomeLinkedToOrder] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState<CashMovement['expenseCategory']>('Gasto General del Taller')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [observations, setObservations] = useState('')
  const [lastCloseObservations, setLastCloseObservations] = useState('')
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')

  const totals = useMemo(() => {
    const movements = cashRegister?.movements ?? []
    const sum = (type: CashMovement['type'], cashCurrency: 'PEN' | 'USD', cashOnly = false) => movements
      .filter((movement) => movement.type === type &&
        (movement.currency ?? 'PEN') === cashCurrency &&
        (!cashOnly || (movement.paymentMethod ?? 'Efectivo') === 'Efectivo'))
      .reduce((total, movement) => total + movement.amount, 0)
    const incomes = sum('Ingreso', 'PEN')
    const expenses = sum('Egreso', 'PEN')
    const incomesUsd = sum('Ingreso', 'USD')
    const expensesUsd = sum('Egreso', 'USD')
    return {
      incomes,
      expenses,
      incomesUsd,
      expensesUsd,
      expected: (cashRegister?.initialAmount ?? 0) + sum('Ingreso', 'PEN', true) - sum('Egreso', 'PEN', true),
      expectedUsd: (cashRegister?.initialAmountUsd ?? 0) + sum('Ingreso', 'USD', true) - sum('Egreso', 'USD', true),
    }
  }, [cashRegister])
  const activeOrders = useMemo(
    () => orders.filter((order) => !order.convertedToOrderId && order.status !== 'Archivados'),
    [orders],
  )
  const linkableOrders = useMemo(() => orders.filter((order) => !order.convertedToOrderId), [orders])

  const openModal = (mode: Exclude<ModalMode, null>) => {
    setAmount('')
    setUsdAmount(mode === 'open' || mode === 'close' ? '0' : '')
    setConcept('')
    setPaymentMethod('Efectivo')
    setMovementCurrency('PEN')
    setIncomeLinkedToOrder(false)
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
    const usdValue = Number(usdAmount)
    if (!Number.isFinite(value) || value < 0 ||
        ((modal === 'open' || modal === 'close') && (!Number.isFinite(usdValue) || usdValue < 0)) ||
        ((modal === 'income' || modal === 'expense') && value <= 0)) {
      setError(modal === 'open' ? 'Ingresa un monto inicial válido.' : 'Ingresa un monto válido.')
      return
    }
    if (modal === 'expense' && expenseCategory === 'Asociado a Orden de Servicio' &&
        !activeOrders.some((order) => order.id === selectedOrderId)) {
      setError('Selecciona una orden de servicio activa.')
      return
    }
    if (modal === 'income' && incomeLinkedToOrder &&
        !linkableOrders.some((order) => order.id === selectedOrderId)) {
      setError('Selecciona una orden de servicio válida.')
      return
    }

    if (modal === 'open') {
      setCashRegister({
        openedAt: new Date().toISOString(),
        initialAmount: value,
        initialAmountUsd: Number(usdAmount) || 0,
        openingObservations: observations.trim(),
        movements: [],
      })
      setLastCloseObservations('')
    } else if (modal === 'income' || modal === 'expense') {
      const movement: CashMovement = {
        id: `cash-movement-${Date.now()}`,
        type: modal === 'income' ? 'Ingreso' : 'Egreso',
        concept: concept.trim(),
        amount: value,
        timestamp: new Date().toISOString(),
        paymentMethod,
        currency: movementCurrency,
        ...(modal === 'expense' ? {
          expenseCategory,
          ...(expenseCategory === 'Asociado a Orden de Servicio' ? {
            orderId: selectedOrderId,
            contact: activeOrders.find((order) => order.id === selectedOrderId)?.customer,
          } : {}),
        } : {}),
        ...(modal === 'income' && incomeLinkedToOrder ? {
          orderId: selectedOrderId,
          contact: linkableOrders.find((order) => order.id === selectedOrderId)?.customer,
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
        initialAmountUsd: cashRegister.initialAmountUsd ?? 0,
        totalIncomesUsd: totals.incomesUsd,
        totalExpensesUsd: totals.expensesUsd,
        expectedBalanceUsd: totals.expectedUsd,
        actualBalanceUsd: usdValue || 0,
        differenceUsd: usdValue - totals.expectedUsd,
        openingObservations: cashRegister.openingObservations ?? '',
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
  const differenceUsd = usdAmount.trim() === '' ? null : Number(usdAmount) - totals.expectedUsd
  const closedSessionColumns = [
    'Fecha',
    'Detalle',
    'OT',
    'Contacto',
    'Medio de pago',
    'Ingreso (PEN)',
    'Egreso (PEN)',
    'Ingreso (USD)',
    'Egreso (USD)',
  ]
  const closedSessionRows: ExportCell[][] = closedSessions.flatMap((session) => {
    const movementRows: ExportCell[][] = session.movements.map((movement) => {
      const orderId = getCashMovementOrderId(movement, orders)
      const order = orderId ? orders.find((candidate) => candidate.id === orderId) : undefined
      const isIncome = movement.type === 'Ingreso'
      const isPen = (movement.currency ?? 'PEN') === 'PEN'
      return [
        formatDateTime(movement.timestamp),
        movement.concept,
        orderId ? `#${orderId}` : '',
        movement.contact ?? order?.customer ?? '',
        movement.paymentMethod ?? 'Efectivo',
        isIncome && isPen ? movement.amount : 0,
        !isIncome && isPen ? movement.amount : 0,
        isIncome && !isPen ? movement.amount : 0,
        !isIncome && !isPen ? movement.amount : 0,
      ]
    })
    const summaryRows: ExportCell[][] = [
      ['', 'Saldo inicial', '', '', '', session.initialAmount, '', session.initialAmountUsd ?? 0, ''],
      ...getPaymentBreakdown(session.movements)
        .filter((entry) => entry.incomesPen || entry.expensesPen || entry.incomesUsd || entry.expensesUsd)
        .map((entry) => [
          '',
          `Movimientos · ${entry.method}`,
          '',
          '',
          entry.method,
          entry.incomesPen,
          entry.expensesPen,
          entry.incomesUsd,
          entry.expensesUsd,
        ]),
      ['', 'Efectivo esperado', '', '', '', session.expectedBalance, '', session.expectedBalanceUsd ?? 0, ''],
      ['', 'Efectivo real contado', '', '', '', session.actualBalance, '', session.actualBalanceUsd ?? 0, ''],
      ['', 'Diferencia', '', '', '', Math.max(0, session.difference), Math.max(0, -session.difference), Math.max(0, session.differenceUsd ?? 0), Math.max(0, -(session.differenceUsd ?? 0))],
      ...(session.openingObservations ? [['', `Observaciones de apertura: ${session.openingObservations}`, '', '', '', '', '', '', '']] : []),
      ...(session.observations ? [['', `Observaciones de cierre: ${session.observations}`, '', '', '', '', '', '', '']] : []),
      ['', '', '', '', '', '', '', '', ''],
    ]
    return [
      ['', `CIERRE DE CAJA · ${formatDateTime(session.closedAt)} · ${session.closedBy}`, '', '', '', '', '', '', ''],
      ...movementRows,
      ...(movementRows.length ? [] : [['', 'Sin movimientos registrados', '', '', '', '', '', '', '']]),
      ...summaryRows,
    ]
  })
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
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">Abre una caja para registrar ingresos y egresos. Los abonos de órdenes se agregarán automáticamente mientras la caja esté abierta.</p>
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
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-100">{formatBothCurrencies(totals.expected, totals.expectedUsd)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><Clock3 size={13} /> Abierta a las {formatTime(cashRegister.openedAt)}</p>
              {cashRegister.openingObservations && (
                <p className="mt-3 max-w-xl rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
                  <strong className="text-slate-100">Observaciones de apertura:</strong> {cashRegister.openingObservations}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openModal('income')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-lime-400"><ArrowDownLeft size={15} /> Registrar Ingreso</button>
              <button onClick={() => openModal('expense')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-700"><ArrowUpRight size={15} /> Registrar Egreso</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div><h3 className="text-sm font-bold text-slate-100">Historial de Movimientos del Día</h3><p className="mt-1 text-[11px] text-slate-400">{cashRegister.movements.length} movimientos registrados · incluye abonos de órdenes (no volver a registrarlos)</p></div>
              <span className="rounded-full bg-lime-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-300">Caja abierta</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr><th className="px-5 py-3">Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Medio de pago</th><th className="px-4 py-3">Vinculación</th><th className="px-5 py-3 text-right">Monto</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashRegister.movements.map((movement) => {
                    const orderId = getCashMovementOrderId(movement, orders)
                    return (
                      <tr key={movement.id} className="text-xs text-slate-400">
                        <td className="px-5 py-4 tabular-nums">{formatTime(movement.timestamp)}</td>
                        <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${movement.type === 'Ingreso' ? 'bg-lime-950/30 text-lime-300' : 'bg-rose-950/30 text-rose-200'}`}>{movement.type === 'Ingreso' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}{movement.type}</span></td>
                        <td className="px-4 py-4 font-medium text-slate-300">{movement.concept}</td>
                        <td className="px-4 py-4">{movement.paymentMethod ?? 'Efectivo'}</td>
                        <td className="px-4 py-4 text-slate-400">{orderId ? `OT #${orderId}` : 'Taller'}</td>
                        <td className={`px-5 py-4 text-right font-bold tabular-nums ${movement.type === 'Ingreso' ? 'text-emerald-300' : 'text-rose-300'}`}>{movement.type === 'Ingreso' ? '+' : '-'}{formatAmount(movement.amount, movement.currency ?? 'PEN')}</td>
                      </tr>
                    )
                  })}
                  {cashRegister.movements.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">Aún no hay movimientos registrados en esta caja.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-800 p-4">
              <button onClick={() => openModal('close')} className="h-10 rounded-lg bg-slate-900 px-5 text-xs font-extrabold tracking-wide text-white transition hover:bg-slate-800">CERRAR CAJA</button>
            </div>
          </section>
        </>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Historial de Cajas Cerradas</h3>
              <p className="mt-1 text-[11px] text-slate-400">{closedSessions.length} cierre(s) registrados</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const latestSession = closedSessions[0]
                  if (latestSession) setDetailSession(latestSession)
                }}
                disabled={!closedSessions.length}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown size={14} /> Imprimir último cierre
              </button>
              <button
                onClick={() => void runExport(() => exportToExcel(closedSessionRows, closedSessionColumns, 'Reporte Detallado de Cierre de Caja'))}
                disabled={!closedSessions.length}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-800 px-3.5 text-xs font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet size={14} /> Exportar Excel
              </button>
            </div>
          </div>
          {exportError && <p role="alert" className="border-b border-rose-900/50 bg-rose-950/30 px-5 py-2.5 text-xs font-medium text-rose-200">{exportError}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left">
              <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora de Cierre</th>
                  <th className="px-4 py-3">Usuario que cerró</th>
                  <th className="px-4 py-3 text-right">Monto Inicial (PEN · USD)</th>
                  <th className="px-4 py-3 text-right">Total Ingresos (PEN · USD)</th>
                  <th className="px-4 py-3 text-right">Total Egresos (PEN · USD)</th>
                  <th className="px-4 py-3 text-right">Saldo Esperado (PEN · USD)</th>
                  <th className="px-4 py-3 text-right">Saldo Real (PEN · USD)</th>
                  <th className="px-4 py-3 text-right">Diferencia (PEN · USD)</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closedSessions.map((session) => (
                  <tr key={session.id} className="text-xs text-slate-400 transition hover:bg-slate-900/70">
                    <td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatDateTime(session.closedAt)}</td>
                    <td className="px-4 py-4 font-medium text-slate-300">{session.closedBy}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{formatBothCurrencies(session.initialAmount, session.initialAmountUsd ?? 0)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-emerald-300">{formatBothCurrencies(session.totalIncomes, session.totalIncomesUsd ?? 0)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-rose-300">{formatBothCurrencies(session.totalExpenses, session.totalExpensesUsd ?? 0)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-slate-200">{formatBothCurrencies(session.expectedBalance, session.expectedBalanceUsd ?? 0)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{formatBothCurrencies(session.actualBalance, session.actualBalanceUsd ?? 0)}</td>
                    <td className={`px-4 py-4 text-right font-bold tabular-nums ${session.difference === 0 ? 'text-slate-400' : session.difference < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      <span className="whitespace-nowrap">{session.difference === 0
                        ? formatAmount(0)
                        : `${session.difference < 0 ? 'Faltante' : 'Sobrante'} ${formatAmount(Math.abs(session.difference))}`} · {(session.differenceUsd ?? 0) === 0
                        ? formatAmount(0, 'USD')
                        : `${(session.differenceUsd ?? 0) < 0 ? 'Faltante' : 'Sobrante'} ${formatAmount(Math.abs(session.differenceUsd ?? 0), 'USD')}`}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setDetailSession(session)} className="whitespace-nowrap rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800">Ver Detalle</button>
                        <button
                          type="button"
                          aria-label={`Eliminar cierre del ${formatDateTime(session.closedAt)}`}
                          title="Eliminar cierre"
                          onClick={() => {
                            if (!window.confirm(`¿Eliminar el cierre de caja del ${formatDateTime(session.closedAt)}? Esta acción no se puede deshacer.`)) return
                            setClosedSessions((current) => current.filter((closedSession) => closedSession.id !== session.id))
                            if (detailSession?.id === session.id) setDetailSession(null)
                          }}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-900/70 px-2 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-950/50"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
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
                  <SummaryRow label="Monto Inicial (PEN · USD)" amount={formatBothCurrencies(cashRegister?.initialAmount ?? 0, cashRegister?.initialAmountUsd ?? 0)} />
                  <SummaryRow label="Total Ingresos (PEN · USD)" amount={formatBothCurrencies(totals.incomes, totals.incomesUsd)} positive />
                  <SummaryRow label="Total Egresos (PEN · USD)" amount={formatBothCurrencies(totals.expenses, totals.expensesUsd)} negative />
                  <div className="mt-2 border-t border-slate-700 pt-3"><SummaryRow label="Efectivo esperado (PEN · USD)" amount={formatBothCurrencies(totals.expected, totals.expectedUsd)} strong /></div>
                  <p className="pt-1 text-[10px] text-slate-400">El saldo esperado considera solo los movimientos en efectivo; los otros medios se detallan por separado.</p>
                </div>
              )}

              {modal === 'open' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">Monto Inicial en Efectivo (S/)
                    <NumericInput autoFocus required min="0" step="0.01" value={amount} onChange={setAmount} placeholder="100.00" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Monto Inicial en Efectivo (USD)
                    <NumericInput required min="0" step="0.01" value={usdAmount} onChange={setUsdAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Observaciones de apertura
                    <textarea
                      rows={3}
                      value={observations}
                      onChange={(event) => setObservations(event.target.value)}
                      placeholder="Ej. Se abre con S/ 200 en efectivo y USD 0."
                      className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30"
                    />
                  </label>
                </>
              )}
              {modal === 'income' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">Concepto
                    <input autoFocus required value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. Pago de servicio" className={fieldClass} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Tipo de ingreso
                    <select value={incomeLinkedToOrder ? 'order' : 'general'} onChange={(event) => {
                      setIncomeLinkedToOrder(event.target.value === 'order')
                      setSelectedOrderId('')
                    }} className={fieldClass}>
                      <option value="general">General del taller</option>
                      <option value="order">Asociado a orden de servicio</option>
                    </select>
                  </label>
                  {incomeLinkedToOrder && (
                    <label className="block text-xs font-semibold text-slate-300">Orden de servicio
                      <select required value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} className={fieldClass}>
                        <option value="">Selecciona una orden</option>
                        {linkableOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            #{order.id} · {order.customer} · {order.vehicle.make} {order.vehicle.model} · {order.status}
                          </option>
                        ))}
                      </select>
                      {linkableOrders.length === 0 && <span className="mt-1.5 block text-[11px] font-medium text-rose-300">No hay órdenes de servicio disponibles.</span>}
                    </label>
                  )}
                  <label className="block text-xs font-semibold text-slate-300">Medio de pago
                    <select value={paymentMethod} onChange={(event) => {
                      const nextMethod = paymentMethods.find((method) => method === event.target.value)
                      if (nextMethod) setPaymentMethod(nextMethod)
                    }} className={fieldClass}>
                      {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Moneda
                    <select value={movementCurrency} onChange={(event) => {
                      if (event.target.value === 'PEN' || event.target.value === 'USD') setMovementCurrency(event.target.value)
                    }} className={fieldClass}>
                      <option value="PEN">Soles (PEN)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Monto ({movementCurrency})
                    <NumericInput required min="0.01" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                </>
              )}
              {modal === 'expense' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">Medio de pago
                    <select value={paymentMethod} onChange={(event) => {
                      const nextMethod = paymentMethods.find((method) => method === event.target.value)
                      if (nextMethod) setPaymentMethod(nextMethod)
                    }} className={fieldClass}>
                      {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Moneda
                    <select value={movementCurrency} onChange={(event) => {
                      if (event.target.value === 'PEN' || event.target.value === 'USD') setMovementCurrency(event.target.value)
                    }} className={fieldClass}>
                      <option value="PEN">Soles (PEN)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">Monto ({movementCurrency})
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
                  <label className="block text-xs font-semibold text-slate-300">Monto Real Contado en Efectivo (S/)
                    <NumericInput autoFocus required min="0" step="0.01" value={amount} onChange={setAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                  {difference !== null && Number.isFinite(difference) && (
                    <p className={`rounded-lg px-3 py-2.5 text-xs font-bold ${difference < 0 ? 'bg-rose-950/30 text-rose-200' : difference > 0 ? 'bg-emerald-950/30 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                      {difference < 0 ? `Faltante: ${formatAmount(Math.abs(difference))}` : difference > 0 ? `Sobrante: ${formatAmount(difference)}` : `Sin diferencia: ${formatAmount(0)}`}
                    </p>
                  )}
                  <label className="block text-xs font-semibold text-slate-300">Monto Real Contado en Efectivo (USD)
                    <NumericInput required min="0" step="0.01" value={usdAmount} onChange={setUsdAmount} placeholder="0.00" className={fieldClass} />
                  </label>
                  {differenceUsd !== null && Number.isFinite(differenceUsd) && (
                    <p className={`rounded-lg px-3 py-2.5 text-xs font-bold ${differenceUsd < 0 ? 'bg-rose-950/30 text-rose-200' : differenceUsd > 0 ? 'bg-emerald-950/30 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                      {differenceUsd < 0 ? `Faltante: ${formatAmount(Math.abs(differenceUsd), 'USD')}` : differenceUsd > 0 ? `Sobrante: ${formatAmount(differenceUsd, 'USD')}` : `Sin diferencia: ${formatAmount(0, 'USD')}`}
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
        <div className="print-preview-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailSession(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="closed-session-title" className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-xl bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 id="closed-session-title" className="text-sm font-bold text-slate-100">Reporte de Cierre de Caja</h3>
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(detailSession.closedAt)} · {detailSession.closedBy}</p>
              </div>
              <button aria-label="Cerrar detalle" onClick={() => setDetailSession(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-300"><X size={17} /></button>
            </div>
            <div className="max-h-[calc(94vh-70px)] overflow-y-auto p-5">
              <CashClosureReport session={detailSession} orders={orders} />
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
