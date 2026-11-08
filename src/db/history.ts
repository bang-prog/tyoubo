// 会計履歴の読み込み(仕様書 §5 F3)。

import { paymentMethodOf } from '../lib/payment'
import type { AppDB } from './db'
import type { Refund, Sale, SaleItem } from './types'

export type SaleDetail = Sale & {
  /** カートに入れた順 */
  items: SaleItem[]
  /** この会計に対する返品(返品した日の順) */
  refunds: Refund[]
}

export type DayHistory = {
  businessDate: string
  /** 時刻の新しい順 */
  sales: SaleDetail[]
  /** その日の売上(税込)。現金とキャッシュレスの合計 */
  salesTotal: number
  /** そのうち現金の売上 */
  cashTotal: number
  /** その日に行った返品の返金額。元の会計の日ではなく、返品した日で数える */
  refundsTotal: number
}

/** 1日分の会計を、明細と返品の記録と合わせて読み込む。 */
export async function loadDayHistory(db: AppDB, businessDate: string): Promise<DayHistory> {
  const sales = await db.sales.where('businessDate').equals(businessDate).toArray()
  const ids = sales.map((s) => s.id)
  const [items, saleRefunds, dayRefunds] = await Promise.all([
    ids.length ? db.saleItems.where('saleId').anyOf(ids).toArray() : [],
    ids.length ? db.refunds.where('saleId').anyOf(ids).toArray() : [],
    db.refunds.where('businessDate').equals(businessDate).toArray(),
  ])

  const itemsBySale = groupBy(items, (i) => i.saleId)
  const refundsBySale = groupBy(saleRefunds, (r) => r.saleId)

  const details = sales
    .map(
      (s): SaleDetail => ({
        ...s,
        items: (itemsBySale.get(s.id) ?? []).sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0)),
        refunds: (refundsBySale.get(s.id) ?? []).sort((a, b) => a.refundedAt.localeCompare(b.refundedAt)),
      }),
    )
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt) || b.saleNo.localeCompare(a.saleNo))

  return {
    businessDate,
    sales: details,
    salesTotal: sales.reduce((sum, s) => sum + s.totalIncl, 0),
    cashTotal: sales.filter((s) => paymentMethodOf(s) === 'cash').reduce((sum, s) => sum + s.totalIncl, 0),
    refundsTotal: dayRefunds.reduce((sum, r) => sum + r.amountIncl, 0),
  }
}

function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const k = key(item)
    const group = map.get(k)
    if (group) group.push(item)
    else map.set(k, [item])
  }
  return map
}
