import { Printer } from 'lucide-react'
import type { CashMovement, ClosedCashSession } from '../types'
import { getCashMovementOrderId } from '../utils/cashMovementOrder'

type Props = {
  session: ClosedCashSession
  orders: { id: string }[]
}

type PaymentRow = {
  label: string
  method: NonNullable<CashMovement['paymentMethod']>
  currency: 'PEN' | 'USD' | 'both'
}

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const usdCurrency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const paymentRows: PaymentRow[] = [
  { label: 'Efectivo Soles', method: 'Efectivo', currency: 'PEN' },
  { label: 'Efectivo Dólares', method: 'Efectivo', currency: 'USD' },
  { label: 'Tarjeta de Débito', method: 'Tarjeta de débito', currency: 'both' },
  { label: 'Tarjeta de Crédito', method: 'Tarjeta de crédito', currency: 'both' },
  { label: 'Transferencias', method: 'Transferencia', currency: 'both' },
  { label: 'Yape', method: 'Yape', currency: 'both' },
  { label: 'Plin', method: 'Plin', currency: 'both' },
]

function formatAmount(amount: number, cashCurrency: 'PEN' | 'USD' = 'PEN') {
  return (cashCurrency === 'USD' ? usdCurrency : currency).format(amount)
}

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date(timestamp))
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp))
}

function getPaymentTotals(movements: CashMovement[], method: PaymentRow['method'], cashCurrency: 'PEN' | 'USD') {
  const matching = movements.filter((movement) =>
    (movement.paymentMethod ?? 'Efectivo') === method && (movement.currency ?? 'PEN') === cashCurrency,
  )
  return {
    incomes: matching.filter((movement) => movement.type === 'Ingreso').reduce((total, movement) => total + movement.amount, 0),
    expenses: matching.filter((movement) => movement.type === 'Egreso').reduce((total, movement) => total + movement.amount, 0),
  }
}

