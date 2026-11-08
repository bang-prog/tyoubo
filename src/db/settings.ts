// 設定(settings テーブル)。1つの設定を「キーと値」の1行で保存する。

import type { AppDB } from './db'
import { ValidationError } from './errors'

export type Settings = {
  /** 消費税率(%) */
  taxRate: number
  /** 前回のレジ締めの釣り銭準備金。次の締めで最初から入れておく */
  lastFloat: number
  /** 最後にバックアップした日時 */
  lastBackupAt: string | null
  /** Excel を出力した月('YYYY-MM') */
  exportedMonths: string[]
  /** データを削除した月('YYYY-MM') */
  purgedMonths: string[]
  pinEnabled: boolean
  pinHash: string | null
  pinSalt: string | null
  recoveryHash: string | null
}

export type SettingKey = keyof Settings

/** settings テーブルの1行。key と value の型が必ず対応するようにしている */
export type SettingRow = { [K in SettingKey]: { key: K; value: Settings[K] } }[SettingKey]

/** まだ保存していない設定の値 */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  taxRate: 10,
  lastFloat: 0,
  lastBackupAt: null,
  exportedMonths: [],
  purgedMonths: [],
  pinEnabled: false,
  pinHash: null,
  pinSalt: null,
  recoveryHash: null,
}

export async function getSetting<K extends SettingKey>(db: AppDB, key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return row ? (row.value as Settings[K]) : DEFAULT_SETTINGS[key]
}

export async function setSetting<K extends SettingKey>(db: AppDB, key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value } as SettingRow)
}

/** Excel を出力した月('YYYY-MM')を記録する。古いデータの削除で使う(仕様書 F8) */
export async function markExported(db: AppDB, months: string[]): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSetting(db, 'exportedMonths')
    await setSetting(db, 'exportedMonths', [...new Set([...current, ...months])].sort())
  })
}

/** 税率(%)を変える。0〜30 の整数だけ受け付ける */
export async function setTaxRate(db: AppDB, rate: number): Promise<void> {
  if (!Number.isInteger(rate) || rate < 0 || rate > 30) {
    throw new ValidationError('税率は 0〜30 の整数で入力してください。')
  }
  await setSetting(db, 'taxRate', rate)
}
