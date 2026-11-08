import { backupFileName, createBackup, markBackedUp } from '../db/backup'
import type { AppDB } from '../db/db'
import { downloadFile, JSON_MIME } from './download'

/** 全データのバックアップを端末に保存し、保存した日時を記録する。ファイル名を返す */
export async function downloadBackup(db: AppDB, now = new Date()): Promise<string> {
  const file = await createBackup(db, now)
  const fileName = backupFileName(now)
  downloadFile(JSON.stringify(file), fileName, JSON_MIME)
  await markBackedUp(db, file.exportedAt)
  return fileName
}
