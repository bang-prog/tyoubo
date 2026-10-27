// テストでは本物の IndexedDB の代わりに fake-indexeddb を使う(メモリの中だけで動く)
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDB, type AppDB } from './db'
import { DEFAULT_SETTINGS, getSetting, setSetting } from './settings'
import type { Category, Sale, Variant } from './types'

let db: AppDB

beforeEach(() => {
  db = createDB(`test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

const now = '2026-10-27T10:00:00+09:00'

function category(name: string, sortOrder: number): Category {
  return { id: crypto.randomUUID(), name, sortOrder, createdAt: now }
}

function variant(productId: string, size: string, color: string, stock = 1): Variant {
  return { id: crypto.randomUUID(), productId, size, color, stock, sizeOrder: 0, colorOrder: 0, isActive: true }
}

function sale(saleNo: string, businessDate: string): Sale {
  return {
    id: crypto.randomUUID(),
    saleNo,
    businessDate,
    soldAt: `${businessDate}T12:00:00+09:00`,
    totalIncl: 6980,
    taxAmount: 634,
    totalExcl: 6346,
    received: 10000,
    change: 3020,
  }
}

describe('テーブルの定義', () => {
  it('9つのテーブルがある', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['categories', 'closings', 'products', 'refundItems', 'refunds', 'saleItems', 'sales', 'settings', 'variants'].sort(),
    )
  })
})

describe('保存と読み込み', () => {
  it('追加したデータを取り出せる', async () => {
    const tops = category('トップス', 1)
    await db.categories.add(tops)
    expect(await db.categories.get(tops.id)).toEqual(tops)
  })

  it('並び順で取り出せる', async () => {
    await db.categories.bulkAdd([category('小物', 3), category('トップス', 1), category('ボトムス', 2)])
    const names = (await db.categories.orderBy('sortOrder').toArray()).map((c) => c.name)
    expect(names).toEqual(['トップス', 'ボトムス', '小物'])
  })

  it('営業日で会計を絞り込める', async () => {
    await db.sales.bulkAdd([
      sale('20261026-001', '2026-10-26'),
      sale('20261027-001', '2026-10-27'),
      sale('20261027-002', '2026-10-27'),
    ])
    const list = await db.sales.where('businessDate').equals('2026-10-27').toArray()
    expect(list.map((s) => s.saleNo).sort()).toEqual(['20261027-001', '20261027-002'])
  })

  it('商品・サイズ・色の組み合わせでバリエーションを探せる', async () => {
    const productId = crypto.randomUUID()
    const m = variant(productId, 'M', '白', 3)
    await db.variants.bulkAdd([variant(productId, 'S', '白'), m])
    const found = await db.variants.where('[productId+size+color]').equals([productId, 'M', '白']).first()
    expect(found).toEqual(m)
  })
})

describe('重複の防止', () => {
  it('同じ会計番号は保存できない', async () => {
    await db.sales.add(sale('20261027-001', '2026-10-27'))
    await expect(db.sales.add(sale('20261027-001', '2026-10-27'))).rejects.toThrow()
    expect(await db.sales.count()).toBe(1)
  })

  it('同じ商品の同じサイズ・色は2つ作れない', async () => {
    const productId = crypto.randomUUID()
    await db.variants.add(variant(productId, 'M', '白'))
    await expect(db.variants.add(variant(productId, 'M', '白'))).rejects.toThrow()
  })
})

describe('トランザクション', () => {
  it('途中で失敗したら、それまでの保存もなかったことになる', async () => {
    const productId = crypto.randomUUID()
    const v = variant(productId, 'M', '白', 3)
    await db.variants.add(v)

    await expect(
      db.transaction('rw', db.sales, db.variants, async () => {
        await db.sales.add(sale('20261027-001', '2026-10-27'))
        await db.variants.update(v.id, { stock: 2 })
        throw new Error('途中で失敗')
      }),
    ).rejects.toThrow('途中で失敗')

    expect(await db.sales.count()).toBe(0)
    expect((await db.variants.get(v.id))?.stock).toBe(3)
  })
})

describe('設定', () => {
  it('保存していない設定は初期値を返す', async () => {
    expect(await getSetting(db, 'taxRate')).toBe(DEFAULT_SETTINGS.taxRate)
    expect(await getSetting(db, 'exportedMonths')).toEqual([])
  })

  it('保存した設定を読み込める', async () => {
    await setSetting(db, 'lastFloat', 30000)
    await setSetting(db, 'exportedMonths', ['2026-09'])
    expect(await getSetting(db, 'lastFloat')).toBe(30000)
    expect(await getSetting(db, 'exportedMonths')).toEqual(['2026-09'])
  })

  it('同じ設定を保存し直すと上書きされる', async () => {
    await setSetting(db, 'lastFloat', 30000)
    await setSetting(db, 'lastFloat', 20000)
    expect(await getSetting(db, 'lastFloat')).toBe(20000)
    expect(await db.settings.count()).toBe(1)
  })
})
