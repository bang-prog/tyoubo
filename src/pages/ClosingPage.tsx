import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import ClosingForm from '../components/closing/ClosingForm'
import { loadClosingDay } from '../db/closings'
import { db } from '../db/db'
import { businessDateOf, formatBusinessDate } from '../lib/time'
import styles from './ClosingPage.module.css'

/** レジ締め(仕様書 §5 F4)。今日の締めを行う。 */
export default function ClosingPage() {
  const today = businessDateOf()
  // 売上や返金が増えると、レジにあるはずの現金も自動で変わる
  const day = useLiveQuery(() => loadClosingDay(db, today), [today])
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>{formatBusinessDate(today)} のレジ締め</h2>
      {!day ? (
        <p className="hint">読み込み中…</p>
      ) : (
        // 入力欄は、読み込んだ値(保存済みの締め、または前回の準備金)で始める
        <ClosingForm key={day.businessDate} day={day} notice={notice} onSaved={() => setNotice('レジ締めを保存しました')} />
      )}
    </section>
  )
}
