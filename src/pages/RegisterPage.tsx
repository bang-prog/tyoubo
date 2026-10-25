import { useState } from 'react'
import ChangeDialog from '../components/ChangeDialog'
import PayDialog from '../components/PayDialog'
import { formatYen, MAX_RECEIVED, splitTax } from '../lib/money'
import styles from './RegisterPage.module.css'

type Done = { total: number; received: number; change: number }

// 商品とカートができるまでは、合計金額を手で入れて電卓画面を試せるようにしておく。
// 会計はまだ保存しない(ステップ7で保存する)。
export default function RegisterPage() {
  const [totalText, setTotalText] = useState('6980')
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState<Done | null>(null)

  const total = Number(totalText)
  const valid = totalText !== '' && total > 0 && total <= MAX_RECEIVED
  const breakdown = valid ? splitTax(total) : null

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>会計</h2>

      <div className={styles.panel}>
        <p className={styles.notice}>
          お試し用の画面です。商品とカートができたら、ここはカートの合計に置き換わります。会計はまだ保存されません。
        </p>

        <label className={styles.field}>
          <span>お会計の合計(税込)</span>
          <span className={styles.yenInput}>
            <span aria-hidden="true">¥</span>
            <input
              className="num"
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={totalText}
              onChange={(e) => setTotalText(e.target.value.replace(/\D/g, ''))}
            />
          </span>
        </label>

        {breakdown && (
          <p className={`num ${styles.breakdown}`}>
            税抜 {formatYen(breakdown.excl)} / うち消費税(10%){formatYen(breakdown.tax)}
          </p>
        )}

        <button type="button" className={styles.payButton} disabled={!valid} onClick={() => setPaying(true)}>
          お預かり金額を入力
        </button>
      </div>

      {paying && (
        <PayDialog
          total={total}
          onCancel={() => setPaying(false)}
          onConfirm={({ received, change }) => {
            setPaying(false)
            setDone({ total, received, change })
          }}
        />
      )}

      {done && <ChangeDialog {...done} onNext={() => setDone(null)} />}
    </section>
  )
}
