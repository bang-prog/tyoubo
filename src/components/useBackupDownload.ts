import { useState } from 'react'
import { db } from '../db/db'
import { userMessage } from '../db/errors'
import { downloadBackup } from '../lib/backupDownload'

/** 保存先の案内(仕様書 §5 F7) */
export const BACKUP_DESTINATION_HINT =
  'iPhone では保存先を選ぶ画面が出ます。「"ファイル"に保存」を選び、iCloud Drive などに保存してください。PC ではダウンロードフォルダに保存されます。'

/** 「バックアップを保存」ボタンの処理。会計画面・レジ締め・設定・古いデータの削除で使う */
export function useBackupDownload() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const fileName = await downloadBackup(db)
      setMessage(`${fileName} を保存しました。`)
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return { busy, message, error, run }
}
