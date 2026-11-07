import { UserRound } from 'lucide-react'

function ProfilesView() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center">
        <UserRound className="mx-auto text-slate-400" size={24} />
        <p className="mt-3 text-sm font-semibold text-slate-200">No hay perfiles para mostrar</p>
        <p className="mt-1 text-xs text-slate-400">Los perfiles de ejemplo se quitaron. La gestión de usuarios requiere conexión con el backend.</p>
      </section>
    </div>
  )
}

export default ProfilesView
