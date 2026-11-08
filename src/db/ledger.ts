// 帳簿の集計(仕様書 §5 F5)。

import { PAYMENT_METHODS, paymentMethodOf, type PaymentMethod } from '../lib/payment'
import { addDays, businessDateOf } from '../lib/time'
import type { AppDB } from './db'
import type { Closing, Refund, RefundItem, Sale, SaleItem } from './types'

/**
 * - day:1か月分を日ごとの行で(period は 'YYYY-MM')
 * - month:1年分を月ごとの行で(period は 'YYYY')
 * - date:1日分だけ(period は 'YYYY-MM-DD')。日ごとの Excel 用
 */
export type LedgerMode = 'day' | 'month' | 'date'

/** 1日(日別)または1か月(月別)の集計 */
export type LedgerRow = {
  /** 'YYYY-MM-DD'(日別)または 'YYYY-MM'(月別) */
  key: string
  count: number
  salesIncl: number
  /** 会計ごとに計算した消費税の合計 */
  salesTax: number
  salesExcl: number
  refundIncl: number
  /** 返品ごとに計算した消費税の合計 */
  refundTax: number
  /** 差引売上 = 売上 − 返金 */
  netIncl: number
}

export type CategoryRow = {
  name: string
  qty: number
  amountIncl: number
  /** 構成比(0〜1) */
  share: number
}

/** 支払い方法ごとの集計。返金は返品した日で数える */
export type PaymentRow = {
  method: PaymentMethod
  count: number
  salesIncl: number
  refundIncl: number
  /** 差引売上 = 売上 − 返金 */
  netIncl: number
}

export type LedgerSale = Sale & { items: SaleItem[] }
export type LedgerRefund = Refund & {
  saleNo: string
  items: (RefundItem & { saleItem?: SaleItem })[]
}

export type LedgerData = {
  mode: LedgerMode
  /** 'YYYY-MM'(day)、'YYYY'(month)、'YYYY-MM-DD'(date) */
  period: string
  rows: LedgerRow[]
  total: LedgerRow
  /** 売上(税込)の大きい順 */
  categories: CategoryRow[]
  /** 支払い方法ごと。現金・カード・電子マネー・QR の順。会計も返金もない方法は入れない */
  payments: PaymentRow[]
  /** Excel の明細用 */
  sales: LedgerSale[]
  refunds: LedgerRefund[]
  closings: Closing[]
}

function emptyRow(key: string): LedgerRow {
  return { key, count: 0, salesIncl: 0, salesTax: 0, salesExcl: 0, refundIncl: 0, refundTax: 0, netIncl: 0 }
}

function addTo(row: LedgerRow, sales: Sale[], refunds: Refund[]): void {
  for (const s of sales) {
    row.count += 1
    row.salesIncl += s.totalIncl
    row.salesTax += s.taxAmount
    row.salesExcl += s.totalExcl
  }
  for (const r of refunds) {
    row.refundIncl += r.amountIncl
    row.refundTax += r.taxAmount
  }
  row.netIncl = row.salesIncl - row.refundIncl
}

/** 集計する期間の最初と最後の日 */
function rangeOf(mode: LedgerMode, period: string): [string, string] {
  if (mode === 'date') return [period, period]
  return mode === 'day' ? [`${period}-01`, `${period}-31`] : [`${period}-01-01`, `${period}-12-31`]
}

/** 一覧に出す行のキー。今日より先の日・月は出さない */
function rowKeys(mode: LedgerMode, period: string, today: string): string[] {
  const keys: string[] = []
  if (mode === 'date') {
    if (period <= today) keys.push(period)
  } else if (mode === 'day') {
    for (let d = `${period}-01`; d.startsWith(period) && d <= today; d = addDays(d, 1)) keys.push(d)
  } else {
    for (let m = 1; m <= 12; m++) {
      const key = `${period}-${String(m).padStart(2, '0')}`
      if (`${key}-01` <= today) keys.push(key)
    }
  }
  return keys
}

/**
 * 帳簿の集計と、Excel に出す明細をまとめて読み込む。
 * 売上は会計した日、返金は返品した日で数える(仕様書 §5 F3)。
 */
