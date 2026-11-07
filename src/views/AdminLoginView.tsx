import { useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function responseError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.error === 'string') return body.error
  } catch {
    return `El servidor respondió con el estado ${response.status}.`
  }
  return `El servidor respondió con el estado ${response.status}.`
}

function AdminLoginView({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState('admin@rgrtaller.pe')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      setPassword('')
      onAuthenticated()
    } catch (loginError) {
      console.error('No se pudo iniciar sesión:', loginError)
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B1120] p-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
        <img src="/rgr-logo-transparente.png" alt="RGR Taller Automotriz" className="mx-auto mb-7 h-auto w-44" />
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-lime-300/10 text-lime-300">
            <LockKeyhole size={20} />
          </div>
          <h1 className="text-xl font-bold">Acceso de administrador</h1>
          <p className="mt-2 text-sm text-slate-400">Inicia sesión con la cuenta administradora de RGR Taller.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-300">Correo electrónico</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-lime-400"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-300">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-lime-400"
            />
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-lime-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Verificando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">Por ahora, solo puede ingresar la cuenta ADMIN.</p>
      </section>
    </main>
  )
}

export default AdminLoginView
