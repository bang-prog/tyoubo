import type { SaleDetail } from '../../db/history'
import { formatYen } from '../../lib/money'
import { PAYMENT_SHORT_LABELS, paymentMethodOf } from '../../lib/payment'
import { timeOf } from '../../lib/time'
import styles from './SaleList.module.css'

type Props = {
  sales: SaleDetail[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** その日の会計の一覧。時刻、商品、支払い方法、点数、合計を表示する。 */
export default function SaleList({ sales, selectedId, onSelect }: Props) {
  return (
    <ul className={styles.list}>
      {sales.map((sale) => {
        const count = sale.items.reduce((sum, i) => sum + i.qty, 0)
        const first = sale.items[0]?.productName ?? ''
        const returned = sale.items.some((i) => i.returnedQty > 0)
        return (
          <li key={sale.id}>
            <button
              type="button"
              className={styles.row}
              aria-pressed={sale.id === selectedId}
              onClick={() => onSelect(sale.id)}
            >
              <span className={`num ${styles.time}`}>{timeOf(sale.soldAt)}</span>
              <span className={styles.summary}>
                <span className={styles.name}>
                  {first}
                  {sale.items.length > 1 && ' ほか'}
                </span>
                <small>
                  {PAYMENT_SHORT_LABELS[paymentMethodOf(sale)]}・{count}点・No.{sale.saleNo}
                </small>
              </span>
              <span className={`num ${styles.total}`}>
                {formatYen(sale.totalIncl)}
                {returned && <span className="badge badge-bad">返品あり</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
