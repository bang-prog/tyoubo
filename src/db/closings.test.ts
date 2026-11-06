import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, loadCatalog, saveProduct } from './catalog'
import { loadClosingDay, saveClosing } from './closings'
import { createDB, type AppDB } from './db'
import { createRefund } from './refunds'
import { createSale } from './sales'

let db: AppDB
const nov6 = (h: number) => new Date(2026, 10, 6, h)

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const tops = await addCategory(db, 'トップス')
  await saveProduct(db, {
    name: 'シャツ',
    categoryId: tops,
    priceIncl: 6980,
    cost: 0,
    sizes: ['F'],
    colors: ['白'],
    stocks: [{ size: 'F', color: '白', stock: 10 }],
  })
  const variantId = (await loadCatalog(db)).products[0].variants[0].id
  // 11月6日:6,980円 × 2回の会計、1点返品
  const sale = await createSale(db, { lines: [{ variantId, qty: 1 }], received: 10000, expectedTotal: 6980 }, nov6(11))
  await createSale(db, { lines: [{ variantId, qty: 1 }], received: 6980, expectedTotal: 6980 }, nov6(13))
  await createRefund(db, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, qty: 1 }] }, nov6(15))
})

afterEach(async () => {
  await db.delete()
})

describe('loadClosingDay', () => {
  it('その日の現金売上と返金を合計する。保存前は前回の準備金(最初は0円)', async () => {
    const day = await loadClosingDay(db, '2026-11-06')
    expect(day).toMatchObject({ cashSales: 13960, refundsTotal: 6980, defaultFloat: 0 })
    expect(day.saved).toBeUndefined()
  })
})

describe('saveClosing', () => {
  it('過不足を計算して保存する', async () => {
    // 準備金 30,000 + 売上 13,960 − 返金 6,980 = 36,980 のはず。数えたら 36,880(100円足りない)
    const closing = await saveClosing(
      db,
      {
        businessDate: '2026-11-06',
        openingFloat: 30000,
        counts: { '10000': 3, '1000': 6, '500': 1, '100': 3, '50': 1, '10': 3 },
        memo: '  両替で100円玉を使った ',
      },
      nov6(19),
    )
    expect(closing).toMatchObject({
      openingFloat: 30000,
      cashSales: 13960,
      refundsTotal: 6980,
      expected: 36980,
      countedTotal: 36880,
      difference: -100,
      memo: '両替で100円玉を使った',
    })
    expect(closing.closedAt.startsWith('2026-11-06T19:00')).toBe(true)
    expect((await loadClosingDay(db, '2026-11-06')).saved).toEqual(closing)
  })

  it('0枚の金種は保存しない', async () => {
    const closing = await saveClosing(db, { businessDate: '2026-11-06', openingFloat: 0, counts: { '1000': 0, '1': 2 }, memo: '' })
    expect(closing.counts).toEqual({ '1': 2 })
  })

  it('同じ日にもう一度保存すると上書きする', async () => {
    await saveClosing(db, { businessDate: '2026-11-06', openingFloat: 30000, counts: {}, memo: '' })
    await saveClosing(db, { businessDate: '2026-11-06', openingFloat: 20000, counts: { '10000': 2 }, memo: '直した' })
    expect(await db.closings.count()).toBe(1)
    expect((await loadClosingDay(db, '2026-11-06')).saved?.memo).toBe('直した')
  })

  it('保存した準備金は、次の日の最初の値になる', async () => {
    await saveClosing(db, { businessDate: '2026-11-06', openingFloat: 30000, counts: {}, memo: '' })
    expect((await loadClosingDay(db, '2026-11-07')).defaultFloat).toBe(30000)
  })

  it('締めたあとに返品しても、保存した数字は変わらない', async () => {
    const saved = await saveClosing(db, { businessDate: '2026-11-06', openingFloat: 30000, counts: {}, memo: '' })
    const sales = await db.sales.where('businessDate').equals('2026-11-06').toArray()
    const second = sales.find((s) => s.received === 6980)!
    const item = (await db.saleItems.where('saleId').equals(second.id).toArray())[0]
    await createRefund(db, { saleId: second.id, items: [{ saleItemId: item.id, qty: 1 }] }, nov6(20))
    const day = await loadClosingDay(db, '2026-11-06')
    expect(day.refundsTotal).toBe(13960) // 今の値は変わる
    expect(day.saved?.refundsTotal).toBe(saved.refundsTotal) // 締めた時点の値は残る
  })

  it('準備金や枚数が正しくなければ保存しない', async () => {
    await expect(saveClosing(db, { businessDate: '2026-11-06', openingFloat: -1, counts: {}, memo: '' })).rejects.toThrow('釣り銭準備金')
    await expect(
      saveClosing(db, { businessDate: '2026-11-06', openingFloat: 0, counts: { '100': 1.5 }, memo: '' }),
    ).rejects.toThrow('100円玉の枚数')
    expect(await db.closings.count()).toBe(0)
  })
})
