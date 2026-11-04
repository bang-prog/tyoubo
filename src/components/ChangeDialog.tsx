import { formatYen } from '../lib/money'
import Modal from './Modal'
import styles from './ChangeDialog.module.css'

type Props = {
  /** 会計番号 */
  saleNo: string
  total: number
  received: number
  change: number
  /** 「次のお客様へ」 */
  onNext: () => void
}

/** 会計の完了画面。お釣りを大きく表示する。 */
export default function ChangeDialog({ saleNo, total, received, change, onNext }: Props) {
  return (
    <Modal
      labelledBy="change-title"
      onClose={onNext}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onNext()
        }
      }}
      maxWidth={560}
    >
      <div className={styles.done}>
        <h2 id="change-title" className={styles.label}>
          お釣り
        </h2>
        <p className={`num ${styles.amount}`}>{formatYen(change)}</p>
        <dl className={styles.detail}>
          <div>
            <dt>お会計</dt>
            <dd className="num">{formatYen(total)}</dd>
          </div>
          <div>
            <dt>お預かり</dt>
            <dd className="num">{formatYen(received)}</dd>
          </div>
          <div>
            <dt>会計番号</dt>
            <dd className="num">{saleNo}</dd>
          </div>
        </dl>
        <button type="button" className={styles.next} onClick={onNext}>
          次のお客様へ
        </button>
      </div>
    </Modal>
  )
}
