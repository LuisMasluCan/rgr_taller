import 'dotenv/config'
import dotenv from 'dotenv'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { AccountType, Prisma, AppointmentStatus, CashCurrency, CashSessionStatus, InvoiceStatus, ItemType, MovementType, PaymentMethod, ServiceStatus, SupplierType } from '../src/generated/prisma/client'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`El campo ${label} no tiene un objeto válido.`)
  return value
}

function asArray(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`La colección ${label} no tiene un formato válido.`)
  }
  return value
}

function compatibilityData(record: JsonRecord, relationalFields: string[]): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !relationalFields.includes(key)),
  ) as Prisma.InputJsonObject
}

function stringValue(value: unknown, label: string, required = true): string {
  if (typeof value === 'string' && (value || !required)) return value
  if (!required && (value === undefined || value === null)) return ''
  throw new Error(`El campo ${label} debe ser texto.`)
}

function numberValue(value: unknown, label: string, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new Error(`El campo ${label} debe ser numérico.`)
}

function decimal(value: unknown, label: string, fallback = 0): Prisma.Decimal {
  return new Prisma.Decimal(numberValue(value, label, fallback))
}

function dateValue(value: unknown, label: string): Date {
  const text = stringValue(value, label)
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text)
  if (Number.isNaN(date.getTime())) throw new Error(`El campo ${label} no contiene una fecha válida.`)
  return date
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('es-PE')
}

function itemType(value: string): ItemType {
  if (value === 'Mano de Obra' || value === 'Mano de obra') return ItemType.LABOR
  if (value === 'Repuesto') return ItemType.PART
  if (value === 'Insumo') return ItemType.SUPPLY
  return ItemType.EXTERNAL_SERVICE
}

function orderStatus(value: string): ServiceStatus {
  const mapping: Record<string, ServiceStatus> = {
    Recepción: ServiceStatus.RECEPTION,
    Diagnóstico: ServiceStatus.DIAGNOSIS,
    Repuestos: ServiceStatus.PARTS,
    Aprobación: ServiceStatus.APPROVAL,
    Reparación: ServiceStatus.REPAIR,
    Control: ServiceStatus.CONTROL,
    Entrega: ServiceStatus.DELIVERY,
    Archivados: ServiceStatus.ARCHIVED,
  }
  return mapping[value] ?? ServiceStatus.RECEPTION
}

function appointmentStatus(value: string): AppointmentStatus {
  const mapping: Record<string, AppointmentStatus> = {
    Programada: AppointmentStatus.SCHEDULED,
    Completada: AppointmentStatus.COMPLETED,
    Cancelada: AppointmentStatus.CANCELLED,
  }
  return mapping[value] ?? AppointmentStatus.SCHEDULED
}

function supplierType(value: string): SupplierType {
  return value === 'Persona' ? SupplierType.PERSON : SupplierType.COMPANY
}

function movementType(value: string): MovementType {
  return value === 'Egreso' ? MovementType.EXPENSE : MovementType.INCOME
}

function cashCurrency(value: unknown): CashCurrency {
  return value === 'USD' ? CashCurrency.USD : CashCurrency.PEN
}

function paymentMethod(value: unknown): PaymentMethod | undefined {
  const mapping: Record<string, PaymentMethod> = {
    Efectivo: PaymentMethod.CASH_SOLES,
    Transferencia: PaymentMethod.TRANSFER,
    Yape: PaymentMethod.YAPE,
    Plin: PaymentMethod.PLIN,
    'Tarjeta de crédito': PaymentMethod.CREDIT_CARD,
    'Tarjeta de débito': PaymentMethod.DEBIT_CARD,
  }
  return typeof value === 'string' ? mapping[value] : undefined
}

function accountType(value: unknown): AccountType | undefined {
  const mapping: Record<string, AccountType> = {
    Efectivo: AccountType.CASH_SOLES,
    Transferencia: AccountType.TRANSFER,
    Yape: AccountType.YAPE,
    Plin: AccountType.PLIN,
    'Tarjeta de crédito': AccountType.CREDIT_CARD,
    'Tarjeta de débito': AccountType.DEBIT_CARD,
  }
  return typeof value === 'string' ? mapping[value] : undefined
}

