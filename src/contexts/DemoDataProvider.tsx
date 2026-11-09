import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BankAccount, BankMovement } from '../data/mockBanks'
import type { Appointment, CashRegister, ClosedCashSession, Client, InventoryItem, Order, Supplier, WorkshopAsset, WorkshopCategory, WorkshopSettings } from '../types'
import AdminLoginView from '../views/AdminLoginView'
import { DemoDataContext } from './DemoDataContext'
import type { AdminUser } from './DemoDataContext'

type WorkshopData = {
  appointments: Appointment[]
  clients: Client[]
  inventory: InventoryItem[]
  workshopAssets: WorkshopAsset[]
  workshopCategories: WorkshopCategory[]
  bankAccounts: BankAccount[]
  bankMovements: Record<string, BankMovement[]>
  orders: Order[]
  suppliers: Supplier[]
  cashRegister: CashRegister
  closedSessions: ClosedCashSession[]
  settings: WorkshopSettings
  activeProfile: string
}

const initialSettings: WorkshopSettings = {
  name: 'RGR Taller',
  phone: '',
  email: '',
  address: '',
  lowStockThreshold: 5,
  notificationsEnabled: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWorkshopData(value: unknown): WorkshopData {
  if (!isRecord(value)) throw new Error('La API devolvió un estado de taller inválido.')
  const arrayFields = [
    'appointments',
    'clients',
    'inventory',
    'workshopAssets',
    'workshopCategories',
    'bankAccounts',
    'orders',
    'suppliers',
    'closedSessions',
  ] as const
  if (arrayFields.some((field) => !Array.isArray(value[field]))) {
    throw new Error('Faltan colecciones requeridas en los datos recibidos de Neon.')
  }
  if (!isRecord(value.settings) || !isRecord(value.bankMovements)) {
    throw new Error('La configuración o los movimientos bancarios recibidos son inválidos.')
  }
  return value as unknown as WorkshopData
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getArrayItemKey(items: unknown[][]): 'id' | 'name' | null {
  for (const key of ['id', 'name'] as const) {
    if (items.every((list) => {
      const keys = list.map((item) => isRecord(item) && typeof item[key] === 'string' ? item[key] : null)
      return keys.every((itemKey): itemKey is string => itemKey !== null) &&
        new Set(keys).size === keys.length
    })) {
      return key
    }
  }
  return null
}

function mergeConcurrentValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (sameJsonValue(local, base)) return remote
  if (sameJsonValue(remote, base) || sameJsonValue(local, remote)) return local

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const key = getArrayItemKey([base, local, remote])
    if (!key) return local

    const baseItems = new Map(base.map((item) => [(item as Record<string, unknown>)[key] as string, item]))
    const localItems = new Map(local.map((item) => [(item as Record<string, unknown>)[key] as string, item]))
    const remoteItems = new Map(remote.map((item) => [(item as Record<string, unknown>)[key] as string, item]))
    const keys = new Set([...remoteItems.keys(), ...localItems.keys()])
    const merged: unknown[] = []

    for (const itemKey of keys) {
      const baseItem = baseItems.get(itemKey)
      const localItem = localItems.get(itemKey)
      const remoteItem = remoteItems.get(itemKey)
      if (localItem === undefined) {
        if (baseItem === undefined && remoteItem !== undefined) merged.push(remoteItem)
      } else if (remoteItem === undefined) {
        if (baseItem === undefined || !sameJsonValue(localItem, baseItem)) merged.push(localItem)
      } else {
        merged.push(mergeConcurrentValue(baseItem, localItem, remoteItem))
      }
    }
    return merged
  }

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const merged: Record<string, unknown> = {}
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
    for (const key of keys) {
      const hasBase = Object.hasOwn(base, key)
      const hasLocal = Object.hasOwn(local, key)
      const hasRemote = Object.hasOwn(remote, key)
      if (!hasLocal) {
        if (!hasBase && hasRemote) merged[key] = remote[key]
      } else if (!hasRemote) {
        if (!hasBase || !sameJsonValue(local[key], base[key])) merged[key] = local[key]
      } else {
        merged[key] = mergeConcurrentValue(base[key], local[key], remote[key])
      }
    }
    return merged
  }

  return local
}

