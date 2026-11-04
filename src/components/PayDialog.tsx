import { useReducer, type KeyboardEvent } from 'react'
import { CASH_KEYS, cashInputReducer, isCashKey, toAmount } from '../lib/cashInput'
import { calcChange, formatYen } from '../lib/money'
import Modal from './Modal'
import styles from './PayDialog.module.css'

const BILLS = [1000, 5000, 10000] as const

type Props = {
  /** お会計(税込) */
  total: number
  /** 保存している間は確定できないようにする(二重に保存しないため) */
  busy?: boolean
  /** 保存できなかったときのエラー */
  error?: string | null
  onCancel: () => void
  onConfirm: (result: { received: number; change: number }) => void
}

/** 電卓画面。お預かりを入力し、お釣りを表示する(仕様書 §5 F2)。 */
export default function PayDialog({ total, busy = false, error = null, onCancel, onConfirm }: Props) {
  const [input, dispatch] = useReducer(cashInputReducer, '')

  const entered = input !== ''
  const received = toAmount(input)
  const result = calcChange(received, total)

  function confirm() {
    if (!busy && entered && result.ok) onConfirm({ received, change: result.change })
  }

  // PC のキーボード操作:数字キーで入力、Backspace で1文字消す、Enter で確定(Esc は Modal が受け取る)
  function handleKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (isCashKey(e.key)) {
      e.preventDefault()
      dispatch({ type: 'press', key: e.key })
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      dispatch({ type: 'backspace' })
    } else if (e.key === 'Enter') {
      // フォーカスしているボタンが Enter で押されないように止める
      e.preventDefault()
      confirm()
    }
  }

  let statusClass = styles.idle
  let statusLabel = 'お釣り'
  let statusAmount = '—'
  if (entered && result.ok) {
    statusClass = styles.ok
    statusAmount = formatYen(result.change)
  } else if (entered && !result.ok) {
    statusClass = styles.short
    statusLabel = '不足'
    statusAmount = formatYen(result.shortage)
  }

  return (
    <Modal labelledBy="pay-title" onClose={onCancel} onKeyDown={handleKeyDown} maxWidth={1000}>
      <div className={styles.layout}>
        <div className={styles.display}>
          <h2 id="pay-title" className={styles.title}>
            お預かり金額の入力
          </h2>

          <div className={styles.row}>
            <span className={styles.label}>
              お会計
              <small>(税込)</small>
            </span>
            <span className={`num ${styles.amount}`}>{formatYen(total)}</span>
          </div>

          <div className={`${styles.row} ${styles.received}`}>
            <span className={styles.label}>お預かり</span>
            <span className={`num ${styles.amount} ${styles.big}`} aria-live="polite">
              {formatYen(received)}
            </span>
          </div>

          <div className={`${styles.row} ${statusClass}`}>
            <span className={styles.label}>{statusLabel}</span>
            <span className={`num ${styles.amount} ${styles.big}`} aria-live="polite">
              {statusAmount}
            </span>
          </div>

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <p className={styles.note}>PC ではキーボードの数字キーでも入力できます(Enter で確定、Esc で戻る)。</p>
          )}
        </div>

        <div className={styles.pad}>
          <div className={styles.quick}>
            <button type="button" className={styles.quickKey} onClick={() => dispatch({ type: 'set', amount: total })}>
              ちょうど
            </button>
            {BILLS.map((bill) => (
              <button
                key={bill}
                type="button"
                className={styles.quickKey}
                onClick={() => dispatch({ type: 'add', amount: bill })}
              >
                ＋{bill.toLocaleString('ja-JP')}
              </button>
            ))}
          </div>
          <div className={styles.keys}>
            {CASH_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`num ${styles.key}`}
                onClick={() => dispatch({ type: 'press', key })}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.key} ${styles.fnKey}`}
              onClick={() => dispatch({ type: 'backspace' })}
              aria-label="1文字消す"
            >
              ⌫
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.footerButton} onClick={onCancel}>
            戻る
          </button>
          <button type="button" className={styles.footerButton} onClick={() => dispatch({ type: 'clear' })}>
            クリア
          </button>
          <button
            type="button"
            className={`${styles.footerButton} ${styles.confirm}`}
            onClick={confirm}
            disabled={busy || !entered || !result.ok}
          >
            {busy ? '保存しています…' : '会計を確定'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
