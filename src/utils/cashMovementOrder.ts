import type { CashMovement, Order } from '../types'

export function getCashMovementOrderId(movement: CashMovement, orders: Pick<Order, 'id'>[]): string | undefined {
  if (movement.orderId) return movement.orderId
  const mentionedId = movement.concept.match(/#([\w-]+)/)?.[1]
  return mentionedId && orders.some((order) => order.id === mentionedId) ? mentionedId : undefined
}
