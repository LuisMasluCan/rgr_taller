import {
  Activity,
  Bell,
  Boxes,
  Building2,
  Landmark,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileStack,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDemoData } from '../contexts/useDemoData'

const navigation = [
  { label: 'Métricas', icon: LayoutDashboard, path: '/metrics' },
  { label: 'Clientes', icon: Users, path: '/clients' },
  { label: 'Proveedores', icon: Building2, path: '/suppliers' },
  { label: 'Caja', icon: Wallet, path: '/cash-register' },
  { label: 'Inventarios', icon: Boxes, path: '/inventory' },
  { label: 'Órdenes de servicio', icon: ClipboardList, path: '/orders' },
  { label: 'Citas', icon: CalendarDays, path: '/appointments' },
  { label: 'Cotizaciones', icon: FileStack, path: '/quotes' },
]
const reportLinks = [
  { label: 'Ventas Generales', path: '/reports/sales' },
  { label: 'Ventas Por Ítems', path: '/reports/items' },
  { label: 'Operaciones', path: '/reports/operations' },
  { label: 'Rentabilidades', path: '/reports/profitability' },
  { label: 'Técnicos', path: '/reports/technicians' },
]

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [reportsExpanded, setReportsExpanded] = useState<boolean | null>(null)
  const [inventoryExpanded, setInventoryExpanded] = useState<boolean | null>(null)
  const reportsOpen = reportsExpanded ?? location.pathname.startsWith('/reports')
  const inventoryOpen = inventoryExpanded ?? location.pathname.startsWith('/inventory')
  const { authUser, logout, orders, isSaving, storageError } = useDemoData()
  const isInvoice = location.pathname.includes('/invoice')
  const isQuote = location.pathname.startsWith('/quotes')
  const isOrders = location.pathname === '/orders'
  const currentReport = reportLinks.find((link) => link.path === location.pathname)
  const pageTitle = isInvoice
    ? 'Facturación'
    : isQuote
      ? 'Cotizaciones'
    : location.pathname.startsWith('/clients')
      ? 'Clientes'
    : location.pathname.startsWith('/suppliers')
      ? 'Proveedores'
    : location.pathname.startsWith('/cash-register')
      ? 'Caja'
    : location.pathname.startsWith('/banks')
      ? 'Bancos'
    : location.pathname.startsWith('/dashboard')
      ? 'Tablero de Control'
    : location.pathname.startsWith('/appointments')
      ? 'Citas'
    : location.pathname.startsWith('/inventory')
        ? location.pathname.endsWith('/equipment')
          ? 'Planta y equipo'
          : location.pathname.endsWith('/categories')
            ? 'Categorías'
            : 'Ítem de venta'
        : location.pathname.startsWith('/metrics')
          ? 'Métricas'
          : location.pathname.startsWith('/reports')
            ? currentReport?.label ?? 'Reportes'
            : location.pathname.startsWith('/profiles')
              ? 'Perfiles'
              : location.pathname.startsWith('/settings')
                ? 'Configuraciones'
                : 'Órdenes de servicio'
  const recordId = location.pathname.match(/\/(?:orders|quotes)\/([^/]+)/)?.[1]

  useEffect(() => {
    document.title = `RGR Taller | ${pageTitle}${recordId ? ` #${recordId}` : ''}`
  }, [pageTitle, recordId])

  const handleLogout = async () => {
    setLogoutError(null)
    try {
      await logout()
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white lg:flex">
      {sidebarOpen && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col border-r border-slate-800 bg-[#0B1120] text-slate-300 transition-transform duration-200 lg:static lg:min-h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <img src="/rgr-logo-transparente.png" alt="RGR Taller Automotriz" className="h-auto w-40" />
          </div>
          <button aria-label="Cerrar menú" className="text-slate-400 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={19} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">Espacio de trabajo</p>
          <nav className="space-y-1">
            {navigation.filter(({ label }) => label !== 'Inventarios').map(({ label, icon: Icon, path }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-lime-300 font-semibold text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-white/7 hover:text-white'
                  }`
                }
              >
                <Icon size={17} />
                {label}
                {label === 'Órdenes de servicio' && (
                  <span className="ml-auto text-[10px] font-semibold text-slate-400">{orders.length}</span>
                )}
              </NavLink>
            ))}
            <div>
              <button
                type="button"
                aria-expanded={inventoryOpen}
                onClick={() => setInventoryExpanded(!inventoryOpen)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${
                  location.pathname.startsWith('/inventory')
                    ? 'bg-lime-300 font-semibold text-slate-950'
                    : 'text-slate-300 hover:bg-white/7 hover:text-white'
                }`}
              >
                <Boxes size={17} /> Inventarios
                <ChevronDown size={14} className={`ml-auto transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
              </button>
              {inventoryOpen && <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                {[
                  { label: 'Ítem de venta', path: '/inventory/items' },
                  { label: 'Planta y equipo', path: '/inventory/equipment' },
                  { label: 'Categorías', path: '/inventory/categories' },
                ].map(({ label, path }) => <NavLink
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `block rounded-md px-3 py-2 text-[11px] font-medium transition ${isActive ? 'bg-white/10 text-lime-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >{label}</NavLink>)}
              </div>}
            </div>
            <div>
              <button
                type="button"
                aria-expanded={reportsOpen}
                onClick={() => setReportsExpanded(!reportsOpen)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${
                  location.pathname.startsWith('/reports')
                    ? 'bg-lime-300 font-semibold text-slate-950'
                    : 'text-slate-300 hover:bg-white/7 hover:text-white'
                }`}
              >
                <Printer size={17} />
                Reportes
                <ChevronDown size={14} className={`ml-auto transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
              </button>
              {reportsOpen && <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                {reportLinks.map(({ label, path }) => <NavLink
                  key={path}
                  to={path}
                  onClick={() => { setReportsExpanded(true); setSidebarOpen(false) }}
                  className={({ isActive }) => `block rounded-md px-3 py-2 text-[11px] font-medium transition ${isActive ? 'bg-white/10 text-lime-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >{label}</NavLink>)}
              </div>}
            </div>
            <NavLink
              to="/banks"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                  isActive
                    ? 'bg-lime-300 font-semibold text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-white/7 hover:text-white'
                }`
              }
            >
              <Landmark size={17} />
              Bancos
            </NavLink>
          </nav>
        </div>

        <div className="mt-8 px-4">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">Administración</p>
          <nav className="space-y-1">
            <NavLink to="/profiles" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium ${isActive ? 'bg-lime-300 text-slate-950' : 'text-slate-300 hover:bg-white/7 hover:text-white'}`}>
              <ShieldCheck size={17} /> Perfiles
            </NavLink>
            <NavLink to="/settings" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium ${isActive ? 'bg-lime-300 text-slate-950' : 'text-slate-300 hover:bg-white/7 hover:text-white'}`}>
              <Settings size={17} /> Configuraciones
            </NavLink>
            <button type="button" onClick={() => { setSidebarOpen(false); window.open('/dashboard-full', '_blank', 'noopener,noreferrer') }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-3 py-3 text-center text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-lime-400">
              <FileText size={16} /> Tablero de Control
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
              <HelpCircle size={15} className="text-lime-300" /> ¿Necesitas ayuda?
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">Consulta la guía rápida de RGR Taller.</p>
            <button className="text-[11px] font-semibold text-lime-300 hover:text-lime-200">Ver centro de ayuda ↗</button>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300"><UserRound size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{authUser.name}</p>
              <p className="text-[10px] text-slate-400">Administrador</p>
            </div>
            <button type="button" onClick={() => void handleLogout()} disabled={isSaving} aria-label="Cerrar sesión" title="Cerrar sesión" className="rounded-md p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-40">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Taller RGR <span className="px-1">/</span> <span className="text-slate-400">{pageTitle}</span></p>
              <h1 className="mt-0.5 text-[17px] font-bold tracking-tight text-slate-100">{isInvoice ? 'Emitir factura' : isQuote && location.pathname !== '/quotes' ? 'Cotización de servicio' : pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {isOrders && (
              <button
                onClick={() => window.dispatchEvent(new Event('rgr-taller:create-order'))}
                className="flex h-10 items-center gap-2 rounded-lg bg-lime-300 px-3.5 text-[11px] font-extrabold tracking-wide text-slate-950 shadow-sm transition hover:bg-lime-400 sm:px-4 sm:text-xs"
              >
                <span className="text-base leading-none">+</span>
                <span className="hidden sm:inline">CREAR ORDEN DE SERVICIO</span>
                <span className="sm:hidden">CREAR ORDEN</span>
              </button>
            )}
            <button aria-label="Notificaciones" className="relative rounded-lg p-2 text-slate-300 hover:bg-slate-800">
              <Bell size={19} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-orange-500" />
            </button>
            <div className="hidden h-8 w-px bg-slate-700 sm:block" />
            <button className="hidden items-center gap-2 text-xs font-semibold text-slate-400 sm:flex">
              <Activity size={16} className="text-lime-300" /> Ayuda <ChevronDown size={13} />
            </button>
          </div>
        </header>
        {logoutError ? (
          <div role="alert" className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-center text-xs font-medium text-amber-200 sm:px-7 lg:px-9">
            {logoutError}
          </div>
        ) : storageError ? (
          <div role="alert" className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-center text-xs font-medium text-amber-200 sm:px-7 lg:px-9">
            No se guardaron los cambios en Neon: {storageError}. No recargues la página hasta resolverlo.
          </div>
        ) : isSaving ? (
          <div role="status" className="border-b border-sky-900/50 bg-sky-950/30 px-4 py-2 text-center text-xs font-medium text-sky-200 sm:px-7 lg:px-9">
            Guardando cambios en Neon…
          </div>
        ) : null}
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
