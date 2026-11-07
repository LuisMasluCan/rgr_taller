import type { OrderServiceItem } from '../types'

export type OrderTotals = {
  subtotal: number
  discounts: number
  base: number
  taxes: number
  total: number
}

export function calculateOrderTotals(
  items: OrderServiceItem[],
  globalDiscount: number,
  approvedOnly = false,
): OrderTotals {
  const applicableItems = approvedOnly ? items.filter((item) => item.status === 'Aprobado') : items
  const discountRate = (item: OrderServiceItem) =>
    1 - (1 - item.discount / 100) * (1 - globalDiscount / 100)
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
