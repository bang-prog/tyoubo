import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, loadCatalog, saveProduct } from './catalog'
import { loadClosingDay, saveClosing } from './closings'
import { createDB, type AppDB } from './db'
import { ValidationError } from './errors'
import { loadDayHistory } from './history'
import { loadLedger } from './ledger'
import { createRefund } from './refunds'
import { createSale } from './sales'
import type { PaymentMethod } from '../lib/payment'

let db: AppDB
let variantId: string
const at = (h: number) => new Date(2026, 10, 8, h)

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const tops = await addCategory(db, 'トップス')
  await saveProduct(db, { name: 'シャツ', categoryId: tops, priceIncl: 5500, cost: 0, sizes: ['M'], colors: ['白'], stocks: [{ size: 'M', color: '白', stock: 10 }] })
  variantId = (await loadCatalog(db)).products[0].variants[0].id
})

afterEach(async () => {
  await db.delete()
})

const sell = (paymentMethod: PaymentMethod | undefined, hour: number, received = 0) =>
  createSale(db, { lines: [{ variantId, qty: 1 }], paymentMethod, received, expectedTotal: 5500 }, at(hour))

describe('支払い方法', () => {
  it('キャッシュレスは、お預かり = 合計、お釣り = 0 で記録する(入力したお預かりは使わない)', async () => {
    const sale = await sell('card', 10, 0)
    expect(sale).toMatchObject({ paymentMethod: 'card', totalIncl: 5500, received: 5500, change: 0 })
    expect((await db.variants.get(variantId))!.stock).toBe(9)
  })

  it('支払い方法を省くと現金。現金はお預かりが足りないと保存しない', async () => {
    expect(await sell(undefined, 10, 10000)).toMatchObject({ paymentMethod: 'cash', received: 10000, change: 4500 })
    await expect(sell('cash', 11, 1000)).rejects.toThrow('お預かりが足りません')
  })

  it('知らない支払い方法は保存しない', async () => {
    await expect(sell('bitcoin' as PaymentMethod, 10)).rejects.toBeInstanceOf(ValidationError)
  })

  it('返金は元の会計と同じ支払い方法で記録する', async () => {
    const sale = await sell('emoney', 10)
    const refund = await createRefund(db, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, qty: 1 }] }, at(12))
    expect(refund.paymentMethod).toBe('emoney')
  })

  it('レジ締めは現金の売上と現金の返金だけで計算し、キャッシュレスは参考として分ける', async () => {
    const cash = await sell('cash', 10, 10000)
    const card = await sell('card', 11)
    await sell('qr', 12)
    await createRefund(db, { saleId: card.id, items: [{ saleItemId: card.items[0].id, qty: 1 }] }, at(13))
    await createRefund(db, { saleId: cash.id, items: [{ saleItemId: cash.items[0].id, qty: 1 }] }, at(14))

    expect(await loadClosingDay(db, '2026-11-08')).toMatchObject({
      cashSales: 5500,
      refundsTotal: 5500,
      cashlessSales: 11000,
      cashlessRefunds: 5500,
    })
    const closing = await saveClosing(db, { businessDate: '2026-11-08', openingFloat: 20000, counts: { '10000': 2 }, memo: '' }, at(20))
    expect(closing).toMatchObject({ cashSales: 5500, refundsTotal: 5500, expected: 20000, difference: 0 })
  })

  it('支払い方法がない古い会計と返品は現金として数える', async () => {
    const sale = await sell('cash', 10, 5500)
    await db.sales.update(sale.id, { paymentMethod: undefined })
    expect((await loadClosingDay(db, '2026-11-08')).cashSales).toBe(5500)
    expect((await loadDayHistory(db, '2026-11-08')).cashTotal).toBe(5500)
  })

  it('会計履歴は売上と、そのうち現金の売上を出す', async () => {
    await sell('cash', 10, 5500)
    await sell('qr', 11)
    expect(await loadDayHistory(db, '2026-11-08')).toMatchObject({ salesTotal: 11000, cashTotal: 5500 })
  })

  it('帳簿は支払い方法ごとに件数・売上・返金を集計し、ない方法は出さない', async () => {
    await sell('cash', 10, 5500)
    const card = await sell('card', 11)
    await sell('card', 12)
    await createRefund(db, { saleId: card.id, items: [{ saleItemId: card.items[0].id, qty: 1 }] }, at(13))

    const data = await loadLedger(db, 'day', '2026-11', '2026-11-08')
    expect(data.payments).toEqual([
      { method: 'cash', count: 1, salesIncl: 5500, refundIncl: 0, netIncl: 5500 },
      { method: 'card', count: 2, salesIncl: 11000, refundIncl: 5500, netIncl: 5500 },
    ])
  })
})
