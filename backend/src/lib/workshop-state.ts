import { randomUUID } from 'node:crypto'
import {
  AccountType,
  AppointmentStatus,
  CashCurrency,
  CashSessionStatus,
  InvoiceStatus,
  ItemType,
  MovementType,
  PaymentMethod,
  Prisma,
  ServiceStatus,
  SupplierType,
  type PrismaClient,
} from '../generated/prisma/client'
import { prisma } from './prisma'

const stateId = 'workshop'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function records(value: unknown, name: string): JsonRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw Object.assign(new Error(`La colección ${name} no tiene un formato válido.`), { status: 400 })
  }
  return value
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function date(value: unknown, fallback = new Date()): Date {
  if (typeof value !== 'string' || !value) return fallback
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function json(value: JsonRecord): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject
}

function without(record: JsonRecord, keys: string[]): Prisma.InputJsonObject {
  return json(Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key))))
}

function orderLegacyData(order: JsonRecord): Prisma.InputJsonObject {
  const legacy: JsonRecord = Object.fromEntries(
    Object.entries(order).filter(([key]) =>
      !['id', 'status', 'customer', 'vehicle', 'reason', 'mileage', 'invoiced', 'quoteItems'].includes(key),
    ),
  )
  if (isRecord(order.vehicle)) {
    legacy.vehicle = Object.fromEntries(
      Object.entries(order.vehicle).filter(([key]) => !['make', 'model', 'year', 'plate', 'vin'].includes(key)),
    )
  }
  return json(legacy)
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('es-PE')
}

const accountLabels: Record<string, AccountType> = {
  Efectivo: AccountType.CASH_SOLES,
  Banco: AccountType.TRANSFER,
  Billetera: AccountType.YAPE,
  Transferencia: AccountType.TRANSFER,
  Yape: AccountType.YAPE,
  Plin: AccountType.PLIN,
  'Tarjeta de crédito': AccountType.CREDIT_CARD,
  'Tarjeta de débito': AccountType.DEBIT_CARD,
}

const accountNames: Record<AccountType, string> = {
  CASH_SOLES: 'Efectivo',
  CASH_USD: 'Efectivo',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEBIT_CARD: 'Banco',
  TRANSFER: 'Banco',
  YAPE: 'Billetera',
  PLIN: 'Billetera',
}

const itemLabels: Record<string, ItemType> = {
  'Mano de Obra': ItemType.LABOR,
  'Mano de obra': ItemType.LABOR,
  Repuesto: ItemType.PART,
  Insumo: ItemType.SUPPLY,
  'Servicio Compuesto': ItemType.EXTERNAL_SERVICE,
  Adicional: ItemType.EXTERNAL_SERVICE,
}

const itemNames: Record<ItemType, string> = {
  LABOR: 'Mano de obra',
  PART: 'Repuesto',
  SUPPLY: 'Insumo',
  EXTERNAL_SERVICE: 'Servicio Compuesto',
}

const orderStatuses: Record<string, ServiceStatus> = {
  Recepción: ServiceStatus.RECEPTION,
  Diagnóstico: ServiceStatus.DIAGNOSIS,
  Repuestos: ServiceStatus.PARTS,
  Aprobación: ServiceStatus.APPROVAL,
  Reparación: ServiceStatus.REPAIR,
  Control: ServiceStatus.CONTROL,
  Entrega: ServiceStatus.DELIVERY,
  Archivados: ServiceStatus.ARCHIVED,
}

const orderStatusNames: Record<ServiceStatus, string> = {
  RECEPTION: 'Recepción',
  DIAGNOSIS: 'Diagnóstico',
  PARTS: 'Repuestos',
  APPROVAL: 'Aprobación',
  REPAIR: 'Reparación',
  CONTROL: 'Control',
  DELIVERY: 'Entrega',
  ARCHIVED: 'Archivados',
}

const appointmentStatuses: Record<string, AppointmentStatus> = {
  Programada: AppointmentStatus.SCHEDULED,
  Completada: AppointmentStatus.COMPLETED,
  Cancelada: AppointmentStatus.CANCELLED,
}

const appointmentStatusNames: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Programada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

const paymentMethods: Record<string, PaymentMethod> = {
  Efectivo: PaymentMethod.CASH_SOLES,
  Transferencia: PaymentMethod.TRANSFER,
  Yape: PaymentMethod.YAPE,
  Plin: PaymentMethod.PLIN,
  'Tarjeta de crédito': PaymentMethod.CREDIT_CARD,
  'Tarjeta de débito': PaymentMethod.DEBIT_CARD,
}

