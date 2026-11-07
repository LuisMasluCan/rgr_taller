import { CalendarDays, CarFront, Clock3, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import { useDemoData } from '../contexts/useDemoData'
import type { Appointment, Order } from '../types'

type AppointmentDraft = Pick<Appointment, 'customerId' | 'vehicleId' | 'reason' | 'date' | 'time'>

const blankDraft = (): AppointmentDraft => ({
  customerId: '',
  vehicleId: '',
  reason: '',
  date: '',
  time: '',
})

const localDateISO = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function formatAppointmentDate(date: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function AppointmentsView() {
  const { appointments, setAppointments, clients, orders, setOrders } = useDemoData()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AppointmentDraft>(blankDraft())
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null)
  const orderSequence = useRef(0)
  const appointmentIdPrefix = useId()
  const appointmentSequence = useRef(0)
  const startedAppointments = useRef(new Set<string>())

  const selectedClient = clients.find((client) => client.id === draft.customerId)
  const availableVehicles = selectedClient?.vehicles ?? []

  const openNewAppointment = () => {
    setEditingAppointmentId(null)
    setDraft({ ...blankDraft(), date: localDateISO() })
    setError('')
    setModalOpen(true)
  }

  const openEditAppointment = (appointment: Appointment) => {
    setEditingAppointmentId(appointment.id)
    setDraft({
      customerId: appointment.customerId,
      vehicleId: appointment.vehicleId,
      reason: appointment.reason,
      date: appointment.date,
      time: appointment.time,
    })
    setError('')
    setModalOpen(true)
  }

  const saveAppointment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedClient?.vehicles.some((vehicle) => vehicle.id === draft.vehicleId)) {
      setError('Selecciona un vehículo válido para el cliente.')
      return
    }

    let appointmentId = editingAppointmentId ?? `appointment-${appointmentIdPrefix}-${appointmentSequence.current++}`
    while (!editingAppointmentId && appointments.some((entry) => entry.id === appointmentId)) {
      appointmentId = `appointment-${appointmentIdPrefix}-${appointmentSequence.current++}`
    }

    const appointment: Appointment = {
      ...draft,
      id: appointmentId,
      status: appointments.find((entry) => entry.id === editingAppointmentId)?.status ?? 'Programada',
    }

    setAppointments((current) => editingAppointmentId
      ? current.map((entry) => entry.id === editingAppointmentId ? appointment : entry)
      : [...current, appointment])
    setModalOpen(false)
    setError('')
  }

  const deleteAppointment = (appointment: Appointment) => {
    setConfirmation({
      title: 'Eliminar cita',
      message: `¿Deseas eliminar la cita del ${formatAppointmentDate(appointment.date)} a las ${appointment.time}? Esta acción no se puede deshacer.`,
      confirmLabel: 'ELIMINAR CITA',
      onConfirm: () => setAppointments((current) => current.filter((entry) => entry.id !== appointment.id)),
    })
  }

  const cancelAppointment = (appointment: Appointment) => {
    setConfirmation({
      title: 'Cancelar cita',
      message: `¿Deseas cancelar la cita del ${formatAppointmentDate(appointment.date)} a las ${appointment.time}?`,
      confirmLabel: 'CANCELAR CITA',
      onConfirm: () => setAppointments((current) => current.map((entry) => entry.id === appointment.id
        ? { ...entry, status: 'Cancelada' }
        : entry)),
    })
  }

  const simulateArrival = (appointment: Appointment) => {
    if (
      appointment.status !== 'Programada' ||
      startedAppointments.current.has(appointment.id) ||
      orders.some((order) => order.sourceAppointmentId === appointment.id)
    ) return
    const client = clients.find((entry) => entry.id === appointment.customerId)
    const vehicle = client?.vehicles.find((entry) => entry.id === appointment.vehicleId)
    if (!client || !vehicle) {
      setError('No se pudo iniciar la orden: verifica que el cliente y el vehículo de la cita sigan registrados.')
      return
    }

    startedAppointments.current.add(appointment.id)
    const arrivedAt = new Date()
    const dateISO = localDateISO()
    let nextSequence = orderSequence.current++
    let orderId = `${dateISO.replaceAll('-', '')}${String(nextSequence).padStart(4, '0')}`
    while (orders.some((order) => order.id === orderId)) {
      nextSequence = orderSequence.current++
      orderId = `${dateISO.replaceAll('-', '')}${String(nextSequence).padStart(4, '0')}`
    }

    const newOrder: Order = {
      id: orderId,
      sourceAppointmentId: appointment.id,
      status: 'Recepción',
      timestamps: { fechaIngreso: arrivedAt.toISOString() },
      invoiced: false,
      date: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(arrivedAt),
      dateISO,
      quoteItems: [],
      quoteDiscountPercent: 0,
      payments: [],
      customer: client.name,
      email: client.email,
      phone: client.phone,
      mileage: 0,
      arrivalPhotos: [],
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate,
        vin: vehicle.vin,
      },
      reason: appointment.reason,
      technician: '',
      comments: `Ingreso iniciado desde la cita ${appointment.date} a las ${appointment.time}.`,
    }

    setOrders((current) => current.some((order) => order.sourceAppointmentId === appointment.id)
      ? current
      : [newOrder, ...current])
    setAppointments((current) => current.map((entry) => entry.id === appointment.id
      ? { ...entry, status: 'Completada' }
      : entry))
    setError('')
    navigate(`/orders?stage=${encodeURIComponent('Recepción')}`)
  }

  return (
    <div className="space-y-6">
      <section className="flex justify-end">
        <button
          type="button"
          onClick={openNewAppointment}
          className="flex w-fit items-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400"
        >
          <Plus size={16} /> NUEVA CITA
        </button>
      </section>

      {error && !modalOpen && (
        <p role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-xs font-medium text-red-200">{error}</p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-100">Citas del taller</h2>
          <p className="mt-1 text-[11px] text-slate-400">Al registrar la llegada, se crea automáticamente una orden en la etapa Recepción.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-slate-800 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Hora</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Vehículo (Marca / Placa)</th>
                <th className="px-5 py-3">Motivo de la cita</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.length ? appointments
                .slice()
                .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))
                .map((appointment) => {
                  const client = clients.find((entry) => entry.id === appointment.customerId)
                  const vehicle = client?.vehicles.find((entry) => entry.id === appointment.vehicleId)
                  const statusStyle = appointment.status === 'Programada'
                    ? 'bg-sky-950/30 text-sky-300 ring-sky-400/30'
                    : appointment.status === 'Completada'
                      ? 'bg-emerald-950/30 text-emerald-300 ring-emerald-400/30'
                      : 'bg-slate-800 text-slate-400 ring-slate-600'
                  return (
                    <tr key={appointment.id} className="align-top text-xs text-slate-400">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-200">{formatAppointmentDate(appointment.date)}</td>
                      <td className="whitespace-nowrap px-5 py-4"><span className="inline-flex items-center gap-1.5"><Clock3 size={13} className="text-slate-400" />{appointment.time}</span></td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-semibold text-slate-200"><UserRound size={14} className="shrink-0 text-slate-400" />{client?.name ?? 'Cliente no disponible'}</span></td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2"><CarFront size={14} className="shrink-0 text-slate-400" />{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` : 'Vehículo no disponible'}</span></td>
                      <td className="max-w-[220px] whitespace-normal px-5 py-4">{appointment.reason}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyle}`}>{appointment.status}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex min-w-[190px] flex-wrap items-center gap-2">
                          <button type="button" title="Editar cita" onClick={() => openEditAppointment(appointment)} aria-label={`Editar cita de ${client?.name ?? 'cliente'}`} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"><Pencil size={14} /></button>
                          <button type="button" title="Eliminar cita" onClick={() => deleteAppointment(appointment)} aria-label={`Eliminar cita de ${client?.name ?? 'cliente'}`} className="rounded-md border border-slate-700 p-1.5 text-red-300 hover:bg-red-950/30"><Trash2 size={14} /></button>
                          {appointment.status === 'Programada' && (
                            <button type="button" title="Cancelar cita" onClick={() => cancelAppointment(appointment)} className="rounded-md border border-slate-700 px-2 py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800">Cancelar</button>
                          )}
                          {appointment.status === 'Programada' && (
                            <button
                              type="button"
                              title="Registrar la llegada del vehículo e iniciar una orden de servicio"
                              onClick={() => simulateArrival(appointment)}
                              className="rounded-md bg-slate-900 px-2.5 py-2 text-[10px] font-bold text-white transition hover:bg-slate-700"
                            >
                              REGISTRAR LLEGADA
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-slate-400">Aún no hay citas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title">
          <form onSubmit={saveAppointment} className="my-auto w-full max-w-xl rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="appointment-modal-title" className="text-base font-bold text-slate-100">{editingAppointmentId ? 'Editar cita' : 'Nueva cita'}</h2>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Cliente</span>
                <select required value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value, vehicleId: '' })} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs outline-none focus:border-slate-700">
                  <option value="">Selecciona un cliente</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.id}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Vehículo</span>
                <select required disabled={!draft.customerId || !availableVehicles.length} value={draft.vehicleId} onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs outline-none focus:border-slate-700 disabled:bg-slate-800">
                  <option value="">{availableVehicles.length ? 'Selecciona un vehículo' : 'El cliente no tiene vehículos registrados'}</option>
                  {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plate}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Fecha</span>
                <span className="relative block"><CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" /></span>
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Hora</span>
                <span className="relative block"><Clock3 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" /></span>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Motivo de la cita</span>
                <textarea required rows={3} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Describe el servicio o problema reportado" className="w-full resize-y rounded-lg border border-slate-700 px-3 py-2.5 text-xs outline-none placeholder:text-slate-400 focus:border-slate-700" />
              </label>
            </div>
            {error && <p role="alert" className="mt-3 text-xs font-medium text-red-300">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancelar</button>
              <button type="submit" className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400">Guardar Cita</button>
            </div>
          </form>
        </div>
      )}
      <ActionConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

export default AppointmentsView
