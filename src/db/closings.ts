// レジ締めの読み書き(仕様書 §5 F4)。

import { countedTotal, DENOMINATIONS, differenceOf, expectedCash, MAX_COUNT } from '../lib/closing'
import { MAX_RECEIVED } from '../lib/money'
import { paymentMethodOf } from '../lib/payment'
import { nowIso } from '../lib/time'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import { getSetting, setSetting } from './settings'
import type { Closing, DenominationCounts, Refund, Sale } from './types'

export type ClosingDay = {
  businessDate: string
  /** その日の現金売上(税込) */
  cashSales: number
  /** その日に現金で返した返金額 */
  refundsTotal: number
  /** その日のキャッシュレスの売上(参考。レジの現金には含めない) */
  cashlessSales: number
  /** その日のキャッシュレスの返金(参考) */
  cashlessRefunds: number
  /** 保存済みのレジ締め */
  saved?: Closing
  /** まだ保存していないときに入れておく準備金(前回の準備金) */
  defaultFloat: number
}

async function dayTotals(db: AppDB, businessDate: string) {
  const [sales, refunds] = await Promise.all([
    db.sales.where('businessDate').equals(businessDate).toArray(),
    db.refunds.where('businessDate').equals(businessDate).toArray(),
  ])
  // レジの現金に関係するのは、現金の会計と現金の返金だけ(仕様書 §5 F4)
  const salesSum = (list: Sale[]) => list.reduce((t, s) => t + s.totalIncl, 0)
  const refundsSum = (list: Refund[]) => list.reduce((t, r) => t + r.amountIncl, 0)
  const cashSales = salesSum(sales.filter((s) => paymentMethodOf(s) === 'cash'))
  const cashRefunds = refundsSum(refunds.filter((r) => paymentMethodOf(r) === 'cash'))
  return {
    cashSales,
    refundsTotal: cashRefunds,
    cashlessSales: salesSum(sales) - cashSales,
    cashlessRefunds: refundsSum(refunds) - cashRefunds,
  }
}

/** レジ締めの画面に出す1日分の情報。 */
export async function loadClosingDay(db: AppDB, businessDate: string): Promise<ClosingDay> {
  const [totals, saved, defaultFloat] = await Promise.all([
    dayTotals(db, businessDate),
    db.closings.get(businessDate),
    getSetting(db, 'lastFloat'),
  ])
  return { businessDate, ...totals, saved, defaultFloat }
}

export type SaveClosingInput = {
  businessDate: string
  openingFloat: number
  counts: DenominationCounts
  memo: string
}

/**
 * レジ締めを保存する。同じ日にもう一度保存すると上書きする。
 * 売上と返金は保存する時点の値で計算し直して残す(あとで返品があっても、締めた時点の数字が残るように)。
 * 準備金は次の締めで最初から入れておくために、設定にも保存する。
 */
export async function saveClosing(db: AppDB, input: SaveClosingInput, at = new Date()): Promise<Closing> {
  if (!Number.isSafeInteger(input.openingFloat) || input.openingFloat < 0 || input.openingFloat > MAX_RECEIVED) {
    throw new ValidationError('釣り銭準備金は0円以上の整数で入力してください')
  }
  const counts: DenominationCounts = {}
  for (const d of DENOMINATIONS) {
    const n = input.counts[d.key] ?? 0
    if (!Number.isSafeInteger(n) || n < 0 || n > MAX_COUNT) {
      throw new ValidationError(`${d.label}の枚数は0〜${MAX_COUNT.toLocaleString('ja-JP')}枚の整数で入力してください`)
    }
    if (n > 0) counts[d.key] = n
  }

  return db.transaction('rw', [db.sales, db.refunds, db.closings, db.settings], async () => {
    const { cashSales, refundsTotal } = await dayTotals(db, input.businessDate)
    const expected = expectedCash({ openingFloat: input.openingFloat, cashSales, refundsTotal })
    const counted = countedTotal(counts)
    const closing: Closing = {
      businessDate: input.businessDate,
      openingFloat: input.openingFloat,
      cashSales,
      refundsTotal,
      expected,
      counts,
      countedTotal: counted,
      difference: differenceOf(counted, expected).difference,
      memo: input.memo.trim(),
      closedAt: nowIso(at),
    }
    await db.closings.put(closing)
    await setSetting(db, 'lastFloat', input.openingFloat)
    return closing
  })
}