function snapshotTotal(item: JsonRecord): number {
  const price = numberValue(item.price, 'quoteItems.price')
  const quantity = numberValue(item.quantity, 'quoteItems.quantity', 1)
  const discount = numberValue(item.discount, 'quoteItems.discount')
  const taxRate = numberValue(item.taxRate, 'quoteItems.taxRate')
  const base = price * quantity * (1 - discount / 100)
  return base + base * taxRate / 100
}

async function main(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma.js')
  try {
    const state = await prisma.workshopState.findUnique({ where: { id: 'workshop' }, select: { data: true, version: true } })
    if (!state || !isRecord(state.data)) throw new Error('No existe un WorkshopState válido para importar.')

    const data = state.data
    const clients = asArray(data.clients, 'clients')
    const inventory = asArray(data.inventory, 'inventory')
    const orders = asArray(data.orders, 'orders')
    const appointments = asArray(data.appointments, 'appointments')
    const suppliers = asArray(data.suppliers, 'suppliers')
    const assets = asArray(data.workshopAssets, 'workshopAssets')
    const workshopCategories = asArray(data.workshopCategories ?? [], 'workshopCategories')
    const bankAccounts = asArray(data.bankAccounts ?? [], 'bankAccounts')
    const closedSessions = asArray(data.closedSessions, 'closedSessions')
    const bankMovements = asRecord(data.bankMovements, 'bankMovements')

    const existing = await Promise.all([
      prisma.customer.count(),
      prisma.vehicle.count(),
      prisma.item.count(),
      prisma.serviceOrder.count(),
      prisma.serviceOrderItem.count(),
      prisma.invoice.count(),
      prisma.invoiceItem.count(),
      prisma.supplier.count(),
      prisma.appointment.count(),
      prisma.workshopAsset.count(),
      prisma.cashSession.count(),
      prisma.cashSessionMovement.count(),
    ])
    if (existing.some((count) => count > 0)) {
      throw new Error('La importación se detuvo porque ya existen datos relacionales. No se sobrescribió nada.')
    }

    const clientById = new Map<string, JsonRecord>()
    const vehicleById = new Map<string, { client: JsonRecord; vehicle: JsonRecord }>()
    const vehicleByPlate = new Map<string, { client: JsonRecord; vehicle: JsonRecord }>()
    for (const client of clients) {
      const clientId = stringValue(client.id, 'clients.id')
      clientById.set(clientId, client)
      for (const vehicle of asArray(client.vehicles, `clients[${clientId}].vehicles`)) {
        const vehicleId = stringValue(vehicle.id, `vehicle ${clientId}.id`)
        const entry = { client, vehicle }
        vehicleById.set(vehicleId, entry)
        const plate = stringValue(vehicle.plate, `vehicle ${vehicleId}.plate`, false)
        if (plate) vehicleByPlate.set(normalized(plate), entry)
      }
    }

    const inventoryByReference = new Map<string, JsonRecord>()
    for (const item of inventory) {
      const reference = stringValue(item.reference, 'inventory.reference', false)
      if (reference) inventoryByReference.set(normalized(reference), item)
    }

    const orderLinks = new Map<string, { customerId: string; vehicleId: string }>()
    for (const order of orders) {
      const orderId = stringValue(order.id, 'orders.id')
      const vehicle = isRecord(order.vehicle)
        ? vehicleByPlate.get(normalized(stringValue(order.vehicle.plate, `order ${orderId}.vehicle.plate`, false)))
        : undefined
      const customer = clients.find((entry) => normalized(stringValue(entry.name, 'client.name')) === normalized(stringValue(order.customer, `order ${orderId}.customer`)))
      const linkedVehicle = vehicle ?? (customer ? [...vehicleById.values()].find((entry) => entry.client === customer) : undefined)
      if (!customer || !linkedVehicle) {
        throw new Error(`No se pudo relacionar la orden ${orderId} con un cliente y vehículo existentes.`)
      }
      orderLinks.set(orderId, { customerId: stringValue(customer.id, 'client.id'), vehicleId: stringValue(linkedVehicle.vehicle.id, 'vehicle.id') })
    }

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
    if (!admin) throw new Error('No existe un usuario ADMIN para relacionar movimientos financieros.')

    await prisma.$transaction(async (tx) => {
      for (const client of clients) {
        const clientId = stringValue(client.id, 'clients.id')
        await tx.customer.create({
          data: {
            id: clientId,
            name: stringValue(client.name, `client ${clientId}.name`),
            email: stringValue(client.email, `client ${clientId}.email`, false) || null,
            phone: stringValue(client.phone, `client ${clientId}.phone`, false) || null,
            legacyData: compatibilityData(client, ['id', 'name', 'email', 'phone', 'vehicles']),
          },
        })
        for (const vehicle of asArray(client.vehicles, `client ${clientId}.vehicles`)) {
          const vehicleId = stringValue(vehicle.id, `vehicle ${clientId}.id`)
          await tx.vehicle.create({
            data: {
              id: vehicleId,
              plate: stringValue(vehicle.plate, `vehicle ${vehicleId}.plate`),
              brand: stringValue(vehicle.make, `vehicle ${vehicleId}.make`, false),
              model: stringValue(vehicle.model, `vehicle ${vehicleId}.model`, false),
              year: Math.trunc(numberValue(vehicle.year, `vehicle ${vehicleId}.year`, 0)) || null,
              color: stringValue(vehicle.color, `vehicle ${vehicleId}.color`, false) || null,
              vin: stringValue(vehicle.vin, `vehicle ${vehicleId}.vin`, false) || null,
              mileage: Math.trunc(numberValue(vehicle.mileage, `vehicle ${vehicleId}.mileage`, 0)),
              customerId: clientId,
              legacyData: compatibilityData(vehicle, ['id', 'make', 'model', 'year', 'plate', 'vin', 'color']),
            },
          })
        }
      }

      const categories = await tx.category.findMany()
      const categoryByName = new Map(categories.map((category) => [normalized(category.name), category.id]))
      for (const category of workshopCategories) {
        const name = stringValue(category.category, 'category.name', false)
        if (!name) continue
        let categoryId = categoryByName.get(normalized(name))
        if (!categoryId) {
          categoryId = stringValue(category.id, 'category.id', false) || randomUUID()
          await tx.category.create({
            data: {
              id: categoryId,
              name,
              legacyData: compatibilityData(category, ['category']),
            },
          })
          categoryByName.set(normalized(name), categoryId)
        } else {
          await tx.category.update({
            where: { id: categoryId },
            data: { legacyData: compatibilityData(category, ['category']) },
          })
        }
      }
      for (const item of inventory) {
        const name = stringValue(item.category, 'inventory.category', false)
        if (!name || categoryByName.has(normalized(name))) continue
        const categoryId = `legacy-category-${randomUUID()}`
        await tx.category.create({
          data: { id: categoryId, name, legacyData: { specialty: '', description: '' } },
        })
        categoryByName.set(normalized(name), categoryId)
      }
      for (const item of inventory) {
        const itemId = stringValue(item.id, 'inventory.id')
        const name = stringValue(item.description, `inventory ${itemId}.description`)
        await tx.item.create({
          data: {
            id: itemId,
            name,
            type: itemType(stringValue(item.type, `inventory ${itemId}.type`, false)),
            sku: stringValue(item.reference, `inventory ${itemId}.reference`, false) || null,
            description: stringValue(item.details, `inventory ${itemId}.details`, false) || null,
            unit: stringValue(item.unit, `inventory ${itemId}.unit`, false) || 'unidad',
            cost: decimal(item.cost, `inventory ${itemId}.cost`),
            price: decimal(item.price, `inventory ${itemId}.price`),
            taxRate: decimal(item.taxRate, `inventory ${itemId}.taxRate`, 18),
            stock: decimal(item.stock, `inventory ${itemId}.stock`),
            minStock: 0,
            categoryId: categoryByName.get(normalized(stringValue(item.category, `inventory ${itemId}.category`, false))) ?? null,
            legacyData: compatibilityData(item, ['id', 'description', 'reference', 'cost', 'price', 'taxRate', 'stock', 'details', 'unit', 'category']),
          },
        })
      }

      let orderNumber = 1
      let invoiceNumber = 1
      for (const order of orders) {
        const orderId = stringValue(order.id, 'orders.id')
        const link = orderLinks.get(orderId)
        if (!link) throw new Error(`Falta la relación validada para la orden ${orderId}.`)
        const orderDate = dateValue(order.dateISO ?? order.date, `order ${orderId}.date`)
        const diagnosis = isRecord(order.diagnosis) ? order.diagnosis : null
        const quality = isRecord(order.qualityControl) ? order.qualityControl : null
        const serviceOrder = await tx.serviceOrder.create({
          data: {
            id: orderId,
            consecutiveNumber: orderNumber++,
            status: orderStatus(stringValue(order.status, `order ${orderId}.status`, false)),
            customerId: link.customerId,
            vehicleId: link.vehicleId,
            receptionDate: orderDate,
            entryReason: stringValue(order.reason, `order ${orderId}.reason`, false),
            diagnosisNotes: diagnosis ? stringValue(diagnosis.findings, `order ${orderId}.diagnosis.findings`, false) : null,
            qcNotes: quality ? stringValue(quality.observations, `order ${orderId}.qualityControl.observations`, false) : null,
            mileageIn: Math.trunc(numberValue(order.mileage, `order ${orderId}.mileage`, 0)) || null,
            isFactured: order.invoiced === true,
            legacyData: compatibilityData(order, ['id', 'status', 'customer', 'vehicle', 'reason', 'mileage', 'invoiced', 'quoteItems']),
          },
        })

        const quoteItems = asArray(order.quoteItems ?? [], `order ${orderId}.quoteItems`)
        const relationalItems: Array<{ itemId: string; source: JsonRecord; total: number }> = []
        for (let index = 0; index < quoteItems.length; index += 1) {
          const source = quoteItems[index]
          const reference = stringValue(source.reference, `order ${orderId}.quoteItems[${index}].reference`, false)
          const existingItem = reference ? inventoryByReference.get(normalized(reference)) : undefined
          const itemId = existingItem
            ? stringValue(existingItem.id, 'inventory.id')
            : `legacy-item-${orderId}-${index + 1}`
          if (!existingItem) {
            await tx.item.create({
              data: {
                id: itemId,
                name: stringValue(source.description, `order ${orderId}.quoteItems[${index}].description`, false) || `Ítem legado ${index + 1}`,
                type: itemType(stringValue(source.type, `order ${orderId}.quoteItems[${index}].type`, false)),
                sku: null,
                description: stringValue(source.description, 'quote item description', false) || null,
                unit: 'unidad',
                cost: decimal(source.cost, 'quote item cost'),
                price: decimal(source.price, 'quote item price'),
                taxRate: decimal(source.taxRate, 'quote item taxRate', 18),
                stock: 0,
                minStock: 0,
              },
            })
          }
          const total = snapshotTotal(source)
          relationalItems.push({ itemId, source, total })
          await tx.serviceOrderItem.create({
            data: {
              id: `service-item-${orderId}-${index + 1}`,
              serviceOrderId: serviceOrder.id,
              itemId,
              quantity: decimal(source.quantity, 'quote item quantity', 1),
              unitPrice: decimal(source.price, 'quote item price'),
              total: decimal(total, 'quote item total'),
              taxRate: decimal(source.taxRate, 'quote item taxRate', 18),
              itemType: itemType(stringValue(source.type, 'quote item type', false)),
              legacyData: compatibilityData(source, ['description', 'reference', 'cost', 'price', 'taxRate', 'quantity']),
            },
          })
        }

        if (order.invoiced === true) {
          const subtotal = relationalItems.reduce((sum, item) => {
            const source = item.source
            const base = numberValue(source.price, 'quote item price') * numberValue(source.quantity, 'quote item quantity', 1) * (1 - numberValue(source.discount, 'quote item discount') / 100)
            return sum + base
          }, 0)
          const total = numberValue(order.invoiceTotal, `order ${orderId}.invoiceTotal`, relationalItems.reduce((sum, item) => sum + item.total, 0))
          await tx.invoice.create({
            data: {
              id: `invoice-${orderId}`,
              consecutiveNumber: invoiceNumber++,
              customerId: link.customerId,
              date: orderDate,
              subtotal: decimal(subtotal, `invoice ${orderId}.subtotal`),
              taxAmount: decimal(total - subtotal, `invoice ${orderId}.taxAmount`),
              total: decimal(total, `invoice ${orderId}.total`),
              status: InvoiceStatus.ISSUED,
              items: {
                create: relationalItems.map((item, index) => ({
                  id: `invoice-item-${orderId}-${index + 1}`,
                  itemId: item.itemId,
                  quantity: decimal(item.source.quantity, 'invoice item quantity', 1),
                  unitPrice: decimal(item.source.price, 'invoice item price'),
                  total: decimal(item.total, 'invoice item total'),
                })),
              },
            },
          })
          const payments = asArray(order.payments ?? [], `order ${orderId}.payments`)
          for (const payment of payments) {
            const paymentId = stringValue(payment.id, `payment ${orderId}.id`)
            const method = stringValue(payment.method, `payment ${paymentId}.method`, false)
            const targetAccountType = accountType(method)
            const account = await tx.bankAccount.findFirst({
              where: targetAccountType ? { type: targetAccountType } : undefined,
              orderBy: { name: 'asc' },
            })
            if (!account) throw new Error('No existe una cuenta bancaria para importar pagos.')
            await tx.cashMovement.create({
              data: {
                id: `payment-${paymentId}`,
                bankAccountId: account.id,
                type: MovementType.INCOME,
                amount: decimal(payment.amount, `payment ${paymentId}.amount`),
                description: stringValue(payment.concept, `payment ${paymentId}.concept`, false) || `Pago de factura ${orderId} (${method || 'sin método'})`,
                userId: admin.id,
                invoiceId: `invoice-${orderId}`,
                createdAt: dateValue(payment.timestamp ?? payment.date ?? orderDate.toISOString(), `payment ${paymentId}.date`),
              },
            })
          }
        }
      }

      for (const appointment of appointments) {
        const appointmentId = stringValue(appointment.id, 'appointment.id')
        const customer = clientById.get(stringValue(appointment.customerId, `appointment ${appointmentId}.customerId`))
        const vehicle = vehicleById.get(stringValue(appointment.vehicleId, `appointment ${appointmentId}.vehicleId`))
        if (!customer || !vehicle) throw new Error(`La cita ${appointmentId} referencia un cliente o vehículo inexistente.`)
        await tx.appointment.create({
          data: {
            id: appointmentId,
            customerId: stringValue(customer.id, 'appointment customer.id'),
            vehicleId: stringValue(vehicle.vehicle.id, 'appointment vehicle.id'),
            reason: stringValue(appointment.reason, `appointment ${appointmentId}.reason`, false),
            date: dateValue(appointment.date, `appointment ${appointmentId}.date`),
            time: stringValue(appointment.time, `appointment ${appointmentId}.time`, false),
            status: appointmentStatus(stringValue(appointment.status, `appointment ${appointmentId}.status`, false)),
            legacyData: compatibilityData(appointment, ['id', 'customerId', 'vehicleId', 'reason', 'date', 'time', 'status']),
          },
        })
      }

      for (const supplier of suppliers) {
        const supplierId = stringValue(supplier.id, 'supplier.id')
        await tx.supplier.create({
          data: {
            id: supplierId,
            type: supplierType(stringValue(supplier.type, `supplier ${supplierId}.type`, false)),
            name: stringValue(supplier.name, `supplier ${supplierId}.name`),
            identification: stringValue(supplier.identification, `supplier ${supplierId}.identification`, false),
            email: stringValue(supplier.email, `supplier ${supplierId}.email`, false),
            phone: stringValue(supplier.phone, `supplier ${supplierId}.phone`, false),
            address: stringValue(supplier.address, `supplier ${supplierId}.address`, false),
            observations: stringValue(supplier.observations, `supplier ${supplierId}.observations`, false) || null,
            legacyData: compatibilityData(supplier, ['id', 'type', 'name', 'identification', 'email', 'phone', 'address', 'observations']),
          },
        })
      }

      for (const asset of assets) {
        const assetId = stringValue(asset.id, 'asset.id')
        await tx.workshopAsset.create({
          data: {
            id: assetId,
            name: stringValue(asset.name, `asset ${assetId}.name`),
            reference: stringValue(asset.reference, `asset ${assetId}.reference`, false),
            description: stringValue(asset.description, `asset ${assetId}.description`, false),
            value: decimal(asset.value, `asset ${assetId}.value`),
            quantity: decimal(asset.quantity, `asset ${assetId}.quantity`, 1),
            observations: stringValue(asset.observations, `asset ${assetId}.observations`, false),
            legacyData: compatibilityData(asset, ['id', 'name', 'reference', 'description', 'value', 'quantity', 'observations']),
          },
        })
      }

      const activeCash = isRecord(data.cashRegister) ? data.cashRegister : null
      const sessionRecords: JsonRecord[] = activeCash
        ? [{ ...activeCash, id: 'active-cash-register', status: 'OPEN' }, ...closedSessions.map((session) => ({ ...session, status: 'CLOSED' }))]
        : closedSessions.map((session) => ({ ...session, status: 'CLOSED' }))
      for (const session of sessionRecords) {
        const sessionId = stringValue(session.id, 'cash session.id')
        const movements = asArray(session.movements ?? [], `cash session ${sessionId}.movements`)
        await tx.cashSession.create({
          data: {
            id: sessionId,
            openedAt: dateValue(session.openedAt, `cash session ${sessionId}.openedAt`),
            closedAt: session.closedAt ? dateValue(session.closedAt, `cash session ${sessionId}.closedAt`) : null,
            closedBy: stringValue(session.closedBy, `cash session ${sessionId}.closedBy`, false) || null,
            status: session.status === 'CLOSED' ? CashSessionStatus.CLOSED : CashSessionStatus.OPEN,
            initialAmount: decimal(session.initialAmount, `cash session ${sessionId}.initialAmount`),
            totalIncomes: decimal(session.totalIncomes, `cash session ${sessionId}.totalIncomes`),
            totalExpenses: decimal(session.totalExpenses, `cash session ${sessionId}.totalExpenses`),
            expectedBalance: decimal(session.expectedBalance, `cash session ${sessionId}.expectedBalance`),
            actualBalance: decimal(session.actualBalance, `cash session ${sessionId}.actualBalance`),
            difference: decimal(session.difference, `cash session ${sessionId}.difference`),
            initialAmountUsd: decimal(session.initialAmountUsd, `cash session ${sessionId}.initialAmountUsd`),
            totalIncomesUsd: decimal(session.totalIncomesUsd, `cash session ${sessionId}.totalIncomesUsd`),
            totalExpensesUsd: decimal(session.totalExpensesUsd, `cash session ${sessionId}.totalExpensesUsd`),
            expectedBalanceUsd: decimal(session.expectedBalanceUsd, `cash session ${sessionId}.expectedBalanceUsd`),
            actualBalanceUsd: decimal(session.actualBalanceUsd, `cash session ${sessionId}.actualBalanceUsd`),
            differenceUsd: decimal(session.differenceUsd, `cash session ${sessionId}.differenceUsd`),
            openingObservations: stringValue(session.openingObservations, `cash session ${sessionId}.openingObservations`, false) || null,
            observations: stringValue(session.observations, `cash session ${sessionId}.observations`, false) || null,
            legacyData: compatibilityData(session, ['id', 'openedAt', 'closedAt', 'closedBy', 'status', 'initialAmount', 'totalIncomes', 'totalExpenses', 'expectedBalance', 'actualBalance', 'difference', 'initialAmountUsd', 'totalIncomesUsd', 'totalExpensesUsd', 'expectedBalanceUsd', 'actualBalanceUsd', 'differenceUsd', 'openingObservations', 'observations', 'movements']),
            movements: {
              create: movements.map((movement, index) => ({
                id: `cash-${sessionId}-${stringValue(movement.id, `cash movement ${index}.id`)}`,
                type: movementType(stringValue(movement.type, 'cash movement.type', false)),
                concept: stringValue(movement.concept, 'cash movement.concept', false),
                amount: decimal(movement.amount, 'cash movement.amount'),
                currency: cashCurrency(movement.currency),
                paymentMethod: paymentMethod(movement.paymentMethod) ?? null,
                expenseCategory: stringValue(movement.expenseCategory, 'cash movement.expenseCategory', false) || null,
                orderId: stringValue(movement.orderId, 'cash movement.orderId', false) || null,
                contact: stringValue(movement.contact, 'cash movement.contact', false) || null,
                timestamp: dateValue(movement.timestamp, 'cash movement.timestamp'),
                legacyData: compatibilityData(movement, ['type', 'concept', 'amount', 'currency', 'paymentMethod', 'expenseCategory', 'orderId', 'contact', 'timestamp']),
              })),
            },
          },
        })
      }

      for (const [accountId, movements] of Object.entries(bankMovements)) {
        const entries = asArray(movements, `bankMovements.${accountId}`)
        for (const [index, movement] of entries.entries()) {
          await tx.cashMovement.create({
            data: {
              id: `bank-${accountId}-${stringValue(movement.id, `bank movement ${index}.id`)}`,
              bankAccountId: accountId,
              type: movementType(stringValue(movement.type, 'bank movement.type', false)),
              amount: decimal(movement.amount, 'bank movement.amount'),
              description: stringValue(movement.concept, 'bank movement.concept', false),
              userId: admin.id,
              createdAt: dateValue(movement.date, 'bank movement.date'),
              legacyData: compatibilityData(movement, ['type', 'amount', 'concept']),
            },
          })
        }
      }

      for (const account of bankAccounts) {
        await tx.bankAccount.updateMany({
          where: { id: stringValue(account.id, 'bankAccount.id') },
          data: {
            legacyData: compatibilityData(account, ['id', 'name', 'initialBalance', 'currentBalance']),
          },
        })
      }

      const settings = isRecord(data.settings) ? data.settings : {}
      const settingValues = {
        name: stringValue(settings.name, 'settings.name', false) || 'RGR Taller',
        phone: stringValue(settings.phone, 'settings.phone', false),
        email: stringValue(settings.email, 'settings.email', false),
        address: stringValue(settings.address, 'settings.address', false),
        lowStockThreshold: Math.trunc(numberValue(settings.lowStockThreshold, 'settings.lowStockThreshold', 5)),
        notificationsEnabled: settings.notificationsEnabled !== false,
        activeProfile: stringValue(data.activeProfile, 'activeProfile', false) || 'Sin sesión',
      }
      await tx.workshopSettings.upsert({
        where: { id: 'workshop' },
        create: { id: 'workshop', ...settingValues },
        update: settingValues,
      })
      await tx.workshopDataVersion.upsert({
        where: { id: 'workshop' },
        create: { id: 'workshop', version: state.version },
        update: { version: state.version },
      })
    })

    console.info(JSON.stringify({
      status: 'imported',
      sourceVersion: state.version,
      clients: clients.length,
      vehicles: [...vehicleById.keys()].length,
      inventory: inventory.length,
      orders: orders.length,
      appointments: appointments.length,
      suppliers: suppliers.length,
      assets: assets.length,
      closedSessions: closedSessions.length,
    }))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('No se pudo importar el estado relacional:', error)
  process.exitCode = 1
})
