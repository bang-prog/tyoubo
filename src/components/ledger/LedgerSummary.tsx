import type { LedgerRow } from '../../db/ledger'
import { formatYen } from '../../lib/money'
import styles from './LedgerSummary.module.css'

/** 期間の合計を数字のタイルで並べる。差引売上を一番目立たせる。 */
export default function LedgerSummary({ total }: { total: LedgerRow }) {
  const tiles = [
    { label: '売上(税込)', value: formatYen(total.salesIncl) },
    { label: '税抜', value: formatYen(total.salesExcl) },
    { label: 'うち消費税', value: formatYen(total.salesTax) },
    { label: '返金', value: formatYen(total.refundIncl) },
    { label: '会計件数', value: `${total.count}件` },
  ]
  return (
    <div className={styles.tiles}>
      <div className={`${styles.tile} ${styles.main}`}>
        <div className={styles.label}>差引売上(売上 − 返金)</div>
        <div className={`num ${styles.value}`}>{formatYen(total.netIncl)}</div>
      </div>
      {tiles.map((t) => (
        <div key={t.label} className={styles.tile}>
          <div className={styles.label}>{t.label}</div>
          <div className={`num ${styles.value}`}>{t.value}</div>
        </div>
      ))}
    </div>
  )
}
