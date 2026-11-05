import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, loadCatalog, saveProduct } from './catalog'
import { createDB, type AppDB } from './db'
import { loadDayHistory } from './history'
import { createSale } from './sales'

let db: AppDB
let shirt: string
let socks: string

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const tops = await addCategory(db, 'トップス')
  for (const [name, priceIncl] of [
    ['シャツ', 6980],
    ['ソックス', 990],
  ] as const) {
    await saveProduct(db, {
      name,
      categoryId: tops,
      priceIncl,
      cost: 0,
      sizes: ['F'],
      colors: ['白'],
      stocks: [{ size: 'F', color: '白', stock: 10 }],
    })
  }
  const { products } = await loadCatalog(db)
  shirt = products.find((p) => p.name === 'シャツ')!.variants[0].id
  socks = products.find((p) => p.name === 'ソックス')!.variants[0].id
})

afterEach(async () => {
  await db.delete()
})

const nov6 = (h: number, m = 0) => new Date(2026, 10, 6, h, m)

describe('loadDayHistory', () => {
  it('その日の会計だけを、時刻の新しい順に読み込む', async () => {
    await createSale(db, { lines: [{ variantId: socks, qty: 1 }], received: 990, expectedTotal: 990 }, nov6(11))
    await createSale(db, { lines: [{ variantId: shirt, qty: 1 }], received: 10000, expectedTotal: 6980 }, nov6(15, 30))
    await createSale(db, { lines: [{ variantId: socks, qty: 2 }], received: 2000, expectedTotal: 1980 }, new Date(2026, 10, 7, 12))

    const day = await loadDayHistory(db, '2026-11-06')
    expect(day.sales.map((s) => s.saleNo)).toEqual(['20261106-002', '20261106-001'])
    expect(day.salesTotal).toBe(7970)
    expect(day.refundsTotal).toBe(0)
  })

  it('明細はカートに入れた順に並ぶ', async () => {
    await createSale(
      db,
      {
        lines: [
          { variantId: socks, qty: 3 },
          { variantId: shirt, qty: 1 },
        ],
        received: 10000,
        expectedTotal: 9950,
      },
      nov6(12),
    )
    const [sale] = (await loadDayHistory(db, '2026-11-06')).sales
    expect(sale.items.map((i) => [i.productName, i.qty])).toEqual([
      ['ソックス', 3],
      ['シャツ', 1],
    ])
  })

  it('行番号のない古い明細も読み込める', async () => {
    const sale = await createSale(db, { lines: [{ variantId: shirt, qty: 1 }], received: 6980, expectedTotal: 6980 }, nov6(12))
    await db.saleItems.where('saleId').equals(sale.id).modify((item) => {
      delete item.lineNo
    })
    const day = await loadDayHistory(db, '2026-11-06')
    expect(day.sales[0].items).toHaveLength(1)
  })

  it('返品は、返品した日の返金として数える', async () => {
    const sale = await createSale(db, { lines: [{ variantId: shirt, qty: 1 }], received: 6980, expectedTotal: 6980 }, nov6(12))
    await db.refunds.add({
      id: crypto.randomUUID(),
      saleId: sale.id,
      businessDate: '2026-11-07',
      refundedAt: '2026-11-07T10:00:00+09:00',
      amountIncl: 6980,
      taxAmount: 634,
      amountExcl: 6346,
      memo: '',
    })
    const nov6Day = await loadDayHistory(db, '2026-11-06')
    expect(nov6Day.refundsTotal).toBe(0)
    expect(nov6Day.sales[0].refunds).toHaveLength(1) // 元の会計には返品の記録が付く
    expect((await loadDayHistory(db, '2026-11-07')).refundsTotal).toBe(6980)
  })

  it('会計のない日は空', async () => {
    const day = await loadDayHistory(db, '2026-11-06')
    expect(day.sales).toEqual([])
    expect(day.salesTotal).toBe(0)
  })
})
