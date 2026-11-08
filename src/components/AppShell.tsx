import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import Clock from './Clock'
import styles from './AppShell.module.css'

/** タブのアイコン(線だけの簡単な図)。色は文字と同じ色になる */
const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)

const TABS = [
  {
    to: '/',
    label: '会計',
    icon: icon(
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h2M12 11h0M14 11h2M8 15h2M12 15h0M14 15h2" />
      </>,
    ),
  },
  {
    to: '/products',
    label: '商品管理',
    icon: icon(<path d="M9 4l3 2 3-2 5 3-2 4h-2v9H8v-9H6L4 7z" />),
  },
  {
    to: '/history',
    label: '会計履歴',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>,
    ),
  },
  {
    to: '/closing',
    label: 'レジ締め',
    icon: icon(
      <>
        <rect x="3" y="7" width="18" height="11" rx="2" />
        <circle cx="12" cy="12.5" r="2.5" />
        <path d="M6 7V5h12v2" />
      </>,
    ),
  },
  {
    to: '/ledger',
    label: '帳簿',
    icon: icon(
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M9 10h6M9 14h6M9 18h3" />
      </>,
    ),
  },
  {
    to: '/settings',
    label: '設定',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </>,
    ),
  },
] as const

/**
 * 全画面に共通の枠。PC や iPad では上にアプリ名・タブ・時計を並べる。
 * スマホの縦向きでは、タブを画面下に固定して親指で押しやすくする(仕様書 §10.1)。
 */
export default function AppShell() {
  return (
    <div className={styles.app}>
      <h1 className={styles.brand}>レジ帳簿</h1>
      <nav className={styles.tabs} aria-label="画面の切り替え">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
          >
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      <Clock className={styles.clock} />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
