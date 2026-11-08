import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import { firstKeptMonth, listPurgeCandidates, purgeMonths, type PurgeCandidate } from '../../db/purge'
import { getSetting } from '../../db/settings'
import { formatDateTime } from '../../lib/time'
import Modal from '../Modal'
import { BACKUP_DESTINATION_HINT, useBackupDownload } from '../useBackupDownload'
import styles from './PurgeDialog.module.css'

type Props = {
  today: string
  onClose: () => void
  /** 削除が終わったとき。帳簿の画面に出す文を渡す */
  onDone: (message: string) => void
}

/** '2026-06' → '2026年6月' */
const monthLabel = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5))}月`

const countText = (c: PurgeCandidate) =>
  [`会計 ${c.sales}件`, c.refunds ? `返品 ${c.refunds}件` : '', c.closings ? `レジ締め ${c.closings}件` : '']
    .filter(Boolean)
    .join('・')

/**
 * 古いデータの削除(仕様書 §5 F8)。今月と直近3か月より前の月を、オーナーが選んで削除する。
 * Excel を出力していない月は選べない。削除の前にバックアップを促し、月と件数を確かめてから実行する。
 */
export default function PurgeDialog({ today, onClose, onDone }: Props) {
  const data = useLiveQuery(async () => {
    const [candidates, lastBackupAt] = await Promise.all([listPurgeCandidates(db, today), getSetting(db, 'lastBackupAt')])
    return { candidates, lastBackupAt }
  }, [today])
  const backup = useBackupDownload()
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kept = firstKeptMonth(today)
  const chosen = data?.candidates.filter((c) => selected.includes(c.month) && c.exported) ?? []
  const needsBackup = chosen.some((c) => !c.backedUp)

  function toggle(month: string) {
    setSelected((s) => (s.includes(month) ? s.filter((m) => m !== month) : [...s, month]))
    setError(null)
  }

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await purgeMonths(
        db,
        chosen.map((c) => c.month),
        today,
      )
      onDone(`${chosen.map((c) => monthLabel(c.month)).join('、')}のデータを削除しました。`)
    } catch (e) {
      setError(userMessage(e))
      setConfirming(false)
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy="purge-title" onClose={() => !busy && onClose()} maxWidth={560}>
      <div className={styles.body}>
        <h2 id="purge-title" className={styles.title}>
          古いデータの削除
        </h2>

        <p className={styles.notice}>
          書き出した Excel がお店の正式な帳簿になります。7年間保存してください。電子データのまま保存する場合のルールは、税理士か税務署に確認してください。
        </p>

        {!data ? (
          <p className="hint">読み込み中…</p>
        ) : confirming ? (
          // ---------- 確認 ----------
          <>
            <p>次のデータを削除します。削除したデータは元に戻せません(バックアップファイルからは戻せます)。</p>
            <ul className={styles.confirmList}>
              {chosen.map((c) => (
                <li key={c.month}>
                  <strong>{monthLabel(c.month)}</strong>
                  <span className="num">{countText(c)}</span>
                </li>
              ))}
            </ul>
            <p className="hint">商品、在庫、カテゴリー、設定は削除しません。</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>
                戻る
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void run()} disabled={busy}>
                {busy ? '削除しています…' : '削除する'}
              </button>
            </div>
          </>
        ) : (
          // ---------- 月を選ぶ ----------
          <>
            <p className="hint">
              保存期間は3か月です。{monthLabel(kept)}以降のデータは残します。削除できるのは、それより前で Excel を出力済みの月です。
            </p>

            {data.candidates.length === 0 ? (
              <p className={styles.empty}>削除できる古いデータはありません。</p>
            ) : (
              <ul className={styles.list}>
                {data.candidates.map((c) => (
                  <li key={c.month}>
                    <label className={c.exported ? styles.row : `${styles.row} ${styles.disabled}`}>
                      <input
                        type="checkbox"
                        checked={c.exported && selected.includes(c.month)}
                        onChange={() => toggle(c.month)}
                        disabled={!c.exported}
                      />
                      <span className={styles.month}>{monthLabel(c.month)}</span>
                      <span className={`num ${styles.counts}`}>{countText(c)}</span>
                      <span className={styles.badges}>
                        <span className={c.exported ? 'badge badge-good' : 'badge badge-bad'}>
                          {c.exported ? 'Excel 出力済み' : 'Excel 未出力'}
                        </span>
                        <span className={c.backedUp ? 'badge badge-good' : 'badge badge-warn'}>
                          {c.backedUp ? 'バックアップ済み' : 'バックアップなし'}
                        </span>
                      </span>
                      {!c.exported && (
                        <span className={styles.rowHint}>先に帳簿の日別表示で、この月の Excel をダウンロードしてください。</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.backup}>
              <p>
                削除の前にバックアップを保存してください。最後のバックアップ:
                <strong className="num">{data.lastBackupAt ? formatDateTime(data.lastBackupAt) : 'まだありません'}</strong>
              </p>
              <p className="hint">{BACKUP_DESTINATION_HINT}</p>
              {backup.message && <p className="notice">{backup.message}</p>}
              {backup.error && <p className="error">{backup.error}</p>}
              <button type="button" className="btn btn-sm" onClick={() => void backup.run()} disabled={backup.busy}>
                {backup.busy ? '保存しています…' : 'バックアップを保存'}
              </button>
            </div>

            {needsBackup && <p className={styles.warn}>選んだ月に、まだバックアップに入っていない月があります。</p>}

            <div className={styles.actions}>
              <button type="button" className="btn" onClick={onClose}>
                閉じる
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} disabled={chosen.length === 0}>
                選んだ月を削除…
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
