import { createContext } from 'react'
import type { BankAccount, BankMovement } from '../data/mockBanks'
import type { Appointment, CashRegister, ClosedCashSession, Client, InventoryItem, Order, Supplier, WorkshopAsset, WorkshopCategory, WorkshopSettings } from '../types'

export type AdminUser = {
  id: string
  name: string
  email: string
  role: 'ADMIN'
}

export type DemoDataContextValue = {
  appointments: Appointment[]
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>
  clients: Client[]
  setClients: React.Dispatch<React.SetStateAction<Client[]>>
  inventory: InventoryItem[]
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>
  workshopAssets: WorkshopAsset[]
  setWorkshopAssets: React.Dispatch<React.SetStateAction<WorkshopAsset[]>>
  workshopCategories: WorkshopCategory[]
  setWorkshopCategories: React.Dispatch<React.SetStateAction<WorkshopCategory[]>>
  bankAccounts: BankAccount[]
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>
  bankMovements: Record<string, BankMovement[]>
  setBankMovements: React.Dispatch<React.SetStateAction<Record<string, BankMovement[]>>>
  orders: Order[]
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>
  suppliers: Supplier[]
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>
  cashRegister: CashRegister
  setCashRegister: React.Dispatch<React.SetStateAction<CashRegister>>
  closedSessions: ClosedCashSession[]
  setClosedSessions: React.Dispatch<React.SetStateAction<ClosedCashSession[]>>
  settings: WorkshopSettings
  setSettings: React.Dispatch<React.SetStateAction<WorkshopSettings>>
  activeProfile: string
  setActiveProfile: React.Dispatch<React.SetStateAction<string>>
  authUser: AdminUser
  logout: () => Promise<void>
  isSaving: boolean
  storageError: string | null
  resetDemoData: () => void
}

export const DemoDataContext = createContext<DemoDataContextValue | null>(null)
