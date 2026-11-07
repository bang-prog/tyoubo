import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, loadCatalog, saveProduct } from './catalog'
import { saveClosing } from './closings'
import { createDB, type AppDB } from './db'
import { loadLedger } from './ledger'
import { createRefund } from './refunds'
import { createSale } from './sales'

let db: AppDB
let shirt: string
let socks: string

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h)

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const tops = await addCategory(db, 'トップス')
  const goods = await addCategory(db, '小物')
  await saveProduct(db, { name: 'シャツ', categoryId: tops, priceIncl: 6980, cost: 0, sizes: ['F'], colors: ['白'], stocks: [{ size: 'F', color: '白', stock: 20 }] })
  await saveProduct(db, { name: 'ソックス', categoryId: goods, priceIncl: 990, cost: 0, sizes: ['F'], colors: ['黒'], stocks: [{ size: 'F', color: '黒', stock: 20 }] })
  const { products } = await loadCatalog(db)
  shirt = products.find((p) => p.name === 'シャツ')!.variants[0].id
  socks = products.find((p) => p.name === 'ソックス')!.variants[0].id

  // 10月31日:シャツ1
  const oct = await createSale(db, { lines: [{ variantId: shirt, qty: 1 }], received: 6980, expectedTotal: 6980 }, at(10, 31))
  // 11月2日:シャツ1 + ソックス2、11月5日:ソックス1
  await createSale(db, { lines: [{ variantId: shirt, qty: 1 }, { variantId: socks, qty: 2 }], received: 10000, expectedTotal: 8960 }, at(11, 2))
  await createSale(db, { lines: [{ variantId: socks, qty: 1 }], received: 1000, expectedTotal: 990 }, at(11, 5))
  // 11月3日:10月31日のシャツを返品
  await createRefund(db, { saleId: oct.id, items: [{ saleItemId: oct.items[0].id, qty: 1 }], memo: 'サイズ違い' }, at(11, 3))
  await saveClosing(db, { businessDate: '2026-11-02', openingFloat: 30000, counts: { '10000': 3 }, memo: '' }, at(11, 2, 19))
})

afterEach(async () => {
  await db.delete()
})

describe('loadLedger(日別)', () => {
  it('月の1日から今日までを1行ずつ出し、会計のない日も0で出す', async () => {
    const data = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    expect(data.rows.map((r) => r.key)).toEqual([
      '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07',
    ])
    expect(data.rows[0]).toMatchObject({ count: 0, salesIncl: 0, netIncl: 0 })
  })

  it('売上は会計した日、返金は返品した日で数える', async () => {
    const data = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    const row = (key: string) => data.rows.find((r) => r.key === key)!
    expect(row('2026-11-02')).toMatchObject({ count: 1, salesIncl: 8960, salesTax: 814, salesExcl: 8146, refundIncl: 0, netIncl: 8960 })
    expect(row('2026-11-03')).toMatchObject({ count: 0, salesIncl: 0, refundIncl: 6980, refundTax: 634, netIncl: -6980 })
    expect(data.total).toMatchObject({ count: 2, salesIncl: 9950, salesTax: 904, refundIncl: 6980, netIncl: 2970 })
  })

  it('カテゴリー別は売上の大きい順で、構成比を出す', async () => {
    const data = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    expect(data.categories.map((c) => [c.name, c.qty, c.amountIncl])).toEqual([
      ['トップス', 1, 6980],
      ['小物', 3, 2970],
    ])
    expect(data.categories[0].share).toBeCloseTo(6980 / 9950)
  })

  it('Excel 用の明細:会計、返品(元の会計番号と商品)、レジ締め', async () => {
    const data = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    expect(data.sales.map((s) => [s.saleNo, s.items.map((i) => i.productName)])).toEqual([
      ['20261102-001', ['シャツ', 'ソックス']],
      ['20261105-001', ['ソックス']],
    ])
    expect(data.refunds).toHaveLength(1)
    expect(data.refunds[0]).toMatchObject({ saleNo: '20261031-001', memo: 'サイズ違い', amountIncl: 6980 })
    expect(data.refunds[0].items[0].saleItem?.productName).toBe('シャツ')
    expect(data.closings.map((c) => c.businessDate)).toEqual(['2026-11-02'])
  })

  it('先の月は空、前の月はその月だけ', async () => {
    expect((await loadLedger(db, 'day', '2026-12', '2026-11-07')).rows).toEqual([])
    const oct = await loadLedger(db, 'day', '2026-10', '2026-11-07')
    expect(oct.rows).toHaveLength(31)
    expect(oct.total).toMatchObject({ count: 1, salesIncl: 6980, refundIncl: 0 })
  })
})

describe('loadLedger(1日分)', () => {
  it('その日の会計・返品・レジ締めだけを集める', async () => {
    const data = await loadLedger(db, 'date', '2026-11-02', '2026-11-07')
    expect(data.rows.map((r) => r.key)).toEqual(['2026-11-02'])
    expect(data.total).toMatchObject({ count: 1, salesIncl: 8960, refundIncl: 0 })
    expect(data.sales.map((s) => s.saleNo)).toEqual(['20261102-001'])
    expect(data.refunds).toEqual([])
    expect(data.closings.map((c) => c.businessDate)).toEqual(['2026-11-02'])
    expect(data.categories.map((c) => c.name)).toEqual(['トップス', '小物'])
  })

  it('返品だけの日は、返品を集める', async () => {
    const data = await loadLedger(db, 'date', '2026-11-03', '2026-11-07')
    expect(data.total).toMatchObject({ count: 0, refundIncl: 6980, netIncl: -6980 })
    expect(data.refunds.map((r) => r.saleNo)).toEqual(['20261031-001'])
  })

  it('今日より先の日は空', async () => {
    expect((await loadLedger(db, 'date', '2026-11-08', '2026-11-07')).rows).toEqual([])
  })
})

describe('loadLedger(月別)', () => {
  it('1月から今月までを1行ずつ出す', async () => {
    const data = await loadLedger(db, 'month', '2026', '2026-11-07')
    expect(data.rows.map((r) => r.key)).toHaveLength(11)
    const row = (key: string) => data.rows.find((r) => r.key === key)!
    expect(row('2026-10')).toMatchObject({ count: 1, salesIncl: 6980, refundIncl: 0 })
    expect(row('2026-11')).toMatchObject({ count: 2, salesIncl: 9950, refundIncl: 6980, netIncl: 2970 })
    expect(data.total).toMatchObject({ count: 3, salesIncl: 16930, refundIncl: 6980 })
  })
})
