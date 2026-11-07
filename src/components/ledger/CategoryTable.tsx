import type { CategoryRow } from '../../db/ledger'
import { formatYen } from '../../lib/money'
import styles from './CategoryTable.module.css'

/** カテゴリー別の点数・売上・構成比。構成比は横棒でも表す。返品は差し引かない売上で数える。 */
export default function CategoryTable({ categories }: { categories: CategoryRow[] }) {
  if (categories.length === 0) return <p className="hint">この期間の売上はありません。</p>

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>カテゴリー</th>
            <th className={styles.r}>点数</th>
            <th className={styles.r}>売上(税込)</th>
            <th>構成比</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => {
            const pct = Math.round(c.share * 100)
            return (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td className={`num ${styles.r}`}>{c.qty}</td>
                <td className={`num ${styles.r}`}>{formatYen(c.amountIncl)}</td>
                <td className={styles.barCell}>
                  <div className={styles.bar}>
                    <div className={styles.track}>
                      <div className={styles.fill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="num">{pct}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint">返品は差し引かずに数えています。</p>
    </div>
  )
}
