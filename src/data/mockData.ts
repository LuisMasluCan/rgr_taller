import type { Appointment, Client, InventoryItem, InvoiceItem, Order } from '../types'

export const clients: Client[] = [
  {
    id: '45872136',
    name: 'María Fernanda Salazar',
    email: 'maria.salazar@email.com',
    phone: '+51 987 654 321',
    vehicles: [
      { id: 'vehicle-1', make: 'Renault', model: 'Kwid', year: 2022, plate: 'BVK-318', vin: 'VF1RJA00XN0123456', color: 'Blanco' },
      { id: 'vehicle-2', make: 'Kia', model: 'Picanto', year: 2020, plate: 'C7A-194', vin: 'KNAB2511ALQ045678', color: 'Rojo' },
    ],
  },
  {
    id: '70214589',
    name: 'Carlos Alberto Mendoza',
    email: 'carlos.mendoza@email.com',
    phone: '+51 965 432 187',
    vehicles: [
      { id: 'vehicle-3', make: 'Toyota', model: 'Yaris', year: 2021, plate: 'F2K-527', vin: 'JTDBW3D3XMJ067890', color: 'Gris' },
    ],
  },
  {
    id: '41682957',
    name: 'Lucía del Pilar Torres',
    email: 'lucia.torres@email.com',
    phone: '+51 944 281 630',
    vehicles: [],
  },
  {
    id: '10563842',
    name: 'Jorge Luis Quispe',
    email: 'jorge.quispe@email.com',
    phone: '+51 981 207 456',
    vehicles: [
      { id: 'vehicle-4', make: 'Hyundai', model: 'Accent', year: 2019, plate: 'A8D-605', vin: 'KMHCT41D9KU234567', color: 'Plata' },
    ],
  },
]

export const appointments: Appointment[] = [
  {
    id: 'appointment-1',
    customerId: '45872136',
    vehicleId: 'vehicle-1',
    reason: 'Mantenimiento preventivo',
    date: '2026-11-03',
    time: '09:30',
    status: 'Programada',
  },
  {
    id: 'appointment-2',
    customerId: '70214589',
    vehicleId: 'vehicle-3',
    reason: 'Revisión de frenos',
    date: '2026-11-04',
    time: '11:00',
    status: 'Programada',
  },
]

