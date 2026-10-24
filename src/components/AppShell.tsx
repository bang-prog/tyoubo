import { NavLink, Outlet } from 'react-router'
import Clock from './Clock'
import styles from './AppShell.module.css'

const TABS = [
  { to: '/', label: '会計' },
  { to: '/products', label: '商品管理' },
  { to: '/history', label: '会計履歴' },
  { to: '/closing', label: 'レジ締め' },
  { to: '/ledger', label: '帳簿' },
  { to: '/settings', label: '設定' },
] as const

/** 全画面に共通の枠。上にアプリ名・タブ・時計、その下に各画面を表示する。 */
export default function AppShell() {
  return (
    <div className={styles.app}>
      <header className={styles.bar}>
        <h1 className={styles.brand}>レジ帳簿</h1>
        <nav className={styles.tabs} aria-label="画面の切り替え">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <Clock className={styles.clock} />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
