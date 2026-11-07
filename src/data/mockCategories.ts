import type { WorkshopCategory } from '../types'

export const categorySpecialties = [
  'Mecánica General',
  'Electricidad',
  'Planchado y Pintura',
  'Mantenimiento',
]

export const categoriesBySpecialty: Record<string, string[]> = {
  'Mecánica General': ['Frenos', 'Suspensión', 'Motor'],
  Electricidad: ['Baterías', 'Luces'],
  'Planchado y Pintura': ['Planchado', 'Pintura'],
  Mantenimiento: ['Preventivo', 'Correctivo'],
}

export const mockCategories: WorkshopCategory[] = [
  { id: 'category-mecanica-frenos', specialty: 'Mecánica General', category: 'Frenos', description: 'Sistema de frenos, pastillas, discos y líquido.' },
  { id: 'category-mecanica-suspension', specialty: 'Mecánica General', category: 'Suspensión', description: 'Suspensión, amortiguadores y dirección.' },
  { id: 'category-mecanica-motor', specialty: 'Mecánica General', category: 'Motor', description: 'Diagnóstico y reparación de motor.' },
  { id: 'category-electricidad-baterias', specialty: 'Electricidad', category: 'Baterías', description: 'Baterías, carga y sistema de arranque.' },
  { id: 'category-electricidad-luces', specialty: 'Electricidad', category: 'Luces', description: 'Iluminación y componentes eléctricos.' },
]
