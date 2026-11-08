import { useState } from 'react'
import { restoreBackup, summarize, type BackupFile } from '../../db/backup'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import { formatDateTime } from '../../lib/time'
import Modal from '../Modal'
import styles from './RestoreDialog.module.css'

type Props = {
  file: BackupFile
  fileName: string
  onClose: () => void
  onDone: () => void
}

/**
 * バックアップの読み込みの確認(仕様書 §5 F7)。
 * ファイルの書き出し日時と件数を見せ、今のデータが置き換わることを確かめてから実行する。
 */
export default function RestoreDialog({ file, fileName, onClose, onDone }: Props) {
  const summary = summarize(file)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await restoreBackup(db, file)
      onDone()
    } catch (e) {
      setError(userMessage(e))
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy="restore-title" onClose={() => !busy && onClose()} maxWidth={460}>
      <div className={styles.body}>
        <h2 id="restore-title" className={styles.title}>
          バックアップを読み込む
        </h2>
        <p className={styles.file}>{fileName}</p>
        <dl className={styles.summary}>
          <div>
            <dt>書き出した日時</dt>
            <dd className="num">{formatDateTime(summary.exportedAt)}</dd>
          </div>
          <div>
            <dt>商品</dt>
            <dd className="num">{summary.products}件</dd>
          </div>
          <div>
            <dt>会計</dt>
            <dd className="num">{summary.sales}件</dd>
          </div>
          <div>
            <dt>返品</dt>
            <dd className="num">{summary.refunds}件</dd>
          </div>
          <div>
            <dt>レジ締め</dt>
            <dd className="num">{summary.closings}件</dd>
          </div>
        </dl>
        <p className={styles.warning}>
          今のデータはすべて置き換わります。このファイルより後の会計は消えます。暗証番号の設定はこの端末のものが残ります。
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            やめる
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void run()} disabled={busy}>
            {busy ? '読み込んでいます…' : '置き換えて読み込む'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
