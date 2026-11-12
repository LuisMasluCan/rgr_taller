import { AlignLeft, HelpCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import ActionConfirmModal, { type ActionConfirmation } from '../components/ActionConfirmModal'
import { PageSizeSelector, PaginationFooter } from '../components/TablePagination'
import { useDemoData } from '../contexts/useDemoData'
import { categoriesBySpecialty, categorySpecialties } from '../data/mockCategories'
import type { WorkshopCategory } from '../types'

type CategoryDraft = Omit<WorkshopCategory, 'id'>

const emptyDraft = (): CategoryDraft => ({
  specialty: '',
  category: '',
  description: '',
})

const selectClass = 'h-11 w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 text-xs text-slate-200 outline-none focus:border-lime-400'
const textClass = 'h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-lime-400'

function CategoriesView() {
  const { workshopCategories, setWorkshopCategories } = useDemoData()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [customCategory, setCustomCategory] = useState('')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null)

  const availableCategories = draft.specialty ? categoriesBySpecialty[draft.specialty] ?? [] : []
  const selectedCategory = isCustomCategory ? '__new__' : draft.category
  const pageCount = Math.max(1, Math.ceil(workshopCategories.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleCategories = workshopCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openNewCategory = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setCustomCategory('')
    setIsCustomCategory(false)
    setFormError('')
    setModalOpen(true)
  }

  const openEditCategory = (category: WorkshopCategory) => {
    setEditingId(category.id)
    setDraft({ specialty: category.specialty, category: category.category, description: category.description })
    const categoryExistsInList = (categoriesBySpecialty[category.specialty] ?? []).includes(category.category)
    setIsCustomCategory(!categoryExistsInList)
    setCustomCategory(categoryExistsInList ? '' : category.category)
    setFormError('')
    setModalOpen(true)
  }

  const saveCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const categoryName = (selectedCategory === '__new__' ? customCategory : draft.category).trim()
    if (!draft.specialty || !categoryName) {
      setFormError('Selecciona una especialidad e ingresa una categoría.')
      return
    }

    const duplicate = workshopCategories.some((category) =>
      category.id !== editingId
      && category.specialty === draft.specialty
      && category.category.toLocaleLowerCase('es-PE') === categoryName.toLocaleLowerCase('es-PE'),
    )
    if (duplicate) {
      setFormError('Ya existe esta categoría dentro de la especialidad seleccionada.')
      return
    }

    const savedCategory: WorkshopCategory = {
      id: editingId ?? `category-${crypto.randomUUID()}`,
      specialty: draft.specialty,
      category: categoryName,
      description: draft.description.trim(),
    }
    setWorkshopCategories((current) => editingId
      ? current.map((category) => category.id === editingId ? savedCategory : category)
      : [savedCategory, ...current])
    if (!editingId) setPage(1)
    setModalOpen(false)
  }

  const deleteCategory = (category: WorkshopCategory) => {
    setConfirmation({
      title: 'Eliminar categoría',
      message: `¿Deseas eliminar la categoría "${category.category}" de ${category.specialty}? Esta acción no se puede deshacer.`,
      confirmLabel: 'ELIMINAR CATEGORÍA',
      onConfirm: () => setWorkshopCategories((current) => current.filter((entry) => entry.id !== category.id)),
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">Categorías</h1>
          <p className="mt-1 text-xs text-slate-400">Organiza los trabajos del taller por especialidad y categoría</p>
        </div>
        <button type="button" onClick={openNewCategory} className="flex h-10 w-fit items-center gap-2 rounded-lg bg-lime-400 px-4 text-xs font-extrabold text-black shadow-sm transition hover:bg-lime-300">
          <Plus size={16} /> + NUEVO REGISTRO
        </button>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-100">Categorías registradas</h2>
          <p className="mt-1 text-[11px] text-slate-400">{workshopCategories.length} categorías configuradas</p>
          <div className="mt-3"><PageSizeSelector pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-950/60 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Especialidad</th>
                <th className="px-4 py-3.5">Categoría</th>
                <th className="px-4 py-3.5">Descripción</th>
                <th className="px-4 py-3.5 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleCategories.map((entry) => (
                <tr key={entry.id} className="text-xs text-slate-400 transition hover:bg-slate-800/40">
                  <td className="px-5 py-4 font-medium text-slate-300">{entry.specialty}</td>
                  <td className="px-4 py-4 font-semibold text-slate-100">{entry.category}</td>
                  <td className="max-w-[440px] whitespace-normal px-4 py-4">{entry.description || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Editar ${entry.category}`} onClick={() => openEditCategory(entry)} className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-300 transition hover:bg-violet-950/40"><Pencil size={14} /></button>
                      <button type="button" aria-label={`Eliminar ${entry.category}`} onClick={() => deleteCategory(entry)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-300 transition hover:bg-red-950/40"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {workshopCategories.length === 0 && <tr><td colSpan={4} className="px-5 py-12 text-center text-xs text-slate-400">No hay categorías registradas.</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginationFooter page={currentPage} pageCount={pageCount} pageSize={pageSize} total={workshopCategories.length} recordLabel="categorías" onPageChange={setPage} />
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="category-modal-title" onMouseDown={(event) => event.target === event.currentTarget && setModalOpen(false)}>
          <section className="my-auto w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
            <header className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 id="category-modal-title" className="text-base font-bold text-white">{editingId ? 'Editar Registro' : 'Nuevo Registro'}</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X size={18} /></button>
            </header>
            <form onSubmit={saveCategory} className="space-y-4">
              <CategoryField label="Especialidad" help="Selecciona el área de trabajo a la que pertenece esta categoría.">
                <select
                  required
                  value={draft.specialty}
                  onChange={(event) => {
                    setIsCustomCategory(false)
                    setCustomCategory('')
                    setDraft((current) => ({ ...current, specialty: event.target.value, category: '' }))
                  }}
                  className={selectClass}
                >
                  <option value="">Selecciona Especialidad</option>
                  {categorySpecialties.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
                </select>
              </CategoryField>
              <CategoryField label="Categoría" help="Elige una categoría existente o selecciona Otra categoría para crear una.">
                <select
                  required
                  disabled={!draft.specialty}
                  value={selectedCategory}
                  onChange={(event) => {
                    const isCustom = event.target.value === '__new__'
                    setIsCustomCategory(isCustom)
                    if (isCustom) setCustomCategory('')
                    setDraft((current) => ({ ...current, category: isCustom ? '' : event.target.value }))
                  }}
                  className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">Selecciona Categoría</option>
                  {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  <option value="__new__">Otra categoría...</option>
                </select>
              </CategoryField>
              {draft.specialty && selectedCategory === '__new__' && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-white">Nombre de la nueva categoría</span>
                  <span className="relative block"><AlignLeft size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input autoFocus required value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Escribe el nombre de la categoría" className={textClass} /></span>
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-white">Descripción / Observaciones</span>
                <span className="relative block"><AlignLeft size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" /><textarea rows={4} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción / Observaciones" className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-lime-400" /></span>
              </label>
              {formError && <p role="alert" className="text-xs font-medium text-red-300">{formError}</p>}
              <footer className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg bg-purple-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-purple-500">SALIR</button>
                <button type="submit" className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black transition hover:bg-lime-300">GUARDAR</button>
              </footer>
            </form>
          </section>
        </div>
      )}
      <ActionConfirmModal confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

function CategoryField({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
        {label}
        <span className="group relative inline-flex">
          <HelpCircle size={14} className="text-lime-300" aria-label={help} />
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-[10px] font-normal normal-case tracking-normal text-slate-300 shadow-xl group-hover:block group-focus-within:block">{help}</span>
        </span>
      </span>
      <span className="relative block">
        <AlignLeft size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        {children}
      </span>
    </label>
  )
}

export default CategoriesView