async function responseError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.error === 'string') return body.error
  } catch {
    return `La API respondió con el estado ${response.status}.`
  }
  return `La API respondió con el estado ${response.status}.`
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [dataLoaded, setDataLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [loginRequired, setLoginRequired] = useState(false)
  const [authUser, setAuthUser] = useState<AdminUser | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const version = useRef(0)
  const lastSavedSnapshot = useRef('')
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [workshopAssets, setWorkshopAssets] = useState<WorkshopAsset[]>([])
  const [workshopCategories, setWorkshopCategories] = useState<WorkshopCategory[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankMovements, setBankMovements] = useState<Record<string, BankMovement[]>>({})
  const [orders, setOrders] = useState<Order[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [cashRegister, setCashRegister] = useState<CashRegister>(null)
  const [closedSessions, setClosedSessions] = useState<ClosedCashSession[]>([])
  const [settings, setSettings] = useState<WorkshopSettings>(initialSettings)
  const [activeProfile, setActiveProfile] = useState('Sin sesión')

  function applyWorkshopData(data: WorkshopData) {
    setAppointments(data.appointments)
    setClients(data.clients)
    setInventory(data.inventory)
    setWorkshopAssets(data.workshopAssets)
    setWorkshopCategories(data.workshopCategories)
    setBankAccounts(data.bankAccounts)
    setBankMovements(data.bankMovements as Record<string, BankMovement[]>)
    setOrders(data.orders)
    setSuppliers(data.suppliers)
    setCashRegister(data.cashRegister)
    setClosedSessions(data.closedSessions)
    setSettings(data.settings as WorkshopSettings)
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', { signal: controller.signal })
        if (authResponse.status === 401) {
          setDataLoaded(false)
          setAuthUser(null)
          setLoginRequired(true)
          setLoadError(null)
          return
        }
        if (!authResponse.ok) throw new Error(await responseError(authResponse))
        const authBody: unknown = await authResponse.json()
        if (!isRecord(authBody) || !isRecord(authBody.user) ||
          typeof authBody.user.id !== 'string' ||
          typeof authBody.user.name !== 'string' ||
          typeof authBody.user.email !== 'string' ||
          authBody.user.role !== 'ADMIN') {
          throw new Error('La API devolvió una sesión de administrador inválida.')
        }
        const currentUser = authBody.user as AdminUser
        setAuthUser(currentUser)
        setLoginRequired(false)

        const response = await fetch('/api/state', { signal: controller.signal })
        if (response.status === 401) {
          setDataLoaded(false)
          setAuthUser(null)
          setLoginRequired(true)
          return
        }
        if (!response.ok) throw new Error(await responseError(response))
        const body: unknown = await response.json()
        if (!isRecord(body) || !Number.isInteger(body.version) || !('data' in body)) {
          throw new Error('La API devolvió una respuesta de inicialización inválida.')
        }
        const stored = parseWorkshopData(body.data)
        version.current = body.version as number
        lastSavedSnapshot.current = JSON.stringify(stored)
        applyWorkshopData(stored)
        setActiveProfile(currentUser.name)
        setLoadError(null)
        setDataLoaded(true)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('No se pudieron cargar los datos de Neon:', error)
        setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los datos de Neon.')
      }
    }
    void load()
    return () => controller.abort()
  }, [retryCount])

  const snapshot: WorkshopData = {
    appointments,
    clients,
    inventory,
    workshopAssets,
    workshopCategories,
    bankAccounts,
    bankMovements,
    orders,
    suppliers,
    cashRegister,
    closedSessions,
    settings,
    activeProfile,
  }
  const serializedSnapshot = JSON.stringify(snapshot)
  const serializedSnapshotRef = useRef(serializedSnapshot)

  useEffect(() => {
    serializedSnapshotRef.current = serializedSnapshot
  }, [serializedSnapshot])

  useEffect(() => {
    if (!dataLoaded) return
    if (serializedSnapshot === lastSavedSnapshot.current) {
      setIsSaving(false)
      return
    }

    setIsSaving(true)

    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .then(async () => {
          if (serializedSnapshotRef.current === lastSavedSnapshot.current) return

          let pendingSnapshot = serializedSnapshotRef.current
          let observedLocalSnapshot = pendingSnapshot
          let baseSnapshot = lastSavedSnapshot.current

          for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await fetch('/api/state', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: `{"data":${pendingSnapshot},"version":${version.current}}`,
            })

            if (response.status === 409) {
              const latestResponse = await fetch('/api/state')
              if (!latestResponse.ok) throw new Error(await responseError(latestResponse))
              const latestBody: unknown = await latestResponse.json()
              if (!isRecord(latestBody) || !Number.isInteger(latestBody.version) || !('data' in latestBody)) {
                throw new Error('La API devolvió una versión inválida al sincronizar los cambios.')
              }

              const latestData = parseWorkshopData(latestBody.data)
              const latestSnapshot = JSON.stringify(latestData)
              const currentLocalSnapshot = serializedSnapshotRef.current
              const localWithNewerEdits = mergeConcurrentValue(
                JSON.parse(observedLocalSnapshot) as unknown,
                JSON.parse(currentLocalSnapshot) as unknown,
                JSON.parse(pendingSnapshot) as unknown,
              )
              const merged = parseWorkshopData(mergeConcurrentValue(
                JSON.parse(baseSnapshot) as unknown,
                localWithNewerEdits,
                latestData,
              ))

              observedLocalSnapshot = currentLocalSnapshot
              pendingSnapshot = JSON.stringify(merged)
              baseSnapshot = latestSnapshot
              version.current = latestBody.version as number
              lastSavedSnapshot.current = latestSnapshot
              applyWorkshopData(merged)
              continue
            }

            if (!response.ok) throw new Error(await responseError(response))
            const result: unknown = await response.json()
            if (!isRecord(result) || !Number.isInteger(result.version)) {
              throw new Error('La API guardó los datos, pero devolvió una versión inválida.')
            }
            version.current = result.version as number
            lastSavedSnapshot.current = pendingSnapshot
            setStorageError(null)
            setIsSaving(serializedSnapshotRef.current !== lastSavedSnapshot.current)
            return
          }
          throw new Error('Siguen llegando cambios desde otros dispositivos. Tus cambios siguen en esta pestaña; no la recargues e intenta guardar de nuevo.')
        })
        .catch((error: unknown) => {
          console.error('No se pudieron guardar los cambios en Neon:', error)
          setStorageError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios en Neon.')
          setIsSaving(serializedSnapshotRef.current !== lastSavedSnapshot.current)
        })
    }, 350)

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (serializedSnapshot === lastSavedSnapshot.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [dataLoaded, serializedSnapshot])

  const resetDemoData = () => {
    setAppointments([])
    setClients([])
    setInventory([])
    setWorkshopAssets([])
    setOrders([])
    setSuppliers([])
    setBankMovements({})
    setCashRegister(null)
    setClosedSessions([])
    setSettings(initialSettings)
    setActiveProfile(authUser?.name ?? 'Sin sesión')
  }

  const handleLogin = () => {
    setLoginRequired(false)
    setLoadError(null)
    setRetryCount((count) => count + 1)
  }

  const logout = async () => {
    if (isSaving || serializedSnapshot !== lastSavedSnapshot.current) {
      throw new Error('Espera a que los cambios terminen de guardarse antes de cerrar sesión.')
    }
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok) throw new Error(await responseError(response))
    setDataLoaded(false)
    setAuthUser(null)
    setLoginRequired(true)
    setStorageError(null)
  }

  if (loginRequired) return <AdminLoginView onAuthenticated={handleLogin} />

  if (!dataLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1120] p-6 text-white">
        <section className="max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold">{loadError ? 'No se pudo conectar con Neon' : 'Conectando con Neon…'}</h1>
          <p className="mt-2 text-sm text-slate-300">{loadError ?? 'Cargando los datos reales del taller.'}</p>
          {loadError && <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-4 rounded-lg bg-lime-300 px-4 py-2 text-sm font-bold text-slate-950">Reintentar conexión</button>}
        </section>
      </main>
    )
  }
  if (!authUser) return <AdminLoginView onAuthenticated={handleLogin} />

  return (
    <DemoDataContext.Provider
      value={{
        appointments, setAppointments,
        clients, setClients,
        inventory, setInventory,
        workshopAssets, setWorkshopAssets,
        workshopCategories, setWorkshopCategories,
        bankAccounts, setBankAccounts,
        bankMovements, setBankMovements,
        orders, setOrders,
        suppliers, setSuppliers,
        cashRegister, setCashRegister,
        closedSessions, setClosedSessions,
        settings, setSettings,
        activeProfile, setActiveProfile,
        authUser,
        logout,
        isSaving,
        storageError,
        resetDemoData,
      }}
    >
      {children}
    </DemoDataContext.Provider>
  )
}
