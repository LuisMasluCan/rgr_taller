import { Check, RotateCcw, Save, Settings2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import NumericInput from '../components/NumericInput'
import { useDemoData } from '../contexts/useDemoData'

function SettingsView() {
  const { settings, setSettings, resetDemoData } = useDemoData()
  const [resetDone, setResetDone] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null)

  const saveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaved(true)
  }

  const reset = () => {
    setConfirmation({
      title: 'Vaciar datos del navegador',
      message: 'Se eliminarán clientes, vehículos, órdenes, citas, inventario, movimientos, proveedores y equipos guardados en Neon. Las cuentas bancarias y categorías maestras se conservarán. La configuración del taller volverá a sus valores iniciales. Esta acción no se puede deshacer.',
      confirmLabel: 'VACIAR DATOS',
      onConfirm: () => {
        resetDemoData()
        setResetDone(true)
      },
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section>
        <p className="mt-2 text-[11px] text-slate-400">Los cambios se guardan automáticamente en la base de datos de Neon.</p>
      </section>

      <form onSubmit={saveSettings} className="rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400"><Settings2 size={17} /></div>
          <div><h2 className="text-sm font-bold text-slate-100">Datos del taller</h2><p className="mt-0.5 text-[11px] text-slate-400">Información de contacto y umbrales de inventario.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial"><input required value={settings.name} onChange={(event) => { setSettings({ ...settings, name: event.target.value }); setSaved(false) }} className={inputClass} /></Field>
          <Field label="Teléfono"><input type="tel" value={settings.phone} onChange={(event) => { setSettings({ ...settings, phone: event.target.value }); setSaved(false) }} className={inputClass} /></Field>
          <Field label="Correo de contacto"><input type="email" value={settings.email} onChange={(event) => { setSettings({ ...settings, email: event.target.value }); setSaved(false) }} className={inputClass} /></Field>
          <Field label="Dirección"><input value={settings.address} onChange={(event) => { setSettings({ ...settings, address: event.target.value }); setSaved(false) }} className={inputClass} /></Field>
          <Field label="Umbral de stock bajo"><NumericInput min="0" value={settings.lowStockThreshold} onChange={(value) => { setSettings({ ...settings, lowStockThreshold: Number(value) || 0 }); setSaved(false) }} className={inputClass} /></Field>
          <label className="flex items-center gap-3 self-end rounded-lg border border-slate-700 px-3 py-2.5">
            <input type="checkbox" checked={settings.notificationsEnabled} onChange={(event) => { setSettings({ ...settings, notificationsEnabled: event.target.checked }); setSaved(false) }} className="h-4 w-4 accent-lime-500" />
            <span><strong className="block text-xs font-semibold text-slate-300">Notificaciones</strong><span className="text-[10px] text-slate-400">Mostrar alertas en el panel</span></span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <p role="status" className="text-[10px] text-slate-400">{saved ? 'Configuración guardada en Neon.' : 'Los campos se guardan automáticamente al cambiar.'}</p>
          <button type="submit" className="flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-700"><Save size={14} /> {saved ? 'Guardado' : 'Guardar configuración'}</button>
        </div>
      </form>

      <section className="flex flex-col justify-between gap-4 rounded-xl border border-red-900/50 bg-slate-900 p-5 shadow-lg sm:flex-row sm:items-center">
        <div><h2 className="text-sm font-bold text-slate-100">Vaciar datos operativos</h2><p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-400">Elimina los registros operativos guardados en Neon sin volver a cargar datos de ejemplo. Esta acción no se puede deshacer.</p></div>
        <button onClick={reset} className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-900/50 px-3 text-xs font-bold text-red-300 hover:bg-red-950/30"><RotateCcw size={14} /> Vaciar datos</button>
      </section>
      {resetDone && <p role="status" className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><Check size={14} /> Los datos operativos fueron vaciados.</p>}
      <ActionConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-300 outline-none focus:border-slate-700'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
}

export default SettingsView