function itemType(value: unknown): ItemType {
  return itemLabels[string(value)] ?? ItemType.EXTERNAL_SERVICE
}

function categoryFields(category: { id: string; name: string; legacyData: Prisma.JsonValue | null }) {
  const legacy = isRecord(category.legacyData) ? category.legacyData : {}
  return {
    id: string(legacy.id, category.id),
    specialty: string(legacy.specialty, 'Mecánica General'),
    category: category.name,
    description: string(legacy.description),
  }
}

function cashMovementFields(movement: {
  id: string
  type: MovementType
  amount: Prisma.Decimal
  description: string
  createdAt: Date
  legacyData: Prisma.JsonValue | null
}) {
  const legacy = isRecord(movement.legacyData) ? movement.legacyData : {}
  return {
    ...legacy,
    id: string(legacy.id, movement.id),
    type: movement.type === MovementType.EXPENSE ? 'Egreso' : 'Ingreso',
    concept: string(legacy.concept, movement.description),
    amount: Number(movement.amount),
    date: string(legacy.date, movement.createdAt.toISOString()),
  }
}

function cashSessionMovementFields(movement: {
  id: string
  type: MovementType
  concept: string
  amount: Prisma.Decimal
  currency: CashCurrency
  paymentMethod: PaymentMethod | null
  expenseCategory: string | null
  orderId: string | null
  contact: string | null
  timestamp: Date
  legacyData: Prisma.JsonValue | null
}) {
  const legacy = isRecord(movement.legacyData) ? movement.legacyData : {}
  const paymentLabel = movement.paymentMethod
    ? Object.entries(paymentMethods).find(([, value]) => value === movement.paymentMethod)?.[0]
    : undefined
  return {
    ...legacy,
    id: string(legacy.id, movement.id),
    type: movement.type === MovementType.EXPENSE ? 'Egreso' : 'Ingreso',
    concept: movement.concept,
    amount: Number(movement.amount),
    currency: movement.currency,
    paymentMethod: paymentLabel,
    expenseCategory: movement.expenseCategory ?? undefined,
    orderId: movement.orderId ?? undefined,
    contact: movement.contact ?? undefined,
    timestamp: movement.timestamp.toISOString(),
  }
}

function sessionFields(session: {
  id: string
  openedAt: Date
  closedAt: Date | null
  closedBy: string | null
  status: CashSessionStatus
  initialAmount: Prisma.Decimal
  totalIncomes: Prisma.Decimal
  totalExpenses: Prisma.Decimal
  expectedBalance: Prisma.Decimal
  actualBalance: Prisma.Decimal
  difference: Prisma.Decimal
  initialAmountUsd: Prisma.Decimal
  totalIncomesUsd: Prisma.Decimal
  totalExpensesUsd: Prisma.Decimal
  expectedBalanceUsd: Prisma.Decimal
  actualBalanceUsd: Prisma.Decimal
  differenceUsd: Prisma.Decimal
  openingObservations: string | null
  observations: string | null
  legacyData: Prisma.JsonValue | null
  movements: Parameters<typeof cashSessionMovementFields>[0][]
}) {
  const legacy = isRecord(session.legacyData) ? session.legacyData : {}
  return {
    ...legacy,
    id: session.id,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? '',
    closedBy: session.closedBy ?? '',
    initialAmount: Number(session.initialAmount),
    totalIncomes: Number(session.totalIncomes),
    totalExpenses: Number(session.totalExpenses),
    expectedBalance: Number(session.expectedBalance),
    actualBalance: Number(session.actualBalance),
    difference: Number(session.difference),
    initialAmountUsd: Number(session.initialAmountUsd),
    totalIncomesUsd: Number(session.totalIncomesUsd),
    totalExpensesUsd: Number(session.totalExpensesUsd),
    expectedBalanceUsd: Number(session.expectedBalanceUsd),
    actualBalanceUsd: Number(session.actualBalanceUsd),
    differenceUsd: Number(session.differenceUsd),
    openingObservations: session.openingObservations ?? '',
    observations: session.observations ?? '',
    movements: session.movements.map(cashSessionMovementFields),
  }
}

async function ensureVersion(client: PrismaClient): Promise<number> {
  try {
    await client.workshopDataVersion.create({ data: { id: stateId, version: 1 } })
  } catch (error) {
    if (!isRecord(error) || error.code !== 'P2002') throw error
  }
  const record = await client.workshopDataVersion.findUniqueOrThrow({ where: { id: stateId } })
  return record.version
}

