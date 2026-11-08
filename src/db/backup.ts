// バックアップと復元(仕様書 §5 F7)。

import { businessDateOf, nowIso } from '../lib/time'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import { DEFAULT_SETTINGS, getSetting, setSetting, type SettingKey, type SettingRow } from './settings'

export const BACKUP_APP = 'tyoubo'
/** データ形式のバージョン。テーブルの形を変えたら上げ、古い形を変換する処理を書く */
export const BACKUP_FORMAT = 1

/** バックアップに入れるテーブル(settings 以外) */
const DATA_TABLES = ['categories', 'products', 'variants', 'sales', 'saleItems', 'refunds', 'refundItems', 'closings'] as const
type DataTable = (typeof DATA_TABLES)[number]

/** 各テーブルの主キー。読み込むときに形を確かめる */
const PRIMARY_KEY: Record<DataTable | 'settings', string> = {
  categories: 'id',
  products: 'id',
  variants: 'id',
  sales: 'id',
  saleItems: 'id',
  refunds: 'id',
  refundItems: 'id',
  closings: 'businessDate',
  settings: 'key',
}

/** バックアップに入れない設定。PIN はこの端末だけのものとして扱う */
const DEVICE_ONLY_KEYS: readonly SettingKey[] = ['pinEnabled', 'pinHash', 'pinSalt', 'recoveryHash']

type Tables = { [T in DataTable]: unknown[] } & { settings: SettingRow[] }

export type BackupFile = {
  app: typeof BACKUP_APP
  format: number
  exportedAt: string
  tables: Tables
}

export type BackupSummary = {
  exportedAt: string
  products: number
  sales: number
  refunds: number
  closings: number
}

/** 全データを1つのファイルの中身にする。PIN と復旧コードのハッシュは入れない */
export async function createBackup(db: AppDB, now = new Date()): Promise<BackupFile> {
  const exportedAt = nowIso(now)
  return db.transaction('r', [...DATA_TABLES.map((t) => db.table(t)), db.settings], async () => {
    const tables = {} as Tables
    for (const t of DATA_TABLES) tables[t] = await db.table(t).toArray()
    const settings = (await db.settings.toArray()).filter((row) => !DEVICE_ONLY_KEYS.includes(row.key))
    // 復元したデータは、このファイルを書き出した時点でバックアップ済み
    tables.settings = [...settings.filter((row) => row.key !== 'lastBackupAt'), { key: 'lastBackupAt', value: exportedAt }]
    return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt, tables }
  })
}

/** 'レジ帳簿_バックアップ_2026-10-24.json' */
export function backupFileName(now = new Date()): string {
  return `レジ帳簿_バックアップ_${businessDateOf(now)}.json`
}

/** 書き出した日時を記録する(設定画面と、会計画面の注意に使う) */
export async function markBackedUp(db: AppDB, at: string): Promise<void> {
  await setSetting(db, 'lastBackupAt', at)
}

export function summarize(file: BackupFile): BackupSummary {
  return {
    exportedAt: file.exportedAt,
    products: file.tables.products.filter((p) => (p as { isActive?: boolean }).isActive !== false).length,
    sales: file.tables.sales.length,
    refunds: file.tables.refunds.length,
    closings: file.tables.closings.length,
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** ファイルの中身を読み、このアプリのバックアップか確かめる。合わないときは ValidationError */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ValidationError('このファイルは読み込めません。レジ帳簿のバックアップファイルを選んでください。')
  }
  if (!isObject(data) || data.app !== BACKUP_APP) {
    throw new ValidationError('レジ帳簿のバックアップファイルではありません。')
  }
  if (typeof data.format !== 'number' || data.format > BACKUP_FORMAT) {
    throw new ValidationError('このアプリより新しい形式のファイルです。アプリを最新にしてから読み込んでください。')
  }
  if (data.format !== BACKUP_FORMAT || typeof data.exportedAt !== 'string' || !isObject(data.tables)) {
    throw new ValidationError('バックアップファイルの形式が正しくありません。')
  }
  const tables = data.tables
  for (const [table, key] of Object.entries(PRIMARY_KEY)) {
    const rows = tables[table]
    if (!Array.isArray(rows) || !rows.every((row) => isObject(row) && typeof row[key] === 'string')) {
      throw new ValidationError('バックアップファイルの中身が壊れています。')
    }
  }
  return data as BackupFile
}

/**
 * 今のデータをすべて消して、バックアップの中身に置き換える。1つのトランザクションで行い、
 * 途中で失敗したら元のデータのまま残る。PIN の設定はこの端末のものを残す。
 */
export async function restoreBackup(db: AppDB, file: BackupFile): Promise<void> {
  const settings = file.tables.settings.filter((row) => row.key in DEFAULT_SETTINGS && !DEVICE_ONLY_KEYS.includes(row.key))
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.settings], async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear()
      await db.table(t).bulkAdd(file.tables[t])
    }
    const keep = (await db.settings.toArray()).filter((row) => DEVICE_ONLY_KEYS.includes(row.key))
    await db.settings.clear()
    await db.settings.bulkAdd([...keep, ...settings])
  })
}

/** バックアップを促すまでの日数 */
export const BACKUP_REMIND_DAYS = 7

/**
 * 会計画面に「バックアップを保存してください」と出すか。
 * 最後のバックアップから7日以上たったとき。まだ一度もしていなければ、会計が1件でもあれば出す。
 */
export function isBackupDue(lastBackupAt: string | null, hasSales: boolean, now = new Date()): boolean {
  if (!lastBackupAt) return hasSales
  return now.getTime() - new Date(lastBackupAt).getTime() >= BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000
}

/**
 * 会計画面の注意に使う。設定やデータが変わると自動で読み直す。
 * 注意が要らなければ null、一度もバックアップしていなければ 'never'、7日以上たっていれば 'old'
 */
export async function loadBackupDue(db: AppDB, now = new Date()): Promise<'never' | 'old' | null> {
  const [lastBackupAt, salesCount] = await Promise.all([getSetting(db, 'lastBackupAt'), db.sales.count()])
  if (!isBackupDue(lastBackupAt, salesCount > 0, now)) return null
  return lastBackupAt ? 'old' : 'never'
}
