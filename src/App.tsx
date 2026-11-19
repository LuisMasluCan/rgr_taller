import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import { DemoDataProvider } from './contexts/DemoDataProvider'
import AppointmentsView from './views/AppointmentsView'
import BanksView from './views/BanksView'
import CashRegisterView from './views/CashRegisterView'
import CategoriesView from './views/CategoriesView'
import ClientsView from './views/ClientsView'
import DashboardView from './views/DashboardView'
import EquipmentView from './views/EquipmentView'
import InventoryView from './views/InventoryView'
import MetricsView from './views/MetricsView'
import OrdersView from './views/OrdersView'
import OrderQuoteView from './views/OrderQuoteView'
import QuotationsView from './views/QuotationsView'
import ProfilesView from './views/ProfilesView'
import ReportsView from './views/ReportsView'
import SettingsView from './views/SettingsView'
import SuppliersView from './views/SuppliersView'

function OrderQuoteRoute({ mode }: { mode: 'quote' | 'invoice' }) {
  const { orderId } = useParams()
  return <OrderQuoteView key={`${mode}:${orderId}`} mode={mode} />
}

function App() {
  return (
    <DemoDataProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </DemoDataProvider>
  )
}

export default App