export async function getRelationalWorkshopData(): Promise<{ data: Prisma.InputJsonObject; version: number }> {
  const version = await ensureVersion(prisma)
  const [
    customers,
    items,
    categories,
    orders,
    appointments,
    suppliers,
    assets,
    accounts,
    bankMovements,
    sessions,
    settings,
  ] = await Promise.all([
    prisma.customer.findMany({ include: { vehicles: true }, orderBy: { name: 'asc' } }),
    prisma.item.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.serviceOrder.findMany({
      include: { customer: true, vehicle: true, items: { include: { item: true } } },
      orderBy: { receptionDate: 'asc' },
    }),
    prisma.appointment.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.workshopAsset.findMany({ orderBy: { name: 'asc' } }),
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    prisma.cashMovement.findMany({ where: { invoiceId: null }, orderBy: { createdAt: 'asc' } }),
    prisma.cashSession.findMany({ include: { movements: { orderBy: { timestamp: 'asc' } } }, orderBy: { openedAt: 'asc' } }),
    prisma.workshopSettings.findUnique({ where: { id: stateId } }),
  ])
  const bankMovementsByAccount: Record<string, ReturnType<typeof cashMovementFields>[]> = {}
  for (const account of accounts) bankMovementsByAccount[account.id] = []
  for (const movement of bankMovements) {
    if (!movement.bankAccountId) continue
    ;(bankMovementsByAccount[movement.bankAccountId] ??= []).push(cashMovementFields(movement))
  }
  const serviceData = {
    appointments: appointments.map((appointment) => {
      const legacy = isRecord(appointment.legacyData) ? appointment.legacyData : {}
      return {
        ...legacy,
        id: appointment.id,
        customerId: appointment.customerId,
        vehicleId: appointment.vehicleId,
        reason: appointment.reason,
        date: appointment.date.toISOString().slice(0, 10),
        time: appointment.time,
        status: appointmentStatusNames[appointment.status],
      }
    }),
    clients: customers.map((customer) => {
      const legacy = isRecord(customer.legacyData) ? customer.legacyData : {}
      return {
        ...legacy,
        id: customer.id,
        name: customer.name,
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        vehicles: customer.vehicles.map((vehicle) => {
          const vehicleLegacy = isRecord(vehicle.legacyData) ? vehicle.legacyData : {}
          return {
            ...vehicleLegacy,
            id: vehicle.id,
            make: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year ?? 0,
            plate: vehicle.plate,
            vin: vehicle.vin ?? '',
            color: vehicle.color ?? '',
          }
        }),
      }
    }),
    inventory: items.map((item) => {
      const legacy = isRecord(item.legacyData) ? item.legacyData : {}
      return {
        ...legacy,
        id: item.id,
        description: item.name,
        reference: item.sku ?? '',
        cost: Number(item.cost),
        price: Number(item.price),
        taxRate: Number(item.taxRate),
        stock: Number(item.stock),
        type: string(legacy.type, itemNames[item.type]),
        category: item.category?.name ?? string(legacy.category),
        unit: item.unit,
        details: item.description ?? string(legacy.details),
      }
    }),
    workshopAssets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      reference: asset.reference,
      description: asset.description,
      value: Number(asset.value),
      quantity: Number(asset.quantity),
      observations: asset.observations,
    })),
    workshopCategories: categories.map(categoryFields),
    bankAccounts: accounts.map((account) => {
      const legacy = isRecord(account.legacyData) ? account.legacyData : {}
      return {
        ...legacy,
        id: account.id,
        name: account.name,
        number: string(legacy.number, account.id),
        type: string(legacy.type, accountNames[account.type]),
        initialBalance: Number(account.initialBalance),
        currentBalance: Number(account.currentBalance),
      }
    }),
    bankMovements: bankMovementsByAccount,
    orders: orders.map((order) => {
      const legacy = isRecord(order.legacyData) ? order.legacyData : {}
      return {
        ...legacy,
        id: order.id,
        status: orderStatusNames[order.status],
        date: string(legacy.date, order.receptionDate.toISOString().slice(0, 10)),
        customer: order.customer.name,
        email: string(legacy.email, order.customer.email ?? ''),
        phone: string(legacy.phone, order.customer.phone ?? ''),
        mileage: order.mileageIn ?? order.vehicle.mileage,
        invoiced: order.isFactured,
        quoteItems: order.items.map((line) => {
          const lineLegacy = isRecord(line.legacyData) ? line.legacyData : {}
          return {
            ...lineLegacy,
            id: string(lineLegacy.id, line.id),
            type: string(lineLegacy.type, itemNames[line.itemType]),
            description: string(lineLegacy.description, line.item.name),
            reference: string(lineLegacy.reference, line.item.sku ?? ''),
            cost: number(lineLegacy.cost, Number(line.item.cost)),
            price: Number(line.unitPrice),
            taxRate: Number(line.taxRate),
            quantity: Number(line.quantity),
          }
        }),
        vehicle: {
          ...(isRecord(legacy.vehicle) ? legacy.vehicle : {}),
          make: order.vehicle.brand,
          model: order.vehicle.model,
          year: order.vehicle.year ?? 0,
          plate: order.vehicle.plate,
          vin: order.vehicle.vin ?? '',
        },
        reason: order.entryReason,
      }
    }),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      type: supplier.type === SupplierType.PERSON ? 'Persona' : 'Empresa',
      name: supplier.name,
      identification: supplier.identification,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      observations: supplier.observations ?? undefined,
    })),
    cashRegister: sessions.find((session) => session.status === CashSessionStatus.OPEN)
      ? (() => {
          const active = sessions.find((session) => session.status === CashSessionStatus.OPEN)!
          return {
            openedAt: active.openedAt.toISOString(),
            initialAmount: Number(active.initialAmount),
            initialAmountUsd: Number(active.initialAmountUsd),
            openingObservations: active.openingObservations ?? '',
            movements: active.movements.map(cashSessionMovementFields),
          }
        })()
      : null,
    closedSessions: sessions.filter((session) => session.status === CashSessionStatus.CLOSED).map(sessionFields),
    settings: settings
      ? {
          name: settings.name,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          lowStockThreshold: settings.lowStockThreshold,
          notificationsEnabled: settings.notificationsEnabled,
        }
      : {
          name: 'RGR Taller',
          phone: '',
          email: '',
          address: '',
          lowStockThreshold: 5,
          notificationsEnabled: true,
        },
    activeProfile: settings?.activeProfile ?? 'Sin sesión',
  }
  return { data: serviceData, version }
}

