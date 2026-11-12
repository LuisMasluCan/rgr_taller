export type Order = {
  id: string
  status: string
  timestamps?: OrderTimestamps
  cancellationStatus?: 'Servicio anulado'
  canceledAt?: string
  invoiced: boolean
  date: string
  dateISO?: string
  invoiceTotal?: number
  invoicePaymentMethod?: string
  quoteItems?: OrderServiceItem[]
  quoteInitialized?: boolean
  quoteDiscountPercent?: number
  payments?: Payment[]
  quoteSaved?: boolean
  quoteNumber?: string
  convertedToOrderId?: string
  sourceQuoteId?: string
  sourceAppointmentId?: string
  diagnosis?: OrderDiagnosis
  customerApproval?: {
    approvedAt: string
  }
  qualityControl?: OrderQualityControl
  customer: string
  email: string
  phone: string
  mileage: number
  arrivalPhotos: OrderPhoto[]
  vehicle: {
    make: string
    model: string
    year: number
    plate: string
    vin: string
  }
  reason: string
  technician: string
  comments: string
}

export type Appointment = {
  id: string
  customerId: string
  vehicleId: string
  reason: string
  date: string
  time: string
  status: 'Programada' | 'Completada' | 'Cancelada'
}

export type OrderDiagnosis = {
  findings: string
  proposedWork: string
  technician: string
  createdAt: string
}

export type OrderQualityControl = {
  workVerified: boolean
  roadTest: boolean
  vehicleCondition: 'Correcto' | 'Con observaciones'
  satisfactory: boolean
  fuelLevel?: 'Vacío' | '1/4' | '1/2' | '3/4' | 'Lleno'
  actualMileage?: number
  resolution?: string
  vehicleChecklist?: string[]
  fluidsChecklist?: string[]
  approved?: boolean
  observations: string
  inspector: string
  inspectedAt: string
}

export type OrderTimestamps = {
  fechaIngreso?: string
  fechaDiagnostico?: string
  fechaRepuestos?: string
  fechaAprobacion?: string
  fechaInicioReparacion?: string
  fechaControl?: string
  fechaEntrega?: string
  fechaArchivado?: string
}

export type OrderServiceItem = {
  id: string
  type: 'Mano de obra' | 'Repuesto' | 'Insumo' | 'Servicio Compuesto' | 'Adicional'
  description: string
  reference: string
  cost: number
  marginPercent?: number
  price: number
  discount: number
  taxRate: number
  quantity: number
  status: 'Aprobado' | 'Pendiente'
  laborHours?: number
}

export type Payment = {
  id: string
  date: string
  timestamp?: string
  method: string
  concept: string
  amount: number
}

export type OrderPhoto = {
  name: string
  dataUrl: string
}

export type WorkshopSettings = {
  name: string
  phone: string
  email: string
  address: string
  lowStockThreshold: number
  notificationsEnabled: boolean
}

export type InventoryItem = {
  id: string
  description: string
  reference: string
  cost: number
  price: number
  taxRate: number
  stock: number
  type?: 'Mano de Obra' | 'Repuesto' | 'Insumo' | 'Servicio Compuesto'
  specialty?: string
  category?: string
  brand?: string
  unit?: string
  marginPercent?: number
  location?: string
  details?: string
  laborHours?: number
  complexity?: 'A' | 'B' | 'C'
  components?: { itemId: string; quantity: number }[]
}

export type WorkshopAsset = {
  id: string
  name: string
  reference: string
  description: string
  value: number
  quantity: number
  observations: string
}

export type WorkshopCategory = {
  id: string
  specialty: string
  category: string
  description: string
}

export type InvoiceItem = {
  id: string
  description: string
  reference: string
  cost: number
  price: number
  discount: number
  taxRate: number
  quantity: number
}

export type Vehicle = {
  id: string
  make: string
  model: string
  year: number
  plate: string
  vin: string
  color: string
}

export type Client = {
  id: string
  name: string
  email: string
  phone: string
  vehicles: Vehicle[]
}

export type Supplier = {
  id: string
  type: 'Empresa' | 'Persona'
  name: string
  identification: string
  email: string
  phone: string
  address: string
  observations?: string
}

export type CashMovement = {
  id: string
  type: 'Ingreso' | 'Egreso'
  concept: string
  amount: number
  timestamp: string
  paymentMethod?: 'Efectivo' | 'Transferencia' | 'Yape' | 'Plin' | 'Tarjeta de crédito' | 'Tarjeta de débito'
  currency?: 'PEN' | 'USD'
  expenseCategory?: 'Gasto General del Taller' | 'Asociado a Orden de Servicio'
  orderId?: string
  contact?: string
}

export type CashRegister = {
  openedAt: string
  initialAmount: number
  initialAmountUsd?: number
  openingObservations?: string
  movements: CashMovement[]
} | null

export type ClosedCashSession = {
  id: string
  openedAt: string
  closedAt: string
  closedBy: string
  initialAmount: number
  totalIncomes: number
  totalExpenses: number
  expectedBalance: number
  actualBalance: number
  difference: number
  initialAmountUsd?: number
  totalIncomesUsd?: number
  totalExpensesUsd?: number
  expectedBalanceUsd?: number
  actualBalanceUsd?: number
  differenceUsd?: number
  openingObservations?: string
  observations: string
  movements: CashMovement[]
}
