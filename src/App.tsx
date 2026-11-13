import { Navigate, Route, Routes } from 'react-router'
import AppShell from './components/AppShell'
import StartupGuides from './components/guide/StartupGuides'
import UpdatePrompt from './components/UpdatePrompt'
import ClosingPage from './pages/ClosingPage'
import HistoryPage from './pages/HistoryPage'
import LedgerPage from './pages/LedgerPage'
import ProductsPage from './pages/ProductsPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'
import CartProvider from './state/CartProvider'

// 画面一覧は仕様書 §11
export default function App() {
  return (
    <CartProvider>
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
      {/* 新しい版のお知らせ(PWA)と、最初に開いたときの案内(ホーム画面に追加・使い方) */}
      <UpdatePrompt />
      <StartupGuides />
    </CartProvider>
  )
}
