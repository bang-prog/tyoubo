import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, loadCatalog, saveProduct } from './catalog'
import { createDB, type AppDB } from './db'
import { ValidationError } from './errors'
import { createSale } from './sales'

let db: AppDB
/** 白の S(在庫2)、白の M(在庫1) */
let shirtS: string
let shirtM: string
/** 在庫3 */
let socks: string

const at = new Date(2026, 10, 4, 14, 5, 9) // 2026-11-04 14:05:09

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const tops = await addCategory(db, 'トップス')
  const goods = await addCategory(db, '小物')
  await saveProduct(db, {
    name: 'シャツ',
    categoryId: tops,
    priceIncl: 6980,
    cost: 2800,
    sizes: ['S', 'M'],
    colors: ['白'],
    stocks: [
      { size: 'S', color: '白', stock: 2 },
      { size: 'M', color: '白', stock: 1 },
    ],
  })
  await saveProduct(db, {
    name: 'ソックス',
    categoryId: goods,
    priceIncl: 990,
    cost: 300,
    sizes: ['F'],
    colors: ['黒'],
    stocks: [{ size: 'F', color: '黒', stock: 3 }],
  })
  const { products } = await loadCatalog(db)
  const shirt = products.find((p) => p.name === 'シャツ')!
  shirtS = shirt.variants.find((v) => v.size === 'S')!.id
  shirtM = shirt.variants.find((v) => v.size === 'M')!.id
  socks = products.find((p) => p.name === 'ソックス')!.variants[0].id
})

afterEach(async () => {
  await db.delete()
})

const stockOf = async (variantId: string) => (await db.variants.get(variantId))!.stock

describe('createSale', () => {
  it('合計・消費税・お釣りを計算して保存し、在庫を減らす', async () => {
    const sale = await createSale(
      db,
      {
        lines: [
          { variantId: shirtS, qty: 1 },
          { variantId: socks, qty: 3 },
        ],
        received: 10000,
        expectedTotal: 9950,
      },
      at,
    )
    expect(sale).toMatchObject({
      saleNo: '20261104-001',
      businessDate: '2026-11-04',
      totalIncl: 9950,
      taxAmount: 904, // floor(9950 × 10 / 110) = 904.5…
      totalExcl: 9046,
      received: 10000,
      change: 50,
    })
    expect(sale.soldAt.startsWith('2026-11-04T14:05:09')).toBe(true)
    expect(await stockOf(shirtS)).toBe(1)
    expect(await stockOf(socks)).toBe(0)
  })

  it('明細に、会計した時点の商品名・カテゴリー・価格を書き写す', async () => {
    const sale = await createSale(db, { lines: [{ variantId: shirtS, qty: 2 }], received: 20000, expectedTotal: 13960 }, at)
    const items = await db.saleItems.where('saleId').equals(sale.id).toArray()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      productName: 'シャツ',
      categoryName: 'トップス',
      size: 'S',
      color: '白',
      unitPriceIncl: 6980,
      qty: 2,
      lineTotal: 13960,
      returnedQty: 0,
    })
  })

  it('会計番号は営業日ごとに001から振る', async () => {
    const input = { lines: [{ variantId: socks, qty: 1 }], received: 990, expectedTotal: 990 }
    expect((await createSale(db, input, at)).saleNo).toBe('20261104-001')
    expect((await createSale(db, input, at)).saleNo).toBe('20261104-002')
    expect((await createSale(db, input, new Date(2026, 10, 5, 11, 0))).saleNo).toBe('20261105-001')
  })

  it('在庫が足りなくても会計でき、在庫はマイナスになる', async () => {
    await createSale(db, { lines: [{ variantId: shirtM, qty: 2 }], received: 13960, expectedTotal: 13960 }, at)
    expect(await stockOf(shirtM)).toBe(-1)
  })

  it('お預かりが足りないときは保存しない', async () => {
    await expect(
      createSale(db, { lines: [{ variantId: shirtS, qty: 1 }], received: 5000, expectedTotal: 6980 }, at),
    ).rejects.toThrow('お預かりが足りません')
    expect(await db.sales.count()).toBe(0)
    expect(await stockOf(shirtS)).toBe(2)
  })

  it('画面の合計と、計算し直した合計が違えば保存しない', async () => {
    await expect(
      createSale(db, { lines: [{ variantId: shirtS, qty: 1 }], received: 10000, expectedTotal: 5980 }, at),
    ).rejects.toThrow('合計が変わりました')
    expect(await db.sales.count()).toBe(0)
  })

  it('削除された商品が入っていたら、ほかの商品も含めて何も保存しない', async () => {
    await db.variants.update(shirtM, { isActive: false })
    await expect(
      createSale(
        db,
        {
          lines: [
            { variantId: socks, qty: 1 },
            { variantId: shirtM, qty: 1 },
          ],
          received: 10000,
          expectedTotal: 7970,
        },
        at,
      ),
    ).rejects.toThrow(ValidationError)
    expect(await db.sales.count()).toBe(0)
    expect(await db.saleItems.count()).toBe(0)
    expect(await stockOf(socks)).toBe(3)
  })

  it('カートが空なら保存しない', async () => {
    await expect(createSale(db, { lines: [], received: 0, expectedTotal: 0 }, at)).rejects.toThrow('カートに商品がありません')
  })
})
