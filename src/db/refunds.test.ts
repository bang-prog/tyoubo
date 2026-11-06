import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, deleteProduct, loadCatalog, saveProduct } from './catalog'
import { createDB, type AppDB } from './db'
import { loadDayHistory } from './history'
import { createRefund } from './refunds'
import { createSale } from './sales'
import type { SaleItem } from './types'

let db: AppDB
let shirtVariant: string
let socksVariant: string
let saleId: string
/** シャツ1点(6,980円)、ソックス3点(990円) */
let shirtItem: SaleItem
let socksItem: SaleItem

const saleDay = new Date(2026, 10, 6, 12, 0) // 11月6日に会計
const nextDay = new Date(2026, 10, 7, 10, 30) // 11月7日に返品

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
      stocks: [{ size: 'F', color: '白', stock: 5 }],
    })
  }
  const { products } = await loadCatalog(db)
  shirtVariant = products.find((p) => p.name === 'シャツ')!.variants[0].id
  socksVariant = products.find((p) => p.name === 'ソックス')!.variants[0].id
  const sale = await createSale(
    db,
    {
      lines: [
        { variantId: shirtVariant, qty: 1 },
        { variantId: socksVariant, qty: 3 },
      ],
      received: 10000,
      expectedTotal: 9950,
    },
    saleDay,
  )
  saleId = sale.id
  shirtItem = sale.items[0]
  socksItem = sale.items[1]
})

afterEach(async () => {
  await db.delete()
})

const stockOf = async (variantId: string) => (await db.variants.get(variantId))!.stock
const returnedOf = async (saleItemId: string) => (await db.saleItems.get(saleItemId))!.returnedQty

describe('createRefund', () => {
  it('返金額と消費税を計算して記録し、在庫と返品済みの数を更新する', async () => {
    const refund = await createRefund(
      db,
      {
        saleId,
        items: [
          { saleItemId: shirtItem.id, qty: 1 },
          { saleItemId: socksItem.id, qty: 2 },
        ],
      },
      nextDay,
    )
    expect(refund).toMatchObject({
      saleId,
      businessDate: '2026-11-07', // 返品した日
      amountIncl: 8960,
      taxAmount: 814, // floor(8960 × 10 / 110)
      amountExcl: 8146,
    })
    expect(refund.items.map((i) => [i.qty, i.amountIncl])).toEqual([
      [1, 6980],
      [2, 1980],
    ])
    expect(await stockOf(shirtVariant)).toBe(5) // 4 → 5
    expect(await stockOf(socksVariant)).toBe(4) // 2 → 4
    expect(await returnedOf(shirtItem.id)).toBe(1)
    expect(await returnedOf(socksItem.id)).toBe(2)
  })

  it('元の会計の金額は変えない', async () => {
    await createRefund(db, { saleId, items: [{ saleItemId: shirtItem.id, qty: 1 }] }, nextDay)
    const sale = await db.sales.get(saleId)
    expect(sale?.totalIncl).toBe(9950)
  })

  it('返金は返品した日の返金として数え、元の会計には記録が付く', async () => {
    await createRefund(db, { saleId, items: [{ saleItemId: socksItem.id, qty: 1 }] }, nextDay)
    const nov6 = await loadDayHistory(db, '2026-11-06')
    const nov7 = await loadDayHistory(db, '2026-11-07')
    expect(nov6.refundsTotal).toBe(0)
    expect(nov6.sales[0].refunds).toHaveLength(1)
    expect(nov7.refundsTotal).toBe(990)
  })

  it('何回かに分けて返品でき、残りの数を超えるとエラーになる', async () => {
    await createRefund(db, { saleId, items: [{ saleItemId: socksItem.id, qty: 2 }] }, nextDay)
    await createRefund(db, { saleId, items: [{ saleItemId: socksItem.id, qty: 1 }] }, nextDay)
    await expect(createRefund(db, { saleId, items: [{ saleItemId: socksItem.id, qty: 1 }] }, nextDay)).rejects.toThrow(
      'あと0点まで',
    )
    expect(await returnedOf(socksItem.id)).toBe(3)
    expect(await db.refunds.count()).toBe(2)
  })

  it('1つでも間違いがあれば、ほかの商品も含めて何も保存しない', async () => {
    await expect(
      createRefund(
        db,
        {
          saleId,
          items: [
            { saleItemId: shirtItem.id, qty: 1 },
            { saleItemId: socksItem.id, qty: 4 }, // 3点しか買っていない
          ],
        },
        nextDay,
      ),
    ).rejects.toThrow('あと3点まで')
    expect(await db.refunds.count()).toBe(0)
    expect(await db.refundItems.count()).toBe(0)
    expect(await returnedOf(shirtItem.id)).toBe(0)
    expect(await stockOf(shirtVariant)).toBe(4)
  })

  it('ほかの会計の明細は返品できない', async () => {
    const other = await createSale(db, { lines: [{ variantId: socksVariant, qty: 1 }], received: 990, expectedTotal: 990 }, saleDay)
    await expect(
      createRefund(db, { saleId, items: [{ saleItemId: other.items[0].id, qty: 1 }] }, nextDay),
    ).rejects.toThrow('この会計にない商品')
  })

  it('削除済みの商品でも返品でき、在庫は戻る', async () => {
    const { products } = await loadCatalog(db)
    await deleteProduct(db, products.find((p) => p.name === 'シャツ')!.id)
    await createRefund(db, { saleId, items: [{ saleItemId: shirtItem.id, qty: 1 }] }, nextDay)
    expect(await stockOf(shirtVariant)).toBe(5)
  })

  it('空・0点・同じ明細の重なりはエラー', async () => {
    await expect(createRefund(db, { saleId, items: [] })).rejects.toThrow('返品する商品を選んで')
    await expect(createRefund(db, { saleId, items: [{ saleItemId: shirtItem.id, qty: 0 }] })).rejects.toThrow('返品する数')
    await expect(
      createRefund(db, {
        saleId,
        items: [
          { saleItemId: socksItem.id, qty: 1 },
          { saleItemId: socksItem.id, qty: 1 },
        ],
      }),
    ).rejects.toThrow('重なっています')
  })
})
