import { ArrowDownLeft, ArrowUpRight, Landmark, List, Pencil, Plus, Wallet, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useDemoData } from '../contexts/useDemoData'
import NumericInput from '../components/NumericInput'
import type { BankAccount, BankAccountType, BankMovement } from '../data/mockBanks'

type AccountDraft = {
  name: string
  number: string
  type: BankAccountType
  initialBalance: string
  currentBalance: string
}

type AccountModalState =
  | { kind: 'create' }
  | { kind: 'edit'; accountId: string }
  | { kind: 'movement'; accountId: string; direction: 'Ingreso' | 'Egreso' }
  | { kind: 'history'; accountId: string }
  | null

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const emptyDraft = (): AccountDraft => ({ name: '', number: '', type: 'Banco', initialBalance: '0', currentBalance: '0' })

function BanksView() {
  const { bankAccounts: accounts, setBankAccounts: setAccounts, bankMovements: movements, setBankMovements: setMovements } = useDemoData()
  const [modal, setModal] = useState<AccountModalState>(null)
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft)
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState('')

  const selectedAccount = modal && 'accountId' in modal
    ? accounts.find((account) => account.id === modal.accountId) ?? null
    : null
  const totalBalance = accounts.reduce((total, account) => total + account.currentBalance, 0)

  const createAccount = () => {
    setDraft(emptyDraft())
    setFormError('')
    setModal({ kind: 'create' })
  }

  const editAccount = (account: BankAccount) => {
    setDraft({
      name: account.name,
      number: account.number,
      type: account.type,
      initialBalance: String(account.initialBalance),
      currentBalance: String(account.currentBalance),
    })
    setFormError('')
    setModal({ kind: 'edit', accountId: account.id })
  }

  const submitAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const initialBalance = Number(draft.initialBalance)
    const currentBalance = Number(draft.currentBalance)
    if (!draft.name.trim() || !draft.number.trim() || !Number.isFinite(initialBalance) || !Number.isFinite(currentBalance)) {
      setFormError('Completa los datos de la cuenta con importes válidos.')
      return
    }

    if (modal?.kind === 'edit') {
      setAccounts((current) => current.map((account) => account.id === modal.accountId
        ? { ...account, name: draft.name.trim(), number: draft.number.trim(), type: draft.type, initialBalance, currentBalance }
        : account))
    } else {
      const id = `bank-${Date.now()}`
      setAccounts((current) => [...current, {
        id,
        name: draft.name.trim(),
        number: draft.number.trim(),
        type: draft.type,
        initialBalance,
        currentBalance,
      }])
      setMovements((current) => ({ ...current, [id]: [] }))
    }
    setModal(null)
  }

  const submitMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAccount || !modal || modal.kind !== 'movement') return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || !concept.trim()) {
      setFormError('Ingresa un concepto y un importe mayor que cero.')
      return
    }

    const movement: BankMovement = {
      id: `movement-${Date.now()}`,
      date: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }),
      concept: concept.trim(),
      type: modal.direction,
      amount: value,
    }
    const balanceChange = modal.direction === 'Ingreso' ? value : -value
    setAccounts((current) => current.map((account) => account.id === selectedAccount.id
      ? { ...account, currentBalance: account.currentBalance + balanceChange }
      : account))
    setMovements((current) => ({
      ...current,
      [selectedAccount.id]: [movement, ...(current[selectedAccount.id] ?? [])],
    }))
    setModal(null)
  }

  const openMovement = (accountId: string, direction: 'Ingreso' | 'Egreso') => {
    setAmount('')
    setConcept('')
    setFormError('')
    setModal({ kind: 'movement', accountId, direction })
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mt-1 text-[11px] text-slate-400">Consulta y administra los saldos y movimientos de tus cuentas.</p>
        </div>
        <button type="button" onClick={createAccount} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-xs font-extrabold text-slate-950 shadow-sm hover:bg-lime-400">
          <Plus size={16} /> Nueva cuenta
        </button>
      </section>

      <section className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-900/40 text-lime-300"><Wallet size={21} /></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Saldo actual total</p><p className="mt-1 text-xl font-extrabold text-slate-100">{currency.format(totalBalance)}</p></div>
        <span className="ml-auto text-xs text-slate-400">{accounts.length} cuentas</span>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-4"><Landmark size={17} className="text-slate-400" /><h2 className="text-sm font-bold text-slate-100">Cuentas y cajas</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-slate-800 text-[9px] font-bold uppercase tracking-wide text-slate-400">
              <tr><th className="px-5 py-3">Nombre</th><th className="px-4 py-3">Número (Cuenta)</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Saldo inicial</th><th className="px-4 py-3 text-right">Saldo actual</th><th className="px-5 py-3 text-right">Opciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <tr key={account.id} className="text-xs hover:bg-slate-900/70">
                  <td className="px-5 py-4 font-semibold text-slate-200">{account.name}</td>
                  <td className="px-4 py-4 text-slate-400">{account.number}</td>
                  <td className="px-4 py-4"><span className="rounded-full border border-slate-700 bg-transparent px-2.5 py-1 text-[10px] font-semibold text-slate-300">{account.type}</span></td>
                  <td className="px-4 py-4 text-right text-slate-400">{currency.format(account.initialBalance)}</td>
                  <td className={`px-4 py-4 text-right font-bold ${account.currentBalance < 0 ? 'text-rose-300' : 'text-slate-200'}`}>{currency.format(account.currentBalance)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <RowAction label="Ver movimientos" icon={<List size={15} />} onClick={() => setModal({ kind: 'history', accountId: account.id })} />
                      <RowAction label="Añadir ingreso" icon={<ArrowUpRight size={15} />} onClick={() => openMovement(account.id, 'Ingreso')} />
                      <RowAction label="Registrar egreso" icon={<ArrowDownLeft size={15} />} onClick={() => openMovement(account.id, 'Egreso')} />
                      <RowAction label="Editar cuenta" icon={<Pencil size={14} />} onClick={() => editAccount(account)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.kind === 'history' && selectedAccount && (
        <Modal title={`Movimientos · ${selectedAccount.name}`} onClose={() => setModal(null)}>
          <div className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">
            {(movements[selectedAccount.id] ?? []).length ? (movements[selectedAccount.id] ?? []).map((movement) => (
              <div key={movement.id} className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-xs font-semibold text-slate-200">{movement.concept}</p><p className="mt-1 text-[10px] text-slate-400">{movement.date} · {movement.type}</p></div>
                <p className={`text-xs font-bold ${movement.type === 'Ingreso' ? 'text-emerald-300' : 'text-rose-300'}`}>{movement.type === 'Ingreso' ? '+' : '−'} {currency.format(movement.amount)}</p>
              </div>
            )) : <p className="py-8 text-center text-xs text-slate-400">Esta cuenta aún no tiene movimientos.</p>}
          </div>
        </Modal>
      )}

      {(modal?.kind === 'create' || modal?.kind === 'edit') && (
        <Modal title={modal.kind === 'create' ? 'Crear cuenta bancaria o caja' : 'Editar cuenta'} onClose={() => setModal(null)}>
          <form onSubmit={submitAccount} className="space-y-3">
            <TextField label="Nombre" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} required />
            <TextField label="Número de cuenta" value={draft.number} onChange={(value) => setDraft((current) => ({ ...current, number: value }))} required />
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Tipo</span><select value={draft.type} onChange={(event) => {
              const value = event.target.value
              if (value === 'Efectivo' || value === 'Banco' || value === 'Tarjeta de crédito' || value === 'Billetera') setDraft((current) => ({ ...current, type: value }))
            }} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs">{(['Efectivo', 'Banco', 'Tarjeta de crédito', 'Billetera'] as BankAccountType[]).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><NumberField label="Saldo inicial" value={draft.initialBalance} onChange={(value) => setDraft((current) => ({ ...current, initialBalance: value }))} required min="0" /><NumberField label="Saldo actual" value={draft.currentBalance} onChange={(value) => setDraft((current) => ({ ...current, currentBalance: value }))} required /></div>
            {formError && <p role="alert" className="text-xs text-rose-300">{formError}</p>}
            <ModalActions onCancel={() => setModal(null)} submitLabel={modal.kind === 'create' ? 'Crear cuenta' : 'Guardar cambios'} />
          </form>
        </Modal>
      )}

      {modal?.kind === 'movement' && selectedAccount && (
        <Modal title={`${modal.direction === 'Ingreso' ? 'Añadir saldo' : 'Restar saldo'} · ${selectedAccount.name}`} onClose={() => setModal(null)}>
          <form onSubmit={submitMovement} className="space-y-3">
            <TextField label="Concepto" value={concept} onChange={setConcept} required />
            <NumberField label="Importe" value={amount} onChange={setAmount} required min="0.01" />
            {formError && <p role="alert" className="text-xs text-rose-300">{formError}</p>}
            <ModalActions onCancel={() => setModal(null)} submitLabel={modal.direction === 'Ingreso' ? 'Registrar ingreso' : 'Registrar egreso'} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function RowAction({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100">{icon}</button>
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">{label}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none focus:border-slate-700" /></label>
}

function NumberField({ label, value, onChange, required = false, min }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; min?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">{label}</span><NumericInput required={required} step="0.01" min={min} value={value} onChange={onChange} className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none focus:border-slate-700" /></label>
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400">Cancelar</button><button type="submit" className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400">{submitLabel}</button></div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="my-auto w-full max-w-lg rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-slate-100">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button></div>{children}</div></div>
}

export default BanksView
