import type { LedgerMode, LedgerRow } from '../../db/ledger'
import { formatYen } from '../../lib/money'
import { WEEKDAYS } from '../../lib/time'
import styles from './LedgerTable.module.css'

/** '2026-11-02' → '11/2(月)'、'2026-11' → '11月' */
function rowLabel(mode: LedgerMode, key: string): string {
  if (mode === 'month') return `${Number(key.slice(5, 7))}月`
  const [y, m, d] = key.split('-').map(Number)
  return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

const refund = (value: number) => (value ? `−${formatYen(value)}` : '—')

type Props = {
  mode: LedgerMode
  rows: LedgerRow[]
  total: LedgerRow
  /** その行(日別なら1日、月別なら1か月)の Excel を出力する。渡すと各行にボタンが出る */
  onDownloadRow?: (key: string) => void
  /** 出力している行のキー(出力中はボタンを押せなくする) */
  downloadingKey?: string | null
  /** 古いデータを削除した月('YYYY-MM')。その月の行は「削除済み」とする */
  purgedMonths?: string[]
}

/** 日別・月別の売上の表。会計も返品もない日(月)は「会計なし」、データを削除した月は「削除済み」とする。 */
export default function LedgerTable({ mode, rows, total, onDownloadRow, downloadingKey, purgedMonths = [] }: Props) {
  if (rows.length === 0) return <p className="hint">この期間のデータはありません。</p>
  const withDownload = Boolean(onDownloadRow)
  const columns = withDownload ? 8 : 7

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{mode === 'day' ? '日付' : '月'}</th>
            <th className={styles.r}>件数</th>
            <th className={styles.r}>売上(税込)</th>
            <th className={styles.r}>税抜</th>
            <th className={styles.r}>消費税</th>
            <th className={styles.r}>返金</th>
            <th className={styles.r}>差引</th>
            {withDownload && <th className={styles.r}>Excel</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.count === 0 && r.refundIncl === 0 ? (
              <tr key={r.key} className={styles.empty}>
                <td>{rowLabel(mode, r.key)}</td>
                <td colSpan={columns - 1}>{purgedMonths.includes(r.key.slice(0, 7)) ? '削除済み' : '会計なし'}</td>
              </tr>
            ) : (
              <tr key={r.key}>
                <td>{rowLabel(mode, r.key)}</td>
                <td className={`num ${styles.r}`}>{r.count}</td>
                <td className={`num ${styles.r}`}>{formatYen(r.salesIncl)}</td>
                <td className={`num ${styles.r}`}>{formatYen(r.salesExcl)}</td>
                <td className={`num ${styles.r}`}>{formatYen(r.salesTax)}</td>
                <td className={`num ${styles.r} ${r.refundIncl ? styles.refund : ''}`}>{refund(r.refundIncl)}</td>
                <td className={`num ${styles.r} ${styles.net}`}>{formatYen(r.netIncl)}</td>
                {withDownload && (
                  <td className={styles.r}>
                    <button
                      type="button"
                      className={`btn btn-sm ${styles.download}`}
                      onClick={() => onDownloadRow?.(r.key)}
                      disabled={Boolean(downloadingKey)}
                      aria-label={`${rowLabel(mode, r.key)}の Excel をダウンロード`}
                    >
                      {downloadingKey === r.key ? '作成中…' : '保存'}
                    </button>
                  </td>
                )}
              </tr>
            ),
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>合計</td>
            <td className={`num ${styles.r}`}>{total.count}</td>
            <td className={`num ${styles.r}`}>{formatYen(total.salesIncl)}</td>
            <td className={`num ${styles.r}`}>{formatYen(total.salesExcl)}</td>
            <td className={`num ${styles.r}`}>{formatYen(total.salesTax)}</td>
            <td className={`num ${styles.r}`}>{refund(total.refundIncl)}</td>
            <td className={`num ${styles.r}`}>{formatYen(total.netIncl)}</td>
            {withDownload && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
