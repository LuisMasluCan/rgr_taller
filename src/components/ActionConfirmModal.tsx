import { AlertTriangle, X } from 'lucide-react'

export type ActionConfirmation = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

type Props = {
  confirmation: ActionConfirmation | null
  onClose: () => void
}

function ActionConfirmModal({ confirmation, onClose }: Props) {
  if (!confirmation) return null

  const confirm = () => {
    confirmation.onConfirm()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="action-confirm-title"
        aria-describedby="action-confirm-message"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="action-confirm-title" className="text-base font-bold text-white">{confirmation.title}</h2>
            <p id="action-confirm-message" className="mt-2 text-sm leading-relaxed text-slate-300">{confirmation.message}</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X size={17} />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-4 text-xs font-bold text-slate-200 transition hover:bg-slate-700">
            VOLVER
          </button>
          <button type="button" onClick={confirm} className="h-10 rounded-lg bg-lime-400 px-4 text-xs font-extrabold text-slate-950 transition hover:bg-lime-300">
            {confirmation.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ActionConfirmModal


