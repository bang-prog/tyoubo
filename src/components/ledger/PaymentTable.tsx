import type { PaymentRow } from '../../db/ledger'
import { formatYen } from '../../lib/money'
import { PAYMENT_LABELS } from '../../lib/payment'
import styles from './CategoryTable.module.css'

/** 支払い方法別の件数・売上・返金・差引(仕様書 §5 F5)。返金は返品した日で数える。 */
export default function PaymentTable({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return <p className="hint">この期間の売上はありません。</p>

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>支払い方法</th>
            <th className={styles.r}>件数</th>
            <th className={styles.r}>売上(税込)</th>
            <th className={styles.r}>返金</th>
            <th className={styles.r}>差引</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.method}>
              <td>{PAYMENT_LABELS[p.method]}</td>
              <td className={`num ${styles.r}`}>{p.count}</td>
              <td className={`num ${styles.r}`}>{formatYen(p.salesIncl)}</td>
              <td className={`num ${styles.r}`}>{p.refundIncl ? `−${formatYen(p.refundIncl)}` : '—'}</td>
              <td className={`num ${styles.r}`}>{formatYen(p.netIncl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">キャッシュレスの決済と返金は Square に記録されています。ここでは、このアプリに記録した分を集計しています。</p>
    </div>
  )
}
