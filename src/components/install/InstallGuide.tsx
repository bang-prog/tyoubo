import { rememberInstallGuideClosed } from '../../lib/install'
import Modal from '../Modal'
import InstallSteps from './InstallSteps'
import styles from './InstallGuide.module.css'

/**
 * iPhone・iPad の Safari のタブで開いたときに、「ホーム画面に追加」の手順を案内する(仕様書 §9)。
 * ホーム画面から開いているときと、PC では出さない(出すかどうかは installGuideNeeded で決める)。
 */
export default function InstallGuide({ onClose }: { onClose: () => void }) {
  function close(storage: 'local' | 'session') {
    rememberInstallGuideClosed(storage)
    onClose()
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
