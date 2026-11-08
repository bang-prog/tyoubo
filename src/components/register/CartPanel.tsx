import type { CartItemView } from '../../lib/cart'
import { sizeLabel } from '../../lib/labels'
import { formatYen, splitTax } from '../../lib/money'
import { PAYMENT_LABELS, PAYMENT_METHODS, PAYMENT_SHORT_LABELS, type PaymentMethod } from '../../lib/payment'
import styles from './CartPanel.module.css'

type Props = {
  items: CartItemView[]
  total: number
  onIncrement: (item: CartItemView) => void
  onDecrement: (item: CartItemView) => void
  onClear: () => void
  onPay: () => void
  /** 選んでいる支払い方法(仕様書 §5 F2) */
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  /** 消費税率(%)。読み込み中は undefined */
  taxRate?: number
  /** スマホで下から開いたカートを閉じる(PC・iPad では「閉じる」は出ない) */
  onClose?: () => void
}

/** 会計画面の右側(スマホでは下から開く)。カートの中身と合計、支払い方法、会計に進むボタン。 */
export default function CartPanel({
  items,
  total,
  onIncrement,
  onDecrement,
  onClear,
  onPay,
  paymentMethod,
  onPaymentMethodChange,
  taxRate,
  onClose,
}: Props) {
  const { tax, excl } = splitTax(total, taxRate)
  const count = items.reduce((sum, i) => sum + i.qty, 0)
  const hasUnavailable = items.some((i) => !i.available)

  return (
    <aside className={styles.cart} aria-label="お会計">
      <div className={styles.head}>
        <h2 className={styles.title}>お会計</h2>
        <div className={styles.headButtons}>
          <button type="button" className="btn btn-sm" onClick={onClear} disabled={items.length === 0}>
            すべて取り消す
          </button>
          {onClose && (
            <button type="button" className={`btn btn-sm ${styles.close}`} onClick={onClose}>
              閉じる
            </button>
          )}
        </div>
      </div>

      <ul className={styles.list}>
        {items.length === 0 ? (
          <li className={styles.empty}>
            商品をタップすると
            <br />
            ここに追加されます
          </li>
        ) : (
          items.map((item) => (
            <li key={item.variantId} className={item.available ? styles.line : `${styles.line} ${styles.unavailable}`}>
              <div className={styles.info}>
                <b>{item.productName}</b>
                {item.available ? (
                  <span>
                    {item.color} / {sizeLabel(item.size)}・{formatYen(item.unitPriceIncl)}
                  </span>
                ) : (
                  <span>カートから外してください</span>
                )}
              </div>
              <div className={`num ${styles.amount}`}>{formatYen(item.lineTotal)}</div>
              <div className={styles.qty}>
                <button type="button" onClick={() => onDecrement(item)} aria-label={`${item.productName}を1つ減らす`}>
                  −
                </button>
                <span className="num">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => onIncrement(item)}
                  disabled={!item.available}
                  aria-label={`${item.productName}を1つ増やす`}
                >
                  ＋
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className={styles.sum}>
        <div className={styles.row}>
          <span>点数</span>
          <span className="num">{count}点</span>
        </div>
        <div className={styles.row}>
          <span>税抜</span>
          <span className="num">{formatYen(excl)}</span>
        </div>
        <div className={styles.row}>
          <span>うち消費税({taxRate ?? '…'}%)</span>
          <span className="num">{formatYen(tax)}</span>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <span>合計(税込)</span>
          <span className="num">{formatYen(total)}</span>
        </div>
      </div>

      {hasUnavailable && <p className="error">削除された商品がカートに入っています。「−」で外してください。</p>}

      {/* 支払い方法。キャッシュレスの決済は Square のアプリで行い、ここでは記録だけをする */}
      <div className={styles.methods} role="group" aria-label="支払い方法">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={paymentMethod === m}
            aria-label={PAYMENT_LABELS[m]}
            onClick={() => onPaymentMethodChange(m)}
          >
            {PAYMENT_SHORT_LABELS[m]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`btn btn-primary ${styles.pay}`}
        onClick={onPay}
        disabled={items.length === 0 || hasUnavailable}
      >
        {paymentMethod === 'cash' ? 'お預かり金額を入力' : `${PAYMENT_LABELS[paymentMethod]}で会計`}
      </button>
    </aside>
  )
}
