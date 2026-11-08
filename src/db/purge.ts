// 古いデータの削除(仕様書 §5 F8)。自動では削除せず、オーナーが操作したときだけ消す。

import { businessDateOf } from '../lib/time'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import { getSetting, setSetting } from './settings'

/** 今月のほかに残す月の数 */
export const RETENTION_MONTHS = 3

/** 'YYYY-MM' を months か月ずらす */
export function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 残しておく最初の月。これより前の月を削除できる。10月24日なら '2026-07' */
export function firstKeptMonth(today = businessDateOf()): string {
  return shiftMonth(today.slice(0, 7), -RETENTION_MONTHS)
}

export type PurgeCandidate = {
  /** 'YYYY-MM' */
  month: string
  sales: number
  refunds: number
  closings: number
  /** Excel を出力済みか。出力していない月は削除できない */
  exported: boolean
  /** 最後のバックアップに含まれている月か */
  backedUp: boolean
}

/** 削除できる月(データが残っている月だけ)を古い順に返す */
export async function listPurgeCandidates(db: AppDB, today = businessDateOf()): Promise<PurgeCandidate[]> {
  const before = `${firstKeptMonth(today)}-01`
  const [sales, refunds, closings, exportedMonths, lastBackupAt] = await Promise.all([
    db.sales.where('businessDate').below(before).toArray(),
    db.refunds.where('businessDate').below(before).toArray(),
    db.closings.where('businessDate').below(before).toArray(),
    getSetting(db, 'exportedMonths'),
    getSetting(db, 'lastBackupAt'),
  ])
  const byMonth = new Map<string, PurgeCandidate>()
  const row = (businessDate: string) => {
    const month = businessDate.slice(0, 7)
    let c = byMonth.get(month)
    if (!c) {
      c = {
        month,
        sales: 0,
        refunds: 0,
        closings: 0,
        exported: exportedMonths.includes(month),
        // 月が終わったあとにバックアップしていれば、その月のデータは全部入っている
        backedUp: Boolean(lastBackupAt && lastBackupAt.slice(0, 7) > month),
      }
      byMonth.set(month, c)
    }
    return c
  }
  for (const s of sales) row(s.businessDate).sales += 1
  for (const r of refunds) row(r.businessDate).refunds += 1
  for (const c of closings) row(c.businessDate).closings += 1
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * 選んだ月の会計、会計の明細、返品、返品の明細、レジ締めを削除する。1つのトランザクションで行う。
 * 商品、在庫、カテゴリー、設定は残す。削除した月は purgedMonths に記録する。
 */
export async function purgeMonths(db: AppDB, months: string[], today = businessDateOf()): Promise<void> {
  if (months.length === 0) throw new ValidationError('削除する月を選んでください。')
  const kept = firstKeptMonth(today)
  await db.transaction('rw', [db.sales, db.saleItems, db.refunds, db.refundItems, db.closings, db.settings], async () => {
    const exported = await getSetting(db, 'exportedMonths')
    for (const month of months) {
      if (!/^\d{4}-\d{2}$/.test(month) || month >= kept) {
        throw new ValidationError(`${month} はまだ保存期間中のため削除できません。`)
      }
      if (!exported.includes(month)) {
        throw new ValidationError(`${month} は Excel を出力していないため削除できません。先に帳簿から出力してください。`)
      }
    }
    for (const month of months) {
      const [start, end] = [`${month}-01`, `${month}-31`]
      const saleIds = await db.sales.where('businessDate').between(start, end, true, true).primaryKeys()
      const refundIds = await db.refunds.where('businessDate').between(start, end, true, true).primaryKeys()
      if (saleIds.length) await db.saleItems.where('saleId').anyOf(saleIds).delete()
      if (refundIds.length) await db.refundItems.where('refundId').anyOf(refundIds).delete()
      await db.sales.bulkDelete(saleIds)
      await db.refunds.bulkDelete(refundIds)
      await db.closings.where('businessDate').between(start, end, true, true).delete()
    }
    const purged = await getSetting(db, 'purgedMonths')
    await setSetting(db, 'purgedMonths', [...new Set([...purged, ...months])].sort())
  })
}
