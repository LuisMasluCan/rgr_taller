export type MockUser = {
  id: string
  name: string
  role: 'Técnico'
}

export const mockUsers: MockUser[] = [
  { id: 'tech-1', name: 'José Luis Paredes', role: 'Técnico' },
  { id: 'tech-2', name: 'Andrea Rojas', role: 'Técnico' },
  { id: 'tech-3', name: 'Franklin', role: 'Técnico' },
]
