import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import { DemoDataProvider } from './contexts/DemoDataProvider'
import OrdersView from './views/OrdersView'
const AppointmentsView = lazy(() => import('./views/AppointmentsView'))
const BanksView = lazy(() => import('./views/BanksView'))
const CashRegisterView = lazy(() => import('./views/CashRegisterView'))
const CategoriesView = lazy(() => import('./views/CategoriesView'))
const ClientsView = lazy(() => import('./views/ClientsView'))
const DashboardView = lazy(() => import('./views/DashboardView'))
const EquipmentView = lazy(() => import('./views/EquipmentView'))
const InventoryView = lazy(() => import('./views/InventoryView'))
const MetricsView = lazy(() => import('./views/MetricsView'))
const OrderQuoteView = lazy(() => import('./views/OrderQuoteView'))
const QuotationsView = lazy(() => import('./views/QuotationsView'))
const ProfilesView = lazy(() => import('./views/ProfilesView'))
const ReportsView = lazy(() => import('./views/ReportsView'))
const SettingsView = lazy(() => import('./views/SettingsView'))
const SuppliersView = lazy(() => import('./views/SuppliersView'))

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-xs font-semibold text-slate-400" role="status">
      Cargando módulo…
    </div>
  )
}

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('No se pudo cargar el módulo de navegación:', error, info)
  }

  reload = () => window.location.reload()

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6" role="alert">
        <section className="max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-center">
          <h2 className="text-sm font-bold text-slate-100">No se pudo cargar esta pantalla</h2>
          <p className="mt-2 text-xs text-slate-400">Puede haber cambiado la versión de la aplicación durante el despliegue.</p>
          <button type="button" onClick={this.reload} className="mt-4 rounded-lg bg-lime-300 px-4 py-2 text-xs font-bold text-slate-950">
            Recargar aplicación
          </button>
        </section>
      </div>
    )
  }
}

function OrderQuoteRoute({ mode }: { mode: 'quote' | 'invoice' }) {
  const { orderId } = useParams()
  return <OrderQuoteView key={`${mode}:${orderId}`} mode={mode} />
}

function App() {
  return (
    <DemoDataProvider>
      <BrowserRouter>
        <RouteErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
          <Route path="/dashboard-full" element={<DashboardView fullScreen />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/orders" element={<OrdersView />} />
            <Route path="/appointments" element={<AppointmentsView />} />
            <Route path="/orders/:orderId/invoice" element={<OrderQuoteRoute mode="invoice" />} />
            <Route path="/quotes" element={<QuotationsView />} />
            <Route path="/quotes/:orderId" element={<OrderQuoteRoute mode="quote" />} />
            <Route path="/banks" element={<BanksView />} />
            <Route path="/clients" element={<ClientsView />} />
            <Route path="/suppliers" element={<SuppliersView />} />
            <Route path="/cash-register" element={<CashRegisterView />} />
            <Route path="/inventory" element={<Navigate to="/inventory/items" replace />} />
            <Route path="/inventory/items" element={<InventoryView />} />
            <Route path="/inventory/equipment" element={<EquipmentView />} />
            <Route path="/inventory/categories" element={<CategoriesView />} />
            <Route path="/metrics" element={<MetricsView />} />
            <Route path="/reports" element={<Navigate to="/reports/sales" replace />} />
            <Route path="/reports/:reportId" element={<ReportsView />} />
            <Route path="/profiles" element={<ProfilesView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/orders" replace />} />
          </Route>
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </BrowserRouter>
    </DemoDataProvider>
  )
}

export default App
