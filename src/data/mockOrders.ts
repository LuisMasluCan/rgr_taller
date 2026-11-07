import { orders as seedOrders, orderStages } from './mockData'
import type { Order } from '../types'

const demoCustomers = [
  ['202611040487', 'Valeria Ríos Cárdenas', 'Hyundai', 'Tucson', 'D8M-428', 'KMHJU81BBDU123487', 'Vibración al frenar a alta velocidad', 'Revisar discos y pastillas de freno.', 'Miguel Torres'],
  ['202611040488', 'Pedro Salazar Núñez', 'Nissan', 'Versa', 'B5K-216', '3N1CN7AP6GL123488', 'Mantenimiento preventivo', 'Cambio de aceite y filtros.', 'Andrea Rojas'],
  ['202611040489', 'Ana Lucía Ponce', 'Mazda', 'CX-5', 'C4R-901', 'JM3KFBDM0L0123489', 'Ruido en suspensión delantera', 'Revisión de bujes y amortiguadores.', 'José Luis Paredes'],
  ['202611040490', 'Ricardo Vega Flores', 'Chevrolet', 'Tracker', 'A7T-330', 'KL79MPSL2NB123490', 'Luz de motor encendida', 'Diagnóstico electrónico y escaneo.', 'Miguel Torres'],
  ['202611040491', 'Camila Herrera Díaz', 'Kia', 'Sportage', 'F3J-550', 'KNDPB3AC5F7123491', 'Revisión de sistema de enfriamiento', 'Verificar radiador y termostato.', 'Andrea Rojas'],
  ['202611040492', 'Javier Campos León', 'Honda', 'Civic', 'B2L-614', '2HGFC2F59HH123492', 'Cambio de embrague', 'Evaluar kit de embrague y transmisión.', 'José Luis Paredes'],
  ['202611040493', 'Daniela Castillo Paz', 'Toyota', 'Corolla', 'C8P-772', 'JTDBU4EE9AJ123493', 'Mantenimiento de 50,000 km', 'Servicio general y revisión de frenos.', 'Miguel Torres'],
  ['202611040494', 'Óscar Medina Ruiz', 'Volkswagen', 'Tiguan', 'D1V-804', 'WVGZZZ5NZJW123494', 'Falla en aire acondicionado', 'Revisar compresor y carga de gas.', 'Andrea Rojas'],
  ['202611040495', 'Patricia Núñez Soto', 'Suzuki', 'Vitara', 'A6N-125', 'TSMLYDA1S00123495', 'Revisión de dirección', 'Inspeccionar terminales y alineamiento.', 'José Luis Paredes'],
  ['202611040496', 'Marco Antonio Gil', 'Ford', 'EcoSport', 'F9G-386', 'MAJ6P1UL5JC123496', 'Cambio de batería', 'Prueba de carga y alternador.', 'Miguel Torres'],
  ['202611040497', 'Sofía Ramos Paredes', 'Mitsubishi', 'ASX', 'B3S-508', 'JA4AP3AU0KU123497', 'Revisión de caja automática', 'Evaluar cambios y nivel de fluido.', 'Andrea Rojas'],
] as const

const extraStatuses = [
  'Aprobación',
  'Aprobación',
  'Reparación',
  'Reparación',
  'Reparación',
  'Reparación',
  'Entrega',
  'Entrega',
  'Entrega',
  'Entrega',
  'Entrega',
] as const

const demoOrders: Order[] = demoCustomers.map((customer, index) => {
  const [id, name, make, model, plate, vin, reason, comments, technician] = customer
  const seed = seedOrders[index % seedOrders.length]
  return {
    ...seed,
    id,
    status: extraStatuses[index],
    invoiced: extraStatuses[index] === 'Entrega',
    date: '04 nov. 2026',
    dateISO: '2026-11-04',
    customer: name,
    email: `${id.slice(-3)}@cliente.demo`,
    phone: '+51 900 000 000',
    mileage: 18000 + index * 2350,
    arrivalPhotos: [],
    vehicle: { ...seed.vehicle, make, model, year: 2019 + index % 6, plate, vin },
    reason,
    technician,
    comments,
    quoteItems: extraStatuses[index] === 'Aprobación' || extraStatuses[index] === 'Reparación'
      ? seed.quoteItems
      : [],
  }
})

export const mockOrders: Order[] = [...seedOrders, ...demoOrders]
export { orderStages }
