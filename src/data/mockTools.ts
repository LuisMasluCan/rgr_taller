import type { WorkshopAsset } from '../types'

export const mockTools: WorkshopAsset[] = [
  {
    id: 'tool-elevador-2-columnas',
    name: 'Elevador de 2 columnas',
    reference: 'ELEV-2C-4000',
    description: 'Elevador electrohidráulico de 4 toneladas para servicio liviano.',
    value: 12800,
    quantity: 1,
    observations: 'Operativo. Mantenimiento preventivo realizado en octubre.',
  },
  {
    id: 'tool-compresor-aire',
    name: 'Compresor de aire',
    reference: 'COMP-200L-3HP',
    description: 'Compresor de 200 litros para herramientas neumáticas.',
    value: 3650,
    quantity: 1,
    observations: 'Revisar drenaje del tanque cada semana.',
  },
  {
    id: 'tool-scanner-obd2',
    name: 'Escáner OBD2 Launch',
    reference: 'LAUNCH-X431',
    description: 'Escáner de diagnóstico automotriz multimarca.',
    value: 4750,
    quantity: 2,
    observations: 'Incluye cables y estuche de transporte.',
  },
]
