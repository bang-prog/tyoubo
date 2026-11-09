import { useRegisterSW } from 'virtual:pwa-register/react'
import { useCart } from '../state/CartContext'
import styles from './UpdatePrompt.module.css'

/** 新しい版を確かめる間隔。開いたままの日でも、1時間ごとに確かめる */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * サービスワーカーを登録し、新しい版が届いたら知らせる(PWA)。
 * 会計の途中で画面が入れ替わらないように、自動では更新せず「更新する」を押してもらう。
 */
export default function UpdatePrompt() {
  const { lines } = useCart()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        // 電波がないときは確かめない(失敗するだけなので)
        if (navigator.onLine) void registration.update()
      }, CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        <strong>新しい版があります。</strong>
        {lines.length > 0 ? '更新するとカートの中身が消えます。会計が終わってから更新してください。' : '更新すると画面を読み込み直します。'}
      </p>
      <div className={styles.buttons}>
        <button type="button" className="btn btn-sm" onClick={() => setNeedRefresh(false)}>
          あとで
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void updateServiceWorker(true)}>
          更新する
        </button>
      </div>
    </div>
  )
}