export const orders: Order[] = [
  {
    id: '202610260469',
    status: 'Entrega',
    invoiced: true,
    invoiceTotal: 1260,
    quoteDiscountPercent: 0,
    quoteItems: [
      { id: 'line-1', type: 'Mano de obra', description: 'Diagnóstico A/C', reference: 'SRV-DIAG-AC', cost: 0, price: 260, discount: 0, taxRate: 0, quantity: 1, status: 'Aprobado' },
      { id: 'line-2', type: 'Repuesto', description: 'Sensor de A/C', reference: 'SAC-0248', cost: 185, price: 650, discount: 0, taxRate: 0, quantity: 1, status: 'Aprobado' },
      { id: 'line-3', type: 'Insumo', description: 'Relleno de A/C', reference: 'GAS-R134A', cost: 90, price: 350, discount: 0, taxRate: 0, quantity: 1, status: 'Aprobado' },
    ],
    payments: [
      { id: 'payment-seed-1', date: '26 oct. 2026', method: 'Caja - Efectivo', concept: 'Abono a cuenta', amount: 500 },
    ],
    timestamps: {
      fechaIngreso: '2026-10-26T08:00:00-05:00',
      fechaDiagnostico: '2026-10-26T10:00:00-05:00',
      fechaRepuestos: '2026-10-26T12:00:00-05:00',
      fechaAprobacion: '2026-10-26T14:00:00-05:00',
      fechaInicioReparacion: '2026-10-27T08:00:00-05:00',
      fechaControl: '2026-10-27T13:00:00-05:00',
      fechaEntrega: '2026-10-28T10:00:00-05:00',
    },
    date: '26 oct. 2026',
    dateISO: '2026-10-26',
    customer: 'María Fernanda Salazar',
    email: 'maria.salazar@email.com',
    phone: '+51 987 654 321',
    mileage: 28450,
    arrivalPhotos: [],
    vehicle: {
      make: 'Renault',
      model: 'Kwid',
      year: 2022,
      plate: 'BVK-318',
      vin: 'VF1RJA00XN0123456',
    },
    reason: 'Falla en sistema de aire acondicionado',
    technician: 'José Luis Paredes',
    comments: 'Se realizó diagnóstico, revisión de sensor y recarga de gas. Cliente solicita entrega hoy.',
  },
  {
    id: '202610250312',
    status: 'Entrega',
    invoiced: false,
    timestamps: {
      fechaIngreso: '2026-10-25T09:00:00-05:00',
      fechaDiagnostico: '2026-10-25T10:30:00-05:00',
      fechaRepuestos: '2026-10-25T11:00:00-05:00',
      fechaAprobacion: '2026-10-25T12:00:00-05:00',
      fechaInicioReparacion: '2026-10-25T13:00:00-05:00',
      fechaControl: '2026-10-25T17:00:00-05:00',
      fechaEntrega: '2026-10-26T09:00:00-05:00',
    },
    date: '25 oct. 2026',
    dateISO: '2026-10-25',
    customer: 'Carlos Alberto Mendoza',
    email: 'carlos.mendoza@email.com',
    phone: '+51 965 432 187',
    mileage: 41620,
    arrivalPhotos: [],
    vehicle: {
      make: 'Toyota',
      model: 'Yaris',
      year: 2021,
      plate: 'F2K-527',
      vin: 'JTDBW3D3XMJ067890',
    },
    reason: 'Mantenimiento preventivo y revisión de frenos',
    technician: 'Andrea Rojas',
    comments: 'Mantenimiento completado. Pendiente coordinar recojo con el cliente.',
  },
]

export const inventory: InventoryItem[] = [
  {
    id: 'REP-001',
    description: 'Sensor de A/C',
    reference: 'SAC-0248',
    cost: 185,
    price: 285,
    taxRate: 18,
    stock: 8,
  },
  {
    id: 'INS-002',
    description: 'Relleno de A/C',
    reference: 'GAS-R134A',
    cost: 90,
    price: 165,
    taxRate: 18,
    stock: 12,
  },
  {
    id: 'SRV-003',
    description: 'Diagnóstico A/C',
    reference: 'SRV-DIAG-AC',
    cost: 0,
    price: 180,
    taxRate: 18,
    stock: 999,
  },
  {
    id: 'REP-004',
    description: 'Filtro de cabina',
    reference: 'FC-KW-220',
    cost: 42,
    price: 78,
    taxRate: 18,
    stock: 15,
  },
]

export const initialInvoiceItems: InvoiceItem[] = [
  {
    id: 'line-1',
    description: 'Diagnóstico A/C',
    reference: 'SRV-DIAG-AC',
    cost: 0,
    price: 260,
    discount: 0,
    taxRate: 0,
    quantity: 1,
  },
  {
    id: 'line-2',
    description: 'Sensor de A/C',
    reference: 'SAC-0248',
    cost: 0,
    price: 650,
    discount: 0,
    taxRate: 0,
    quantity: 1,
  },
  {
    id: 'line-3',
    description: 'Relleno de A/C',
    reference: 'GAS-R134A',
    cost: 0,
    price: 350,
    discount: 0,
    taxRate: 0,
    quantity: 1,
  },
]

export const orderStages = [
  { name: 'Recepción', count: 8 },
  { name: 'Diagnóstico', count: 5 },
  { name: 'Repuestos', count: 3 },
  { name: 'Aprobación', count: 2 },
  { name: 'Reparación', count: 4 },
  { name: 'Control', count: 2 },
  { name: 'Entrega', count: 2 },
  { name: 'Archivados', count: 18 },
]
