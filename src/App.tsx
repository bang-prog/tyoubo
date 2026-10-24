import { Navigate, Route, Routes } from 'react-router'
import AppShell from './components/AppShell'
import ClosingPage from './pages/ClosingPage'
import HistoryPage from './pages/HistoryPage'
import LedgerPage from './pages/LedgerPage'
import ProductsPage from './pages/ProductsPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'

// 画面一覧は仕様書 §11
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RegisterPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="closing" element={<ClosingPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