function CashClosureReport({ session, orders }: Props) {
  const differenceLabel = session.difference === 0 ? 'Cuadrado' : session.difference < 0 ? 'Faltante' : 'Sobrante'
  const differenceClass = session.difference === 0
    ? 'cash-report-balanced'
    : session.difference < 0
      ? 'cash-report-shortage'
      : 'cash-report-surplus'

  return (
    <article className="print-a4-document printable-cash-closure rounded-xl bg-slate-950 text-slate-100">
      <header className="cash-report-header flex items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div className="cash-report-brand">
          <strong>RGR</strong>
          <span>TALLER</span>
        </div>
        <div className="text-right">
          <h1 className="cash-report-title text-xl font-extrabold tracking-wide">CIERRE DE CAJA</h1>
          <p className="cash-report-muted mt-1 text-xs text-slate-400">{formatDate(session.closedAt)}</p>
        </div>
      </header>

      <div className="cash-report-meta mt-4 grid grid-cols-3 gap-3 text-xs">
        <p><span className="cash-report-muted text-slate-400">Fecha de cierre</span><strong>{formatDate(session.closedAt)}</strong></p>
        <p><span className="cash-report-muted text-slate-400">Hora</span><strong>{formatTime(session.closedAt)}</strong></p>
        <p><span className="cash-report-muted text-slate-400">Usuario que cerró</span><strong>{session.closedBy}</strong></p>
      </div>

      <section className="cash-report-section mt-5">
        <h2 className="cash-report-section-title">01 · Resumen general</h2>
        <div className="cash-report-cards mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BalanceCard label="Saldo inicial" amount={session.initialAmount} usdAmount={session.initialAmountUsd ?? 0} />
          <BalanceCard label="Efectivo esperado" amount={session.expectedBalance} usdAmount={session.expectedBalanceUsd ?? 0} />
          <BalanceCard label="Efectivo real contado" amount={session.actualBalance} usdAmount={session.actualBalanceUsd ?? 0} />
          <section className={`cash-report-card ${differenceClass} rounded-lg border p-3`}>
            <p className="cash-report-muted text-[10px] font-bold uppercase tracking-wide text-slate-400">Diferencia</p>
            <p className="cash-report-value mt-2 text-lg font-extrabold tabular-nums">{differenceLabel} · {formatAmount(Math.abs(session.difference))}</p>
            <p className="cash-report-muted mt-1 text-[10px]">USD: {formatAmount(Math.abs(session.differenceUsd ?? 0), 'USD')}</p>
          </section>
        </div>

        <div className="cash-report-breakdown mt-4 overflow-hidden rounded-lg border border-slate-700">
          <h3 className="cash-report-subtitle px-3 py-2 text-xs font-bold">Desglose por medio de pago</h3>
          <table className="cash-report-table w-full text-left text-[10px]">
            <thead>
              <tr><th>Medio de pago</th><th>Ingresos (S/)</th><th>Egresos (S/)</th><th>Ingresos (USD)</th><th>Egresos (USD)</th></tr>
            </thead>
            <tbody>
              {paymentRows.map((row) => {
                const penTotals = row.currency === 'USD' ? null : getPaymentTotals(session.movements, row.method, 'PEN')
                const usdTotals = row.currency === 'PEN' ? null : getPaymentTotals(session.movements, row.method, 'USD')
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="cash-report-income">{penTotals ? formatAmount(penTotals.incomes) : '—'}</td>
                    <td className="cash-report-expense">{penTotals ? formatAmount(penTotals.expenses) : '—'}</td>
                    <td className="cash-report-income">{usdTotals ? formatAmount(usdTotals.incomes, 'USD') : '—'}</td>
                    <td className="cash-report-expense">{usdTotals ? formatAmount(usdTotals.expenses, 'USD') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cash-report-section mt-5">
        <h2 className="cash-report-section-title">02 · Detalle de movimientos</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-700">
          <table className="cash-report-table cash-report-movements w-full text-left text-[10px]">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Detalle / Concepto</th>
                <th>Vinculación</th>
                <th>Medio de Pago</th>
                <th>Ingreso (S/)</th>
                <th>Egreso (S/)</th>
              </tr>
            </thead>
            <tbody>
              {session.movements.map((movement) => {
                const isPen = (movement.currency ?? 'PEN') === 'PEN'
                const amount = isPen ? formatAmount(movement.amount) : formatAmount(movement.amount, 'USD')
                const orderId = getCashMovementOrderId(movement, orders)
                return (
                  <tr key={movement.id}>
                    <td>{formatDateTime(movement.timestamp)}</td>
                    <td>{movement.concept}</td>
                    <td><span className={`cash-link-badge ${orderId ? 'cash-link-order' : 'cash-link-workshop'}`}>{orderId ? `OT #${orderId}` : 'Taller'}</span></td>
                    <td>{movement.paymentMethod ?? 'Efectivo'}</td>
                    <td className="cash-report-income">{movement.type === 'Ingreso' ? amount : '—'}</td>
                    <td className="cash-report-expense">{movement.type === 'Egreso' ? amount : '—'}</td>
                  </tr>
                )
              })}
              {session.movements.length === 0 && <tr><td colSpan={6} className="cash-report-empty">No se registraron movimientos en este turno.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cash-report-section mt-5">
        <h2 className="cash-report-section-title">03 · Observaciones y firmas</h2>
        <div className="cash-report-observations mt-3 grid grid-cols-2 gap-3">
          <ObservationCard title="Observaciones de Apertura" text={session.openingObservations} />
          <ObservationCard title="Observaciones de Cierre" text={session.observations} />
        </div>
        <div className="cash-report-signatures mt-8 grid grid-cols-2 gap-12">
          <Signature name={session.closedBy} label="Cajero" />
          <Signature name="" label="Administrador" />
        </div>
      </section>

      <button type="button" onClick={() => window.print()} className="no-print mt-5 inline-flex items-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-lime-400">
        <Printer size={15} /> Imprimir / Guardar PDF
      </button>
    </article>
  )
}

function BalanceCard({ label, amount, usdAmount }: { label: string; amount: number; usdAmount: number }) {
  return (
    <section className="cash-report-card rounded-lg border border-slate-700 bg-slate-900 p-3">
      <p className="cash-report-muted text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="cash-report-value mt-2 text-lg font-extrabold tabular-nums text-slate-100">{formatAmount(amount)}</p>
      <p className="cash-report-muted mt-1 text-[10px] text-slate-300">USD: {formatAmount(usdAmount, 'USD')}</p>
    </section>
  )
}

function ObservationCard({ title, text }: { title: string; text?: string }) {
  return (
    <div className="cash-report-observation rounded-lg border border-slate-700 bg-slate-900 p-3">
      <h3 className="cash-report-subtitle text-[10px] font-bold uppercase tracking-wide">{title}</h3>
      <p className="cash-report-muted mt-2 min-h-8 whitespace-pre-wrap text-xs text-slate-300">{text || 'Sin observaciones registradas.'}</p>
    </div>
  )
}

function Signature({ name, label }: { name: string; label: string }) {
  return (
    <div className="cash-report-signature text-center">
      <div className="cash-report-signature-line" />
      {name && <strong className="cash-report-signature-name">{name}</strong>}
      <span>{label}</span>
    </div>
  )
}

export default CashClosureReport
