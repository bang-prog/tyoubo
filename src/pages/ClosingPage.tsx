import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import ClosingForm from '../components/closing/ClosingForm'
import { BACKUP_DESTINATION_HINT, useBackupDownload } from '../components/useBackupDownload'
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
  /** 保存したら、続けてバックアップを促す(仕様書 §5 F4) */
  const [saved, setSaved] = useState(false)
  const backup = useBackupDownload()

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
        <ClosingForm
          key={day.businessDate}
          day={day}
          notice={notice}
          onSaved={() => {
            setNotice('レジ締めを保存しました')
            setSaved(true)
          }}
          afterSave={
            saved && (
              <div className={styles.backup}>
                <h3 className={styles.backupTitle}>続けてバックアップを保存しましょう</h3>
                <p className="hint">今日までのデータを1つのファイルに保存します。{BACKUP_DESTINATION_HINT}</p>
                {backup.message && <p className="notice">{backup.message}</p>}
                {backup.error && <p className="error">{backup.error}</p>}
                <button type="button" className="btn btn-primary" onClick={() => void backup.run()} disabled={backup.busy}>
                  {backup.busy ? '保存しています…' : 'バックアップを保存'}
                </button>
              </div>
            )
          }
        />
      )}
    </section>
  )
}
