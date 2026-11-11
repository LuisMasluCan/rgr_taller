import {
  CarFront,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import NumericInput from '../components/NumericInput'
import { useDemoData } from '../contexts/useDemoData'
import type { Client, Vehicle } from '../types'

type ClientDraft = Pick<Client, 'id' | 'name' | 'email' | 'phone'>
type VehicleDraft = Omit<Vehicle, 'id'>

const emptyClient: ClientDraft = { id: '', name: '', email: '', phone: '' }
const currentYear = new Date().getFullYear()
const emptyVehicle: VehicleDraft = { make: '', model: '', year: currentYear, plate: '', vin: '', color: '' }

function ClientsView() {
  const { clients, setClients } = useDemoData()
  const [search, setSearch] = useState('')
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [clientDraft, setClientDraft] = useState<ClientDraft>(emptyClient)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [vehiclesClientId, setVehiclesClientId] = useState<string | null>(null)
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(emptyVehicle)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)

  const visibleClients = useMemo(
    () =>
      clients.filter((client) =>
        `${client.id} ${client.name} ${client.email} ${client.phone}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [clients, search],
  )

  const selectedClient = clients.find((client) => client.id === vehiclesClientId) ?? null

  const openNewClient = () => {
    setEditingClientId(null)
    setClientDraft(emptyClient)
    setClientModalOpen(true)
  }

  const openEditClient = (client: Client) => {
    setEditingClientId(client.id)
    setClientDraft({ id: client.id, name: client.name, email: client.email, phone: client.phone })
    setClientModalOpen(true)
  }

  const saveClient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = editingClientId ?? clientDraft.id.trim()
    const duplicate = clients.some((client) => client.id === id && client.id !== editingClientId)
    if (duplicate) {
      const idInput = event.currentTarget.elements.namedItem('client-id')
      if (idInput instanceof HTMLInputElement) {
        idInput.setCustomValidity('Ya existe un cliente con este documento.')
        idInput.reportValidity()
      }
      return
    }

    const existing = clients.find((client) => client.id === editingClientId)
    const nextClient: Client = {
      ...clientDraft,
      id,
      vehicles: existing?.vehicles ?? [],
    }

    setClients((current) =>
      editingClientId
        ? current.map((client) => (client.id === editingClientId ? nextClient : client))
        : [nextClient, ...current],
    )
    setClientModalOpen(false)
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    if (submitter instanceof HTMLButtonElement && submitter.value === 'manage-vehicles') {
      setVehiclesClientId(id)
    }
  }

  const saveVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedClient) return
    const plate = vehicleDraft.plate.trim().toUpperCase()
    const vin = vehicleDraft.vin.trim().toUpperCase()
    const duplicatePlate = clients.some((client) =>
      client.vehicles.some((vehicle) => vehicle.plate === plate && vehicle.id !== editingVehicleId),
    )
    if (duplicatePlate) {
      const plateInput = event.currentTarget.elements.namedItem('vehicle-plate')
      if (plateInput instanceof HTMLInputElement) {
        plateInput.setCustomValidity('Ya existe un vehículo registrado con esta placa.')
        plateInput.reportValidity()
      }
      return
    }
    const duplicateVin = clients.some((client) =>
      client.vehicles.some((vehicle) => vehicle.vin && vehicle.vin === vin && vehicle.id !== editingVehicleId),
    )
    if (duplicateVin) {
      const vinInput = event.currentTarget.elements.namedItem('vehicle-vin')
      if (vinInput instanceof HTMLInputElement) {
        vinInput.setCustomValidity('Ya existe un vehículo registrado con este VIN.')
        vinInput.reportValidity()
      }
      return
    }

    const nextVehicle: Vehicle = {
      ...vehicleDraft,
      id: editingVehicleId ?? `vehicle-${Date.now()}`,
      year: Number(vehicleDraft.year) || new Date().getFullYear(),
      plate,
      vin,
    }
    setClients((current) =>
      current.map((client) =>
        client.id === selectedClient.id
          ? {
              ...client,
              vehicles: editingVehicleId
                ? client.vehicles.map((vehicle) => (vehicle.id === editingVehicleId ? nextVehicle : vehicle))
                : [...client.vehicles, nextVehicle],
            }
          : client,
      ),
    )
    setVehicleModalOpen(false)
  }

  const editVehicle = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id)
    setVehicleDraft({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      plate: vehicle.plate,
      vin: vehicle.vin,
      color: vehicle.color,
    })
    setVehicleModalOpen(true)
  }

  const openNewVehicle = () => {
    setEditingVehicleId(null)
    setVehicleDraft(emptyVehicle)
    setVehicleModalOpen(true)
  }

  const deleteVehicle = (vehicleId: string) => {
    if (!selectedClient) return
    setClients((current) =>
      current.map((client) =>
        client.id === selectedClient.id
          ? { ...client, vehicles: client.vehicles.filter((vehicle) => vehicle.id !== vehicleId) }
          : client,
      ),
    )
  }

  const deleteClient = (clientId: string) => {
    setClients((current) => current.filter((client) => client.id !== clientId))
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-900/40 text-lime-300"><UsersRound size={14} /></span>
            <span><strong className="font-semibold text-slate-300">{clients.length} clientes</strong> registrados</span>
          </div>
        </div>
        <button onClick={openNewClient} className="flex h-10 w-fit items-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400">
          <Plus size={16} /> CREAR CLIENTE
        </button>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-100">Directorio de clientes</h2><p className="mt-0.5 text-[11px] text-slate-400">Consulta datos de contacto y vehículos asociados.</p></div>
          <label className="relative w-full sm:max-w-[280px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Buscar cliente, documento..." className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-900 text-[9px] font-bold uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-3.5">Nombre</th><th className="px-4 py-3.5">ID / Documento</th><th className="px-4 py-3.5">Email</th><th className="px-4 py-3.5">Celular</th><th className="px-4 py-3.5">Vehículos</th><th className="px-4 py-3.5 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleClients.map((client) => (
                <tr key={client.id} className="text-xs text-slate-400 hover:bg-slate-900/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">{client.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
                      <span className="font-semibold text-slate-200">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-slate-400">{client.id}</td>
                  <td className="px-4 py-4"><span className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{client.email}</span></td>
                  <td className="px-4 py-4"><span className="flex items-center gap-2"><Phone size={13} className="text-slate-400" />{client.phone}</span></td>
                  <td className="px-4 py-4">
                    <button onClick={() => setVehiclesClientId(client.id)} className="flex items-center gap-1.5 rounded-full border border-lime-400/50 bg-transparent px-2.5 py-1 text-[10px] font-semibold text-lime-300 hover:bg-lime-400/10">
                      <CarFront size={13} /> {client.vehicles.length} {client.vehicles.length === 1 ? 'vehículo' : 'vehículos'}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <button title="Administrar vehículos" aria-label={`Administrar vehículos de ${client.name}`} onClick={() => setVehiclesClientId(client.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-lime-950/30 hover:text-lime-300"><CarFront size={15} /></button>
                      <button title="Editar cliente" aria-label={`Editar ${client.name}`} onClick={() => openEditClient(client)} className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-300 hover:bg-violet-950/30"><Pencil size={14} /></button>
                      <button title="Eliminar cliente" aria-label={`Eliminar ${client.name}`} onClick={() => deleteClient(client.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-950/30"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleClients.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">No hay clientes que coincidan con la búsqueda.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-400">Mostrando {visibleClients.length} de {clients.length} clientes</div>
      </section>

      {clientModalOpen && (
        <Modal title={editingClientId ? 'Editar cliente' : 'Crear cliente'} onClose={() => setClientModalOpen(false)}>
          <form onSubmit={saveClient} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre completo" required><input required autoFocus value={clientDraft.name} onChange={(event) => setClientDraft({ ...clientDraft, name: event.target.value })} placeholder="Ej. María Fernanda Salazar" className={inputClass} /></Field>
              <Field label="DNI / RUC" required><input required name="client-id" disabled={Boolean(editingClientId)} value={clientDraft.id} onChange={(event) => { event.target.setCustomValidity(''); setClientDraft({ ...clientDraft, id: event.target.value }) }} placeholder="Documento de identidad" className={`${inputClass} disabled:bg-slate-800`} /></Field>
              <Field label="Correo electrónico" required><input required type="email" value={clientDraft.email} onChange={(event) => setClientDraft({ ...clientDraft, email: event.target.value })} placeholder="cliente@correo.com" className={inputClass} /></Field>
              <Field label="Celular" required><input required type="tel" value={clientDraft.phone} onChange={(event) => setClientDraft({ ...clientDraft, phone: event.target.value })} placeholder="+51 999 999 999" className={inputClass} /></Field>
            </div>
            <div className="flex flex-col-reverse justify-between gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:items-center">
              <button type="submit" value="manage-vehicles" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800">
                <CarFront size={15} /> Guardar y gestionar vehículos
              </button>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setClientModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancelar</button>
                <button type="submit" className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400">Guardar cliente</button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {vehiclesClientId && selectedClient && (
        <Modal title={`Vehículos de ${selectedClient.name}`} onClose={() => { setVehiclesClientId(null); setVehicleModalOpen(false) }} wide>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-xs text-slate-400">Documento: <strong className="text-slate-300">{selectedClient.id}</strong></p><p className="mt-1 text-[11px] text-slate-400">{selectedClient.vehicles.length} {selectedClient.vehicles.length === 1 ? 'vehículo asociado' : 'vehículos asociados'}</p></div>
            <button onClick={openNewVehicle} className="flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-lime-400"><Plus size={14} /> NUEVO VEHÍCULO</button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-[570px] text-left">
              <thead className="bg-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-3">Vehículo</th><th className="px-3 py-3">Placa</th><th className="px-3 py-3">Año / color</th><th className="px-3 py-3">Número de VIN</th><th className="px-3 py-3 text-right">Opciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {selectedClient.vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="text-xs text-slate-400">
                    <td className="px-3 py-3"><span className="flex items-center gap-2 font-semibold text-slate-200"><CarFront size={15} className="text-slate-400" />{vehicle.make} {vehicle.model}</span></td>
                    <td className="px-3 py-3"><span className="rounded-md border border-slate-700 bg-transparent px-2 py-1 font-mono text-[10px] font-bold text-slate-300">{vehicle.plate}</span></td>
                    <td className="px-3 py-3">{vehicle.year} · {vehicle.color}</td>
                    <td className="px-3 py-3 font-mono text-[10px]">{vehicle.vin || 'Sin VIN'}</td>
                    <td className="px-3 py-3"><div className="flex justify-end gap-1"><button aria-label={`Editar ${vehicle.make} ${vehicle.model}`} onClick={() => editVehicle(vehicle)} className="flex h-7 w-7 items-center justify-center rounded-md text-violet-300 hover:bg-violet-950/30"><Pencil size={13} /></button><button aria-label={`Eliminar ${vehicle.plate}`} onClick={() => deleteVehicle(vehicle.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-950/30"><Trash2 size={13} /></button></div></td>
                  </tr>
                ))}
                {!selectedClient.vehicles.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Este cliente todavía no tiene vehículos.</td></tr>}
              </tbody>
            </table>
          </div>
          {vehicleModalOpen && (
            <form onSubmit={saveVehicle} className="mt-5 rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-bold text-slate-200">{editingVehicleId ? 'Editar vehículo' : 'Nuevo vehículo'}</h3></div><button type="button" aria-label="Cerrar formulario de vehículo" onClick={() => setVehicleModalOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-300"><X size={15} /></button></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Marca" required><input required value={vehicleDraft.make} onChange={(event) => setVehicleDraft({ ...vehicleDraft, make: event.target.value })} placeholder="Toyota" className={inputClass} /></Field>
                <Field label="Modelo" required><input required value={vehicleDraft.model} onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })} placeholder="Yaris" className={inputClass} /></Field>
                <Field label="Placa" required><input required name="vehicle-plate" value={vehicleDraft.plate} onChange={(event) => { event.target.setCustomValidity(''); setVehicleDraft({ ...vehicleDraft, plate: event.target.value }) }} placeholder="ABC-123" className={inputClass} /></Field>
                <Field label="Año" required><NumericInput required min="1950" max={currentYear + 1} value={vehicleDraft.year} onChange={(value) => setVehicleDraft({ ...vehicleDraft, year: Number(value) || 0 })} className={inputClass} /></Field>
                <Field label="Color" required><input required value={vehicleDraft.color} onChange={(event) => setVehicleDraft({ ...vehicleDraft, color: event.target.value })} placeholder="Plata" className={inputClass} /></Field>
                <Field label="Número de VIN" required><input required name="vehicle-vin" minLength={17} maxLength={17} pattern="[A-HJ-NPR-Z0-9]{17}" title="Ingresa los 17 caracteres del VIN (sin I, O ni Q)." value={vehicleDraft.vin} onChange={(event) => { event.target.setCustomValidity(''); setVehicleDraft({ ...vehicleDraft, vin: event.target.value.toUpperCase() }) }} placeholder="17 caracteres" className={inputClass} /></Field>
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700">{editingVehicleId ? 'Guardar cambios' : 'Guardar vehículo'}</button></div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-300 outline-none placeholder:text-slate-400 focus:border-slate-700'

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>{children}</label>
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`my-auto w-full rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
      <div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-slate-100">{title}</h2><button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-300"><X size={18} /></button></div>
      {children}
      </div>
    </div>
  )
}

export default ClientsView
