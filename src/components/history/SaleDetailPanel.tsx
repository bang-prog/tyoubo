import type { SaleDetail } from '../../db/history'
import { sizeLabel } from '../../lib/labels'
import { formatYen } from '../../lib/money'
import { formatBusinessDate, timeOf } from '../../lib/time'
import styles from './SaleDetailPanel.module.css'

/** 選んだ会計の明細。返品はステップ⑨でここに加える。 */
export default function SaleDetailPanel({ sale }: { sale: SaleDetail }) {
  return (
    <div className="panel">
      <div className={styles.head}>
        <h3 className={styles.title}>会計 No.{sale.saleNo}</h3>
        <span className={`num ${styles.when}`}>
          {formatBusinessDate(sale.businessDate)} {timeOf(sale.soldAt)}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.items}>
          <thead>
            <tr>
              <th>商品</th>
              <th className={styles.r}>単価</th>
              <th className={styles.r}>数量</th>
              <th className={styles.r}>金額</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.productName}</b>
                  <span className={styles.variant}>
                    {item.color} / {sizeLabel(item.size)}
                    {item.categoryName && `・${item.categoryName}`}
                  </span>
                  {item.returnedQty > 0 && (
                    <span className="badge badge-bad">
                      {item.returnedQty === item.qty ? '返品済み' : `${item.returnedQty}点返品済み`}
                    </span>
                  )}
                </td>
                <td className={`num ${styles.r}`}>{formatYen(item.unitPriceIncl)}</td>
                <td className={`num ${styles.r}`}>{item.qty}</td>
                <td className={`num ${styles.r}`}>{formatYen(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className={styles.sum}>
        <dt>合計(税込)</dt>
        <dd className={`num ${styles.big}`}>{formatYen(sale.totalIncl)}</dd>
        <dt>税抜</dt>
        <dd className="num">{formatYen(sale.totalExcl)}</dd>
        <dt>うち消費税(10%)</dt>
        <dd className="num">{formatYen(sale.taxAmount)}</dd>
        <dt>お預かり</dt>
        <dd className="num">{formatYen(sale.received)}</dd>
        <dt>お釣り</dt>
        <dd className="num">{formatYen(sale.change)}</dd>
      </dl>

      {sale.refunds.length > 0 && (
        <ul className={styles.refunds}>
          {sale.refunds.map((r) => (
            <li key={r.id}>
              <span>
                返金(
                {r.businessDate === sale.businessDate ? '' : `${formatBusinessDate(r.businessDate)} `}
                {timeOf(r.refundedAt)})
              </span>
              <span className="num">−{formatYen(r.amountIncl)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
