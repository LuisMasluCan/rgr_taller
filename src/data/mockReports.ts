import type { Order, OrderTimestamps } from '../types'

export const stageTimestampKeys: { label: string; start: keyof OrderTimestamps; end: keyof OrderTimestamps }[] = [
  { label: 'Recepción', start: 'fechaIngreso', end: 'fechaDiagnostico' },
  { label: 'Diagnóstico', start: 'fechaDiagnostico', end: 'fechaRepuestos' },
  { label: 'Repuestos', start: 'fechaRepuestos', end: 'fechaAprobacion' },
  { label: 'Aprobación', start: 'fechaAprobacion', end: 'fechaInicioReparacion' },
  { label: 'Reparación', start: 'fechaInicioReparacion', end: 'fechaControl' },
  { label: 'Control', start: 'fechaControl', end: 'fechaEntrega' },
  { label: 'Entrega', start: 'fechaEntrega', end: 'fechaArchivado' },
]

export function orderTotal(order: Order): number {
  if (typeof order.invoiceTotal === 'number') return order.invoiceTotal
  return (order.quoteItems ?? []).filter((item) => item.status === 'Aprobado').reduce((total, item) => {
    const base = item.price * item.quantity * (1 - item.discount / 100)
    return total + base + base * item.taxRate / 100
  }, 0)
}

export function orderCost(order: Order): number {
  return (order.quoteItems ?? []).filter((item) => item.status === 'Aprobado')
    .reduce((total, item) => total + item.cost * item.quantity, 0)
}

export function elapsedMinutes(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const duration = new Date(end).getTime() - new Date(start).getTime()
  return Number.isFinite(duration) && duration >= 0 ? duration / 60_000 : null
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Sin datos'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days} d ${remainingHours} h` : `${days} ${days === 1 ? 'día' : 'días'}`
}

export function orderWorkshopMinutes(order: Order, now = new Date().toISOString()): number | null {
  const timestamps = order.timestamps
  const isDelivered = order.status === 'Entrega' || order.status === 'Archivados'
  const end = timestamps?.fechaEntrega ?? timestamps?.fechaArchivado ?? order.canceledAt ?? (isDelivered ? undefined : now)
  return elapsedMinutes(timestamps?.fechaIngreso, end)
}

export function getStageAverages(orders: Order[]) {
  return stageTimestampKeys.map((stage) => {
    const durations = orders.map((order) => elapsedMinutes(order.timestamps?.[stage.start], order.timestamps?.[stage.end]))
      .filter((duration): duration is number => duration !== null)
    return {
      label: stage.label,
      averageMinutes: durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null,
      samples: durations.length,
    }
  })
}
