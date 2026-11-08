import { useState, type ReactNode } from 'react'
import { saveClosing, type ClosingDay } from '../../db/closings'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import type { DenominationCounts } from '../../db/types'
import { countedTotal, DENOMINATIONS, differenceOf, expectedCash, MAX_COUNT, type DenominationKey } from '../../lib/closing'
import { formatYen } from '../../lib/money'
import { timeOf } from '../../lib/time'
import styles from './ClosingForm.module.css'

type Props = {
  day: ClosingDay
  notice: string | null
  onSaved: () => void
  /** 保存ボタンの下に出すもの(保存したあとのバックアップの案内) */
  afterSave?: ReactNode
}

const STATUS_LABEL = { even: '過不足なし', over: '現金が多い(過剰)', short: '現金が足りない(不足)' } as const

const toInt = (text: string) => (text === '' ? 0 : Number(text))

/** レジ締めの入力欄と、過不足の表示。 */
export default function ClosingForm({ day, notice, onSaved, afterSave }: Props) {
  const saved = day.saved
  // 入力中の値は文字列で持つ(空欄を0と区別するため)
  const [floatText, setFloatText] = useState(String(saved?.openingFloat ?? day.defaultFloat))
  const [counts, setCounts] = useState<Record<DenominationKey, string>>(
    () =>
      Object.fromEntries(DENOMINATIONS.map((d) => [d.key, saved?.counts[d.key] ? String(saved.counts[d.key]) : ''])) as Record<
        DenominationKey,
        string
      >,
  )
  const [memo, setMemo] = useState(saved?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numericCounts: DenominationCounts = Object.fromEntries(DENOMINATIONS.map((d) => [d.key, toInt(counts[d.key])]))
  const openingFloat = toInt(floatText)
  const expected = expectedCash({ openingFloat, cashSales: day.cashSales, refundsTotal: day.refundsTotal })
  const counted = countedTotal(numericCounts)
  const { difference, status } = differenceOf(counted, expected)
  // まだ1枚も数えていないときは、過不足を出さない(「不足」と大きく出て驚かないように)
  const started = Boolean(saved) || DENOMINATIONS.some((d) => counts[d.key] !== '')

  function setCount(key: DenominationKey, text: string) {
    const digits = text.replace(/\D/g, '').slice(0, String(MAX_COUNT).length)
    setCounts((prev) => ({ ...prev, [key]: digits }))
    setError(null)
  }

  function step(key: DenominationKey, delta: number) {
    const next = Math.min(MAX_COUNT, Math.max(0, toInt(counts[key]) + delta))
    setCount(key, String(next))
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await saveClosing(db, { businessDate: day.businessDate, openingFloat, counts: numericCounts, memo })
      onSaved()
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.grid}>
      <div className={styles.left}>
        <div className="panel">
          <h3 className={styles.heading}>開店時の釣り銭準備金</h3>
          <label className={styles.yenField}>
            <span aria-hidden="true">¥</span>
            <input
              className="input num"
              inputMode="numeric"
              value={floatText}
              onChange={(e) => {
                setFloatText(e.target.value.replace(/\D/g, '').slice(0, 7))
                setError(null)
              }}
              aria-label="釣り銭準備金"
            />
          </label>
          <p className="hint">朝、レジに入れたお釣り用の現金です。前回のレジ締めの金額を最初から入れています。</p>
        </div>

        <div className="panel">
          <h3 className={styles.heading}>閉店時に数えた現金</h3>
          <p className="hint">お札・硬貨ごとの枚数を入れると、合計が自動で出ます。</p>
          <div className={styles.tableWrap}>
            <table className={styles.denoms}>
              <tbody>
                {DENOMINATIONS.map((d) => (
                  <tr key={d.key}>
                    <th scope="row">{d.label}</th>
                    <td>
                      <div className={styles.stepper}>
                        <button type="button" onClick={() => step(d.key, -1)} aria-label={`${d.label}を1枚減らす`}>
                          −
                        </button>
                        <input
                          className="num"
                          inputMode="numeric"
                          value={counts[d.key]}
                          placeholder="0"
                          onChange={(e) => setCount(d.key, e.target.value)}
                          aria-label={`${d.label}の枚数`}
                        />
                        <button type="button" onClick={() => step(d.key, 1)} aria-label={`${d.label}を1枚増やす`}>
                          ＋
                        </button>
                      </div>
                    </td>
                    <td className={`num ${styles.subtotal}`}>{formatYen(d.value * toInt(counts[d.key]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.countedTotal}>
            <span>数えた現金の合計</span>
            <span className="num">{formatYen(counted)}</span>
          </div>
        </div>
      </div>

      <div className={`panel ${styles.summary}`}>
        <h3 className={styles.heading}>過不足</h3>
        <dl className={styles.equation}>
          <dt>釣り銭準備金</dt>
          <dd className="num">{formatYen(openingFloat)}</dd>
          <dt>
            <span className={styles.op}>＋</span>今日の現金売上
          </dt>
          <dd className="num">{formatYen(day.cashSales)}</dd>
          <dt>
            <span className={styles.op}>−</span>今日の返金
          </dt>
          <dd className="num">{formatYen(day.refundsTotal)}</dd>
          <dt className={styles.strong}>
            <span className={styles.op}>＝</span>レジにあるはずの現金
          </dt>
          <dd className={`num ${styles.strong}`}>{formatYen(expected)}</dd>
          <dt className={styles.strong}>数えた現金</dt>
          <dd className={`num ${styles.strong}`}>{formatYen(counted)}</dd>
        </dl>

        {started ? (
          <div className={`${styles.diff} ${styles[status]}`} role="status">
            <span className={styles.diffLabel}>{STATUS_LABEL[status]}</span>
            <span className={`num ${styles.diffValue}`}>
              {difference === 0 ? '±¥0' : `${difference > 0 ? '+' : '−'}${formatYen(Math.abs(difference))}`}
            </span>
          </div>
        ) : (
          <p className={styles.waiting}>数えた現金を左の表に入れると、過不足が出ます。</p>
        )}

        <label className={styles.memo}>
          メモ(過不足の理由など)
          <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例:両替で千円札を補充" />
        </label>

        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}

        <button type="button" className={`btn btn-primary ${styles.save}`} onClick={() => void handleSave()} disabled={saving}>
          {saving ? '保存しています…' : saved ? 'レジ締めを保存し直す' : 'レジ締めを保存'}
        </button>
        {saved && (
          <p className="hint">
            {timeOf(saved.closedAt)} に保存済みです。保存し直すと上書きされます。
            {saved.cashSales !== day.cashSales || saved.refundsTotal !== day.refundsTotal
              ? ' 保存したあとに会計か返品がありました。'
              : ''}
          </p>
        )}
        {afterSave}
      </div>
    </div>
  )
}
