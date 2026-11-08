import { useState } from 'react'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import type { SaleDetail } from '../../db/history'
import { createRefund } from '../../db/refunds'
import type { SaleItem } from '../../db/types'
import { sizeLabel } from '../../lib/labels'
import { formatYen, splitTax } from '../../lib/money'
import { PAYMENT_LABELS, paymentMethodOf } from '../../lib/payment'
import { formatBusinessDate, timeOf } from '../../lib/time'
import styles from './SaleDetailPanel.module.css'

const remainingOf = (item: SaleItem) => item.qty - item.returnedQty

/**
 * 選んだ会計の明細と、返品(仕様書 §5 F3)。
 * 商品にチェックを入れ、返品する数を選び、画面の中で返金額を確認してから確定する。
 * 別の会計を選ぶと作り直される(呼び出し側で key に会計の id を渡す)。
 */
export default function SaleDetailPanel({ sale }: { sale: SaleDetail }) {
  /** 返品する明細の id と数 */
  const [selection, setSelection] = useState<Record<string, number>>({})
  const [confirming, setConfirming] = useState(false)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const method = paymentMethodOf(sale)
  const isCash = method === 'cash'

  const selected = sale.items
    .filter((item) => selection[item.id] && remainingOf(item) > 0)
    .map((item) => ({ item, qty: Math.min(selection[item.id], remainingOf(item)) }))
  const refundAmount = selected.reduce((sum, s) => sum + s.item.unitPriceIncl * s.qty, 0)
  const refundTax = splitTax(refundAmount).tax
  const canReturn = sale.items.some((item) => remainingOf(item) > 0)

  function resetMessages() {
    setConfirming(false)
    setError(null)
    setNotice(null)
  }

  function toggle(item: SaleItem, checked: boolean) {
    setSelection((prev) => {
      const next = { ...prev }
      // チェックを入れたら、まだ返品していない数をすべて返品する数にする(あとで減らせる)
      if (checked) next[item.id] = remainingOf(item)
      else delete next[item.id]
      return next
    })
    resetMessages()
  }

  function changeQty(item: SaleItem, delta: number) {
    setSelection((prev) => ({
      ...prev,
      [item.id]: Math.min(remainingOf(item), Math.max(1, (prev[item.id] ?? 1) + delta)),
    }))
    resetMessages()
  }

  async function confirmRefund() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const refund = await createRefund(db, {
        saleId: sale.id,
        items: selected.map((s) => ({ saleItemId: s.item.id, qty: s.qty })),
        memo,
      })
      setSelection({})
      setConfirming(false)
      setMemo('')
      setNotice(
        isCash
          ? `${formatYen(refund.amountIncl)} の返品を記録しました。お客様に現金でお返しください。`
          : `${formatYen(refund.amountIncl)} の返品を記録しました。Square のアプリで${PAYMENT_LABELS[method]}の返金をしてください。`,
      )
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

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
              {canReturn && (
                <th className={styles.check}>
                  <span className="sr-only">返品</span>
                </th>
              )}
              <th>商品</th>
              <th className={`${styles.r} ${styles.wide}`}>単価</th>
              <th className={`${styles.r} ${styles.wide}`}>数量</th>
              <th className={styles.r}>金額</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => {
              const remaining = remainingOf(item)
              const checked = Boolean(selection[item.id]) && remaining > 0
              return (
                <tr key={item.id} className={remaining === 0 ? styles.returned : checked ? styles.selected : undefined}>
                  {canReturn && (
                    <td className={styles.check}>
                      {remaining > 0 && (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggle(item, e.target.checked)}
                          aria-label={`${item.productName}を返品する`}
                        />
                      )}
                    </td>
                  )}
                  <td>
                    <b className={styles.name}>{item.productName}</b>
                    <span className={styles.variant}>
                      {item.color} / {sizeLabel(item.size)}
                      {item.categoryName && `・${item.categoryName}`}
                    </span>
                    {/* スマホでは単価と数量の列を省き、ここにまとめて出す */}
                    <span className={`num ${styles.variant} ${styles.narrow}`}>
                      {formatYen(item.unitPriceIncl)} × {item.qty}
                    </span>
                    {item.returnedQty > 0 && (
                      <span className="badge badge-bad">
                        {item.returnedQty === item.qty ? '返品済み' : `${item.returnedQty}点返品済み`}
                      </span>
                    )}
                    {checked && remaining > 1 && (
                      <span className={styles.qtyPicker}>
                        返品する数
                        <button type="button" onClick={() => changeQty(item, -1)} aria-label="返品する数を減らす">
                          −
                        </button>
                        <span className="num">{selection[item.id]}</span>
                        <button type="button" onClick={() => changeQty(item, 1)} aria-label="返品する数を増やす">
                          ＋
                        </button>
                        <small>(最大 {remaining})</small>
                      </span>
                    )}
                  </td>
                  <td className={`num ${styles.r} ${styles.wide}`}>{formatYen(item.unitPriceIncl)}</td>
                  <td className={`num ${styles.r} ${styles.wide}`}>{item.qty}</td>
                  <td className={`num ${styles.r} ${styles.amount}`}>{formatYen(item.lineTotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dl className={styles.sum}>
        <dt>合計(税込)</dt>
        <dd className={`num ${styles.big}`}>{formatYen(sale.totalIncl)}</dd>
        <dt>税抜</dt>
        <dd className="num">{formatYen(sale.totalExcl)}</dd>
        <dt>うち消費税</dt>
        <dd className="num">{formatYen(sale.taxAmount)}</dd>
        <dt>支払い方法</dt>
        <dd>{PAYMENT_LABELS[method]}</dd>
        {/* お預かりとお釣りは現金のときだけ */}
        {isCash && (
          <>
            <dt>お預かり</dt>
            <dd className="num">{formatYen(sale.received)}</dd>
            <dt>お釣り</dt>
            <dd className="num">{formatYen(sale.change)}</dd>
          </>
        )}
      </dl>

      {sale.refunds.length > 0 && (
        <ul className={styles.refunds}>
          {sale.refunds.map((r) => (
            <li key={r.id}>
              <span>
                返金(
                {r.businessDate === sale.businessDate ? '' : `${formatBusinessDate(r.businessDate)} `}
                {timeOf(r.refundedAt)})
                {r.memo && <small className={styles.memo}>{r.memo}</small>}
              </span>
              <span className="num">−{formatYen(r.amountIncl)}</span>
            </li>
          ))}
        </ul>
      )}

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {canReturn &&
        (confirming && selected.length > 0 ? (
          <div className={styles.confirm}>
            <p>
              返金額 <b className={`num ${styles.refundAmount}`}>{formatYen(refundAmount)}</b>
              (うち消費税 {formatYen(refundTax)})
              {isCash
                ? 'をお客様に現金でお返しし、在庫を戻します。'
                : `の返金を記録し、在庫を戻します。実際の返金は Square のアプリで${PAYMENT_LABELS[method]}の返金をしてください。`}
            </p>
            <label className={styles.memoField}>
              メモ(任意)
              <input
                className="input"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例:サイズ違いのため"
              />
            </label>
            <div className={styles.actions}>
              <button type="button" className="btn btn-danger" onClick={() => void confirmRefund()} disabled={saving}>
                {saving ? '保存しています…' : '返品を確定'}
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={saving}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.returnBar}>
            {selected.length === 0 && <p className="hint">返品する商品にチェックを入れてください。</p>}
            <button type="button" className="btn" disabled={selected.length === 0} onClick={() => setConfirming(true)}>
              選択した商品を返品する{selected.length > 0 && `(${formatYen(refundAmount)})`}
            </button>
          </div>
        ))}
    </div>
  )
}
