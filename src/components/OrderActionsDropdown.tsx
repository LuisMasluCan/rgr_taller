import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, List, Printer } from 'lucide-react'

export type OrderDocumentKind = 'service' | 'work' | 'diagnosis' | 'report'

const actions: { label: string; kind: OrderDocumentKind; print: boolean }[] = [
  { label: 'Orden de Servicio', kind: 'service', print: false },
  { label: 'Orden de Trabajo', kind: 'work', print: false },
  { label: 'Diagnóstico Mecánica', kind: 'diagnosis', print: false },
  { label: 'Reporte de ODS', kind: 'report', print: true },
]

function OrderActionsDropdown({ onSelect }: { onSelect: (kind: OrderDocumentKind) => void }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const button = buttonRef.current
      if (!button) return
      const bounds = button.getBoundingClientRect()
      const menuWidth = 224
      const menuHeight = Math.min(192, window.innerHeight - 16)
      const spaceBelow = window.innerHeight - bounds.bottom
      const top = spaceBelow >= menuHeight + 8
        ? bounds.bottom + 8
        : Math.max(8, bounds.top - menuHeight - 8)
      const left = Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8))
      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node
        && !menuRef.current?.contains(event.target)
        && !buttonRef.current?.contains(event.target)
      ) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        title="Más acciones"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-lime-400 bg-transparent text-lime-400 transition hover:bg-lime-400/20"
      >
        <List size={17} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: position.top, left: position.left, width: 224 }}
          className="z-[100] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl"
        >
          {actions.map(({ label, kind, print }) => {
            const Icon = print ? Printer : FileText
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSelect(kind)
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default OrderActionsDropdown
