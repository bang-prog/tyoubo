import { formatYen } from '../lib/money'
import { PAYMENT_LABELS, type PaymentMethod } from '../lib/payment'
import Modal from './Modal'
import styles from './ChangeDialog.module.css'

type Props = {
  /** 会計番号 */
  saleNo: string
  total: number
  received: number
  change: number
  paymentMethod: PaymentMethod
  /** 「次のお客様へ」 */
  onNext: () => void
}

/** 会計の完了画面。現金はお釣りを大きく、キャッシュレスは合計と支払い方法を表示する。 */
export default function ChangeDialog({ saleNo, total, received, change, paymentMethod, onNext }: Props) {
  const isCash = paymentMethod === 'cash'
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
          {isCash ? 'お釣り' : '会計を記録しました'}
        </h2>
        <p className={`num ${styles.amount}`}>{formatYen(isCash ? change : total)}</p>
        <dl className={styles.detail}>
          {isCash ? (
            <>
              <div>
                <dt>お会計</dt>
                <dd className="num">{formatYen(total)}</dd>
              </div>
              <div>
                <dt>お預かり</dt>
                <dd className="num">{formatYen(received)}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt>支払い方法</dt>
              <dd>{PAYMENT_LABELS[paymentMethod]}</dd>
            </div>
          )}
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