export async function loadLedger(
  db: AppDB,
  mode: LedgerMode,
  period: string,
  today = businessDateOf(),
): Promise<LedgerData> {
  const [start, end] = rangeOf(mode, period)
  const [sales, refunds, closings] = await Promise.all([
    db.sales.where('businessDate').between(start, end, true, true).toArray(),
    db.refunds.where('businessDate').between(start, end, true, true).toArray(),
    db.closings.where('businessDate').between(start, end, true, true).toArray(),
  ])

  const saleIds = sales.map((s) => s.id)
  const refundIds = refunds.map((r) => r.id)
  const [saleItems, refundItems] = await Promise.all([
    saleIds.length ? db.saleItems.where('saleId').anyOf(saleIds).toArray() : [],
    refundIds.length ? db.refundItems.where('refundId').anyOf(refundIds).toArray() : [],
  ])
  // 返品の明細は、元の会計が別の期間にあることもあるので、明細と会計を個別に読み込む
  const refundedItems = await db.saleItems.bulkGet(refundItems.map((ri) => ri.saleItemId))
  const refundSales = await db.sales.bulkGet(refunds.map((r) => r.saleId))

  // ---------- 一覧の行 ----------
  const keyOf = (businessDate: string) => (mode === 'month' ? businessDate.slice(0, 7) : businessDate)
  const rows = new Map(rowKeys(mode, period, today).map((k) => [k, emptyRow(k)]))
  // 端末の時計がずれていて今日より先の日付のデータがあっても、行を足して漏らさない
  const rowFor = (businessDate: string) => {
    const key = keyOf(businessDate)
    let row = rows.get(key)
    if (!row) rows.set(key, (row = emptyRow(key)))
    return row
  }
  for (const s of sales) addTo(rowFor(s.businessDate), [s], [])
  for (const r of refunds) addTo(rowFor(r.businessDate), [], [r])
  const sortedRows = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key))
  const total = emptyRow('合計')
  addTo(total, sales, refunds)

  // ---------- カテゴリー別(売上。返品は差し引かない) ----------
  const byCategory = new Map<string, CategoryRow>()
  for (const item of saleItems) {
    const name = item.categoryName || '(カテゴリーなし)'
    const row = byCategory.get(name) ?? { name, qty: 0, amountIncl: 0, share: 0 }
    row.qty += item.qty
    row.amountIncl += item.lineTotal
    byCategory.set(name, row)
  }
  const categoryTotal = [...byCategory.values()].reduce((sum, c) => sum + c.amountIncl, 0)
  const categories = [...byCategory.values()]
    .map((c) => ({ ...c, share: categoryTotal ? c.amountIncl / categoryTotal : 0 }))
    .sort((a, b) => b.amountIncl - a.amountIncl || a.name.localeCompare(b.name, 'ja'))

  // ---------- 支払い方法別 ----------
  const byMethod = new Map<PaymentMethod, PaymentRow>(
    PAYMENT_METHODS.map((method) => [method, { method, count: 0, salesIncl: 0, refundIncl: 0, netIncl: 0 }]),
  )
  for (const s of sales) {
    const row = byMethod.get(paymentMethodOf(s))!
    row.count += 1
    row.salesIncl += s.totalIncl
  }
  for (const r of refunds) byMethod.get(paymentMethodOf(r))!.refundIncl += r.amountIncl
  const payments = [...byMethod.values()]
    .filter((p) => p.count > 0 || p.refundIncl > 0)
    .map((p) => ({ ...p, netIncl: p.salesIncl - p.refundIncl }))

  // ---------- Excel の明細 ----------
  const itemsBySale = new Map<string, SaleItem[]>()
  for (const item of saleItems) {
    const list = itemsBySale.get(item.saleId) ?? []
    list.push(item)
    itemsBySale.set(item.saleId, list)
  }
  const ledgerSales = sales
    .map((s) => ({ ...s, items: (itemsBySale.get(s.id) ?? []).sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0)) }))
    .sort((a, b) => a.soldAt.localeCompare(b.soldAt) || a.saleNo.localeCompare(b.saleNo))

  const saleItemById = new Map(refundedItems.filter((i): i is SaleItem => Boolean(i)).map((i) => [i.id, i]))
  const saleNoById = new Map(refundSales.filter((s): s is Sale => Boolean(s)).map((s) => [s.id, s.saleNo]))
  const ledgerRefunds = refunds
    .map((r) => ({
      ...r,
      saleNo: saleNoById.get(r.saleId) ?? '',
      items: refundItems.filter((ri) => ri.refundId === r.id).map((ri) => ({ ...ri, saleItem: saleItemById.get(ri.saleItemId) })),
    }))
    .sort((a, b) => a.refundedAt.localeCompare(b.refundedAt))

  return {
    mode,
    period,
    rows: sortedRows,
    total,
    categories,
    payments,
    sales: ledgerSales,
    refunds: ledgerRefunds,
    closings: closings.sort((a, b) => a.businessDate.localeCompare(b.businessDate)),
  }
}
