import { useState } from 'react'
import { currentInstallEnv, shouldShowInstallGuide } from '../../lib/install'
import Modal from '../Modal'
import InstallSteps from './InstallSteps'
import styles from './InstallGuide.module.css'

/** 「表示しない」を押したら、この端末では二度と出さない */
const DISMISS_KEY = 'tyoubo-install-guide-dismissed'
/** 「あとで」を押したら、このタブ(Safari)を閉じるまで出さない */
const LATER_KEY = 'tyoubo-install-guide-later'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1' || sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    return false
  }
}

function remember(storage: 'local' | 'session') {
  try {
    if (storage === 'local') localStorage.setItem(DISMISS_KEY, '1')
    else sessionStorage.setItem(LATER_KEY, '1')
  } catch {
    // 覚えておけなくても、閉じることはできる
  }
}

/**
 * iPhone・iPad の Safari のタブで開いたときに、「ホーム画面に追加」の手順を案内する(仕様書 §9)。
 * ホーム画面から開いているときと、PC では出さない。
 */
export default function InstallGuide() {
  const [open, setOpen] = useState(() => shouldShowInstallGuide(currentInstallEnv()) && !wasDismissed())
  if (!open) return null

  function close(storage: 'local' | 'session') {
    remember(storage)
    setOpen(false)
  }

  return (
    <Modal labelledBy="install-title" onClose={() => close('session')} maxWidth={480}>
      <div className={styles.body}>
        <h2 id="install-title" className={styles.title}>
          ホーム画面に追加して使ってください
        </h2>
        <p>
          ホーム画面から開くと、画面が広くなり、電波がなくても使えます。Safari がしばらく開かれていないサイトのデータを消すことがありますが、ホーム画面のアプリならその心配がありません。
        </p>
        <InstallSteps />
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => close('local')}>
            今後は表示しない
          </button>
          <button type="button" className="btn btn-primary" onClick={() => close('session')}>
            あとで
          </button>
        </div>
      </div>
    </Modal>
  )
}
