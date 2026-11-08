import { PAYMENT_LABELS, type PaymentMethod } from '../lib/payment'
import { formatYen } from '../lib/money'
import Modal from './Modal'
import styles from './CashlessDialog.module.css'

type Props = {
  method: Exclude<PaymentMethod, 'cash'>
  total: number
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * キャッシュレスの会計の確認(仕様書 §5 F2)。決済は Square のアプリで行い、
 * 終わったらここで「会計を確定」を押して記録する。お預かり = 合計、お釣り = 0 になる。
 */
export default function CashlessDialog({ method, total, busy, error, onCancel, onConfirm }: Props) {
  return (
    <Modal
      labelledBy="cashless-title"
      onClose={() => !busy && onCancel()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !busy) {
          e.preventDefault()
          onConfirm()
        }
      }}
      maxWidth={480}
    >
      <div className={styles.body}>
        <h2 id="cashless-title" className={styles.title}>
          {PAYMENT_LABELS[method]}で会計
        </h2>
        <div className={styles.total}>
          <span>お会計(税込)</span>
          <span className={`num ${styles.amount}`}>{formatYen(total)}</span>
        </div>
        <p className={styles.steps}>
          Square のアプリで <b className="num">{formatYen(total)}</b> の決済をしてください。
          <br />
          決済が終わったら「会計を確定」を押して記録します。
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={`btn ${styles.back}`} onClick={onCancel} disabled={busy}>
            戻る
          </button>
          <button type="button" className={`btn btn-primary ${styles.confirm}`} onClick={onConfirm} disabled={busy}>
            {busy ? '保存しています…' : '会計を確定'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