export async function replaceRelationalWorkshopData(
  tx: Prisma.TransactionClient,
  data: JsonRecord,
  actorId: string,
): Promise<void> {
  const clients = records(data.clients, 'clients')
  const inventory = records(data.inventory, 'inventory')
  const orders = records(data.orders, 'orders')
  const appointments = records(data.appointments, 'appointments')
  const suppliers = records(data.suppliers, 'suppliers')
  const assets = records(data.workshopAssets, 'workshopAssets')
  const categories = records(data.workshopCategories, 'workshopCategories')
  const accounts = records(data.bankAccounts, 'bankAccounts')
  const closedSessions = records(data.closedSessions, 'closedSessions')
  if (!isRecord(data.settings) || !isRecord(data.bankMovements)) {
    throw Object.assign(new Error('La configuración o los movimientos bancarios no tienen un formato válido.'), { status: 400 })
  }
  if (data.cashRegister !== null && !isRecord(data.cashRegister)) {
    throw Object.assign(new Error('La caja abierta no tiene un formato válido.'), { status: 400 })
  }

  const defaultCategoryNames = new Set(inventory.map((entry) => string(entry.category)).filter(Boolean))
  const categoriesToCreate = categories.length
    ? categories
    : [...defaultCategoryNames].map((category, index) => ({
        id: `category-${index + 1}`,
        category,
        specialty: 'Mecánica General',
        description: '',
      }))
  const categoryByName = new Map<string, { id: string; name: string; legacy: Prisma.InputJsonObject }>()
  for (const category of categoriesToCreate) {
    const name = string(category.category).trim()
    if (!name) continue
    categoryByName.set(normalized(name), {
      id: string(category.id, randomUUID()),
      name,
      legacy: without(category, ['category']),
    })
  }

  const clientById = new Map<string, JsonRecord>()
  const vehicleById = new Map<string, { clientId: string; vehicle: JsonRecord }>()
  const vehicleByPlate = new Map<string, { clientId: string; vehicle: JsonRecord }>()
  for (const client of clients) {
    const clientId = string(client.id)
    if (!clientId) throw Object.assign(new Error('Cada cliente debe tener un id.'), { status: 400 })
    clientById.set(clientId, client)
    for (const vehicle of records(client.vehicles, `vehicles de ${clientId}`)) {
      const vehicleId = string(vehicle.id)
      if (!vehicleId) throw Object.assign(new Error(`Cada vehículo del cliente ${clientId} debe tener un id.`), { status: 400 })
      const entry = { clientId, vehicle }
      vehicleById.set(vehicleId, entry)
      const plate = string(vehicle.plate)
      if (plate) vehicleByPlate.set(normalized(plate), entry)
    }
  }

  const inventoryByReference = new Map<string, JsonRecord>()
  for (const item of inventory) {
    if (string(item.reference)) inventoryByReference.set(normalized(string(item.reference)), item)
  }
  const orderLinks = new Map<string, { customerId: string; vehicleId: string }>()
  for (const order of orders) {
    const orderId = string(order.id)
    const customer = clients.find((client) => normalized(string(client.name)) === normalized(string(order.customer)))
    const plate = isRecord(order.vehicle) ? normalized(string(order.vehicle.plate)) : ''
    const customerId = customer ? string(customer.id) : ''
    const matchingPlate = plate ? vehicleByPlate.get(plate) : undefined
    const selectedVehicle = matchingPlate?.clientId === customerId
      ? matchingPlate
      : (customer ? [...vehicleById.values()].find((entry) => entry.clientId === customerId) : undefined)
    if (!orderId || !customer || !selectedVehicle) {
      throw Object.assign(new Error(`La orden ${orderId || '(sin id)'} debe referenciar un cliente y un vehículo existentes.`), { status: 400 })
    }
    orderLinks.set(orderId, { customerId: string(customer.id), vehicleId: string(selectedVehicle.vehicle.id) })
  }

  const sessions: JsonRecord[] = [
    ...(isRecord(data.cashRegister) ? [{ ...data.cashRegister, id: 'active-cash-register', status: 'OPEN' }] : []),
    ...closedSessions.map((session) => ({ ...session, status: 'CLOSED' })),
  ]

  await tx.cashMovement.deleteMany()
  await tx.invoiceItem.deleteMany()
  await tx.invoice.deleteMany()
  await tx.quotationItem.deleteMany()
  await tx.quotation.deleteMany()
  await tx.serviceOrderItem.deleteMany()
  await tx.timeEntry.deleteMany()
  await tx.appointment.deleteMany()
  await tx.cashSession.deleteMany()
  await tx.supplier.deleteMany()
  await tx.workshopAsset.deleteMany()
  await tx.serviceOrder.deleteMany()
  await tx.vehicle.deleteMany()
  await tx.customer.deleteMany()
  await tx.item.deleteMany()
  await tx.category.deleteMany()
  await tx.bankAccount.deleteMany()

  for (const category of categoryByName.values()) {
    await tx.category.create({
      data: { id: category.id, name: category.name, legacyData: category.legacy },
    })
  }
  for (const client of clients) {
    const clientId = string(client.id)
    await tx.customer.create({
      data: {
        id: clientId,
        name: string(client.name),
        email: string(client.email) || null,
        phone: string(client.phone) || null,
        legacyData: without(client, ['id', 'name', 'email', 'phone', 'vehicles']),
      },
    })
    for (const vehicle of records(client.vehicles, `vehicles de ${clientId}`)) {
      const vehicleId = string(vehicle.id)
      const plate = string(vehicle.plate) || `LEGACY-${vehicleId}`
      await tx.vehicle.create({
        data: {
          id: vehicleId,
          plate,
          brand: string(vehicle.make),
          model: string(vehicle.model),
          year: Math.trunc(number(vehicle.year)) || null,
          color: string(vehicle.color) || null,
          vin: string(vehicle.vin) || null,
          customerId: clientId,
          legacyData: without(vehicle, ['id', 'make', 'model', 'year', 'plate', 'vin', 'color']),
        },
      })
    }
  }

  const itemIdsByReference = new Map<string, string>()
  for (const item of inventory) {
    const id = string(item.id)
    const category = categoryByName.get(normalized(string(item.category)))
    await tx.item.create({
      data: {
        id,
        name: string(item.description),
        type: itemType(item.type),
        sku: string(item.reference) || null,
        description: string(item.details) || null,
        unit: string(item.unit, 'unidad') || 'unidad',
        cost: new Prisma.Decimal(number(item.cost)),
        price: new Prisma.Decimal(number(item.price)),
        taxRate: new Prisma.Decimal(number(item.taxRate, 18)),
        stock: new Prisma.Decimal(number(item.stock)),
        minStock: new Prisma.Decimal(0),
        categoryId: category?.id ?? null,
        legacyData: without(item, ['id', 'description', 'reference', 'cost', 'price', 'taxRate', 'stock', 'unit', 'details', 'category']),
      },
    })
    if (string(item.reference)) itemIdsByReference.set(normalized(string(item.reference)), id)
  }

  for (const order of orders) {
    const orderId = string(order.id)
    const link = orderLinks.get(orderId)!
    const orderDate = date(order.dateISO ?? order.date)
    const timestamps = isRecord(order.timestamps) ? order.timestamps : {}
    const diagnosis = isRecord(order.diagnosis) ? order.diagnosis : {}
    const qualityControl = isRecord(order.qualityControl) ? order.qualityControl : {}
    const orderItems = records(order.quoteItems ?? [], `quoteItems de ${orderId}`)
    const lineIds: string[] = []
    const lineTotals: number[] = []
    await tx.serviceOrder.create({
      data: {
        id: orderId,
        consecutiveNumber: (await tx.serviceOrder.count()) + 1,
        status: orderStatuses[string(order.status)] ?? ServiceStatus.RECEPTION,
        customerId: link.customerId,
        vehicleId: link.vehicleId,
        receptionDate: orderDate,
        diagnosisDate: typeof timestamps.fechaDiagnostico === 'string' ? date(timestamps.fechaDiagnostico) : null,
        approvalDate: typeof timestamps.fechaAprobacion === 'string' ? date(timestamps.fechaAprobacion) : null,
        repairStartDate: typeof timestamps.fechaInicioReparacion === 'string' ? date(timestamps.fechaInicioReparacion) : null,
        deliveryDate: typeof timestamps.fechaEntrega === 'string' ? date(timestamps.fechaEntrega) : null,
        entryReason: string(order.reason),
        diagnosisNotes: string(diagnosis.findings) || null,
        qcNotes: string(qualityControl.observations) || null,
        mileageIn: Math.trunc(number(order.mileage)),
        isFactured: order.invoiced === true,
        legacyData: orderLegacyData(order),
      },
    })
    for (const [index, item] of orderItems.entries()) {
      const reference = string(item.reference)
      let itemId = reference ? itemIdsByReference.get(normalized(reference)) : undefined
      if (!itemId) {
        itemId = `legacy-item-${orderId}-${index + 1}`
        await tx.item.create({
          data: {
            id: itemId,
            name: string(item.description, `Ítem legado ${index + 1}`),
            type: itemType(item.type),
            sku: null,
            description: string(item.description) || null,
            cost: new Prisma.Decimal(number(item.cost)),
            price: new Prisma.Decimal(number(item.price)),
            taxRate: new Prisma.Decimal(number(item.taxRate, 18)),
            stock: new Prisma.Decimal(0),
            isActive: false,
          },
        })
      }
      const itemIdForLine = itemId
      lineIds.push(itemIdForLine)
      const base = number(item.price) * number(item.quantity, 1) * (1 - number(item.discount) / 100)
      lineTotals.push(base * (1 + number(item.taxRate, 18) / 100))
      await tx.serviceOrderItem.create({
        data: {
          id: `service-item-${orderId}-${index + 1}`,
          serviceOrderId: orderId,
          itemId: itemIdForLine,
          quantity: new Prisma.Decimal(number(item.quantity, 1)),
          unitPrice: new Prisma.Decimal(number(item.price)),
          total: new Prisma.Decimal(lineTotals[index]),
          taxRate: new Prisma.Decimal(number(item.taxRate, 18)),
          itemType: itemType(item.type),
          legacyData: without(item, ['description', 'reference', 'cost', 'price', 'taxRate', 'quantity']),
        },
      })
    }
    if (order.invoiced === true) {
      const total = number(order.invoiceTotal, lineTotals.reduce((sum, amount) => sum + amount, 0))
      const subtotal = orderItems.reduce(
        (sum, line) => sum + number(line.price) * number(line.quantity, 1) * (1 - number(line.discount) / 100),
        0,
      )
      await tx.invoice.create({
        data: {
          id: `invoice-${orderId}`,
          consecutiveNumber: (await tx.invoice.count()) + 1,
          customerId: link.customerId,
          date: orderDate,
          subtotal: new Prisma.Decimal(subtotal),
          taxAmount: new Prisma.Decimal(total - subtotal),
          total: new Prisma.Decimal(total),
          status: InvoiceStatus.ISSUED,
          paymentMethod: paymentMethods[string(order.invoicePaymentMethod)] ?? null,
          items: {
            create: orderItems.map((line, index) => ({
              id: `invoice-item-${orderId}-${index + 1}`,
              itemId: lineIds[index],
              quantity: new Prisma.Decimal(number(line.quantity, 1)),
              unitPrice: new Prisma.Decimal(number(line.price)),
              total: new Prisma.Decimal(lineTotals[index]),
            })),
          },
        },
      })
      const payments = records(order.payments ?? [], `payments de ${orderId}`)
      for (const payment of payments) {
        const paymentAccountType = accountLabels[string(payment.method)]
        const account = paymentAccountType
          ? await tx.bankAccount.findFirst({ where: { type: paymentAccountType }, orderBy: { name: 'asc' } })
          : null
        if (!account) continue
        await tx.cashMovement.create({
          data: {
            id: `payment-${string(payment.id, randomUUID())}`,
            bankAccountId: account.id,
            type: MovementType.INCOME,
            amount: new Prisma.Decimal(number(payment.amount)),
            description: string(payment.concept) || `Pago de factura ${orderId}`,
            userId: actorId,
            invoiceId: `invoice-${orderId}`,
            createdAt: date(payment.timestamp ?? payment.date, orderDate),
          },
        })
      }
    }
  }

  for (const appointment of appointments) {
    const appointmentId = string(appointment.id)
    const customerId = string(appointment.customerId)
    const vehicleId = string(appointment.vehicleId)
    if (!clientById.has(customerId) || vehicleById.get(vehicleId)?.clientId !== customerId) {
      throw Object.assign(new Error(`La cita ${appointmentId} debe referenciar un cliente y un vehículo existentes.`), { status: 400 })
    }
    await tx.appointment.create({
      data: {
        id: appointmentId,
        customerId,
        vehicleId,
        reason: string(appointment.reason),
        date: date(appointment.date),
        time: string(appointment.time),
        status: appointmentStatuses[string(appointment.status)] ?? AppointmentStatus.SCHEDULED,
        legacyData: without(appointment, ['id', 'customerId', 'vehicleId', 'reason', 'date', 'time', 'status']),
      },
    })
  }
  for (const supplier of suppliers) {
    await tx.supplier.create({
      data: {
        id: string(supplier.id),
        type: string(supplier.type) === 'Persona' ? SupplierType.PERSON : SupplierType.COMPANY,
        name: string(supplier.name),
        identification: string(supplier.identification),
        email: string(supplier.email),
        phone: string(supplier.phone),
        address: string(supplier.address),
        observations: string(supplier.observations) || null,
        legacyData: without(supplier, ['id', 'type', 'name', 'identification', 'email', 'phone', 'address', 'observations']),
      },
    })
  }
  for (const asset of assets) {
    await tx.workshopAsset.create({
      data: {
        id: string(asset.id),
        name: string(asset.name),
        reference: string(asset.reference),
        description: string(asset.description),
        value: new Prisma.Decimal(number(asset.value)),
        quantity: new Prisma.Decimal(number(asset.quantity, 1)),
        observations: string(asset.observations),
        legacyData: without(asset, ['id', 'name', 'reference', 'description', 'value', 'quantity', 'observations']),
      },
    })
  }
  for (const account of accounts) {
    const accountType = string(account.type)
    const idAndName = `${string(account.id)} ${string(account.name)}`.toLocaleLowerCase()
    const mappedType = accountType === 'Efectivo' && /usd|dólar|dolar/.test(idAndName)
      ? AccountType.CASH_USD
      : accountType === 'Billetera' && /plin/.test(idAndName)
        ? AccountType.PLIN
        : accountLabels[accountType] ?? AccountType.TRANSFER
    await tx.bankAccount.create({
      data: {
        id: string(account.id),
        name: string(account.name),
        type: mappedType,
        initialBalance: new Prisma.Decimal(number(account.initialBalance)),
        currentBalance: new Prisma.Decimal(number(account.currentBalance)),
        legacyData: without(account, ['id', 'name', 'initialBalance', 'currentBalance']),
      },
    })
  }
  for (const [accountId, movements] of Object.entries(data.bankMovements)) {
    if (!accounts.some((account) => string(account.id) === accountId)) {
      throw Object.assign(new Error(`Los movimientos hacen referencia a la cuenta ${accountId} que no existe.`), { status: 400 })
    }
    for (const movement of records(movements, `bankMovements.${accountId}`)) {
      const movementType = string(movement.type) === 'Egreso' ? MovementType.EXPENSE : MovementType.INCOME
      await tx.cashMovement.create({
        data: {
          id: string(movement.id, randomUUID()),
          bankAccountId: accountId,
          type: movementType,
          amount: new Prisma.Decimal(number(movement.amount)),
          description: string(movement.concept),
          userId: actorId,
          createdAt: date(movement.date),
          legacyData: without(movement, ['id', 'type', 'amount', 'concept']),
        },
      })
    }
  }
  for (const session of sessions) {
    const sessionId = string(session.id)
    const movements = records(session.movements ?? [], `movements de ${sessionId}`)
    await tx.cashSession.create({
      data: {
        id: sessionId,
        openedAt: date(session.openedAt),
        closedAt: session.closedAt ? date(session.closedAt) : null,
        closedBy: string(session.closedBy) || null,
        status: session.status === 'CLOSED' ? CashSessionStatus.CLOSED : CashSessionStatus.OPEN,
        initialAmount: new Prisma.Decimal(number(session.initialAmount)),
        totalIncomes: new Prisma.Decimal(number(session.totalIncomes)),
        totalExpenses: new Prisma.Decimal(number(session.totalExpenses)),
        expectedBalance: new Prisma.Decimal(number(session.expectedBalance)),
        actualBalance: new Prisma.Decimal(number(session.actualBalance)),
        difference: new Prisma.Decimal(number(session.difference)),
        initialAmountUsd: new Prisma.Decimal(number(session.initialAmountUsd)),
        totalIncomesUsd: new Prisma.Decimal(number(session.totalIncomesUsd)),
        totalExpensesUsd: new Prisma.Decimal(number(session.totalExpensesUsd)),
        expectedBalanceUsd: new Prisma.Decimal(number(session.expectedBalanceUsd)),
        actualBalanceUsd: new Prisma.Decimal(number(session.actualBalanceUsd)),
        differenceUsd: new Prisma.Decimal(number(session.differenceUsd)),
        openingObservations: string(session.openingObservations) || null,
        observations: string(session.observations) || null,
        legacyData: without(session, ['id', 'openedAt', 'closedAt', 'closedBy', 'status', 'initialAmount', 'totalIncomes', 'totalExpenses', 'expectedBalance', 'actualBalance', 'difference', 'initialAmountUsd', 'totalIncomesUsd', 'totalExpensesUsd', 'expectedBalanceUsd', 'actualBalanceUsd', 'differenceUsd', 'openingObservations', 'observations', 'movements']),
        movements: {
          create: movements.map((movement, index) => ({
            id: `${sessionId}-${string(movement.id, String(index + 1))}`,
            type: string(movement.type) === 'Egreso' ? MovementType.EXPENSE : MovementType.INCOME,
            concept: string(movement.concept),
            amount: new Prisma.Decimal(number(movement.amount)),
            currency: movement.currency === 'USD' ? CashCurrency.USD : CashCurrency.PEN,
            paymentMethod: paymentMethods[string(movement.paymentMethod)] ?? null,
            expenseCategory: string(movement.expenseCategory) || null,
            orderId: string(movement.orderId) || null,
            contact: string(movement.contact) || null,
            timestamp: date(movement.timestamp),
            legacyData: without(movement, ['type', 'concept', 'amount', 'currency', 'paymentMethod', 'expenseCategory', 'orderId', 'contact', 'timestamp']),
          })),
        },
      },
    })
  }
  await tx.workshopSettings.upsert({
    where: { id: stateId },
    create: {
      id: stateId,
      name: string(data.settings.name, 'RGR Taller'),
      phone: string(data.settings.phone),
      email: string(data.settings.email),
      address: string(data.settings.address),
      lowStockThreshold: Math.trunc(number(data.settings.lowStockThreshold, 5)),
      notificationsEnabled: data.settings.notificationsEnabled !== false,
      activeProfile: string(data.activeProfile, 'Sin sesión'),
    },
    update: {
      name: string(data.settings.name, 'RGR Taller'),
      phone: string(data.settings.phone),
      email: string(data.settings.email),
      address: string(data.settings.address),
      lowStockThreshold: Math.trunc(number(data.settings.lowStockThreshold, 5)),
      notificationsEnabled: data.settings.notificationsEnabled !== false,
      activeProfile: string(data.activeProfile, 'Sin sesión'),
    },
  })
}

export async function saveRelationalWorkshopData(
  data: JsonRecord,
  expectedVersion: number,
  actorId: string,
): Promise<{ version: number } | null> {
  await ensureVersion(prisma)
  return prisma.$transaction(async (tx) => {
    const changed = await tx.workshopDataVersion.updateMany({
      where: { id: stateId, version: expectedVersion },
      data: { version: { increment: 1 } },
    })
    if (changed.count !== 1) return null
    await replaceRelationalWorkshopData(tx, data, actorId)
    const version = await tx.workshopDataVersion.findUniqueOrThrow({
      where: { id: stateId },
      select: { version: true },
    })
    return { version: version.version }
  })
}
