import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addCategory,
  deleteCategory,
  deleteProduct,
  loadCatalog,
  moveCategory,
  renameCategory,
  saveProduct,
  type ProductInput,
} from './catalog'
import { createDB, type AppDB } from './db'
import { ValidationError } from './errors'

let db: AppDB

beforeEach(() => {
  db = createDB(`test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

async function categoryNames() {
  return (await db.categories.orderBy('sortOrder').toArray()).map((c) => c.name)
}

function shirt(categoryId: string, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: 'オックスフォードシャツ',
    categoryId,
    priceIncl: 6980,
    cost: 2800,
    sizes: ['S', 'M', 'L'],
    colors: ['白', 'サックス'],
    stocks: [
      { size: 'S', color: '白', stock: 2 },
      { size: 'M', color: '白', stock: 3 },
      { size: 'M', color: 'サックス', stock: 1 },
    ],
    ...overrides,
  }
}

describe('カテゴリー', () => {
  it('追加した順に並ぶ。前後の空白は取り除く', async () => {
    await addCategory(db, 'トップス')
    await addCategory(db, '  ボトムス ')
    expect(await categoryNames()).toEqual(['トップス', 'ボトムス'])
  })

  it('空の名前や、同じ名前は追加できない', async () => {
    await addCategory(db, 'トップス')
    await expect(addCategory(db, '   ')).rejects.toThrow(ValidationError)
    await expect(addCategory(db, 'トップス')).rejects.toThrow('すでにあります')
  })

  it('名前を変えられる。ほかと同じ名前にはできない', async () => {
    const id = await addCategory(db, 'トップス')
    await addCategory(db, '小物')
    await renameCategory(db, id, 'シャツ')
    expect(await categoryNames()).toEqual(['シャツ', '小物'])
    await expect(renameCategory(db, id, '小物')).rejects.toThrow('すでにあります')
    await renameCategory(db, id, 'シャツ') // 自分と同じ名前は OK
  })

  it('並び順を入れ替えられる', async () => {
    await addCategory(db, 'A')
    const b = await addCategory(db, 'B')
    await addCategory(db, 'C')
    await moveCategory(db, b, -1)
    expect(await categoryNames()).toEqual(['B', 'A', 'C'])
    await moveCategory(db, b, -1) // 先頭なので変わらない
    expect(await categoryNames()).toEqual(['B', 'A', 'C'])
    await moveCategory(db, b, 1)
    await moveCategory(db, b, 1)
    expect(await categoryNames()).toEqual(['A', 'C', 'B'])
  })

  it('商品があるカテゴリーは削除できない。商品を削除すれば削除できる', async () => {
    const tops = await addCategory(db, 'トップス')
    const productId = await saveProduct(db, shirt(tops))
    await expect(deleteCategory(db, tops)).rejects.toThrow('商品が1件ある')
    await deleteProduct(db, productId)
    await deleteCategory(db, tops)
    expect(await db.categories.count()).toBe(0)
  })
})

describe('商品の登録', () => {
  it('サイズ × 色の数だけバリエーションができ、在庫が入る', async () => {
    const tops = await addCategory(db, 'トップス')
    await saveProduct(db, shirt(tops))
    const { products } = await loadCatalog(db)
    expect(products).toHaveLength(1)
    const p = products[0]
    expect(p.categoryName).toBe('トップス')
    expect(p.sizes).toEqual(['S', 'M', 'L'])
    expect(p.colors).toEqual(['白', 'サックス'])
    expect(p.variants).toHaveLength(6)
    expect(p.totalStock).toBe(6) // 指定のない組み合わせは0
  })

  it('入力の間違いはエラーになり、何も保存されない', async () => {
    const tops = await addCategory(db, 'トップス')
    await expect(saveProduct(db, shirt(tops, { name: '' }))).rejects.toThrow('商品名を入力')
    await expect(saveProduct(db, shirt(tops, { priceIncl: 100.5 }))).rejects.toThrow('販売価格')
    await expect(saveProduct(db, shirt(tops, { cost: -1 }))).rejects.toThrow('仕入価格')
    await expect(saveProduct(db, shirt(tops, { sizes: [' ', ''] }))).rejects.toThrow('サイズを1つ以上')
    await expect(saveProduct(db, shirt(tops, { colors: ['白', '白'] }))).rejects.toThrow('重なっています')
    await expect(saveProduct(db, shirt('ない'))).rejects.toThrow('カテゴリーを選んで')
    expect(await db.products.count()).toBe(0)
    expect(await db.variants.count()).toBe(0)
  })
})

describe('商品の編集', () => {
  it('サイズを減らすとそのバリエーションは論理削除され、戻すと同じものを使い直す', async () => {
    const tops = await addCategory(db, 'トップス')
    const id = await saveProduct(db, shirt(tops))
    const before = await db.variants.where('[productId+size+color]').equals([id, 'L', '白']).first()

    await saveProduct(db, shirt(tops, { sizes: ['S', 'M'] }), id)
    let p = (await loadCatalog(db)).products[0]
    expect(p.sizes).toEqual(['S', 'M'])
    expect(p.variants).toHaveLength(4)
    expect(await db.variants.count()).toBe(6) // 消してはいない

    await saveProduct(db, shirt(tops), id)
    p = (await loadCatalog(db)).products[0]
    expect(p.variants).toHaveLength(6)
    const after = await db.variants.where('[productId+size+color]').equals([id, 'L', '白']).first()
    expect(after?.id).toBe(before?.id)
  })

  it('価格と在庫を変えられる。マイナスの在庫も保存できる', async () => {
    const tops = await addCategory(db, 'トップス')
    const id = await saveProduct(db, shirt(tops))
    await saveProduct(db, shirt(tops, { priceIncl: 5980, stocks: [{ size: 'S', color: '白', stock: -1 }] }), id)
    const p = (await loadCatalog(db)).products[0]
    expect(p.priceIncl).toBe(5980)
    expect(p.totalStock).toBe(-1)
    expect(p.hasNegative).toBe(true)
  })

  it('削除した商品は一覧に出ず、編集もできない', async () => {
    const tops = await addCategory(db, 'トップス')
    const id = await saveProduct(db, shirt(tops))
    await deleteProduct(db, id)
    expect((await loadCatalog(db)).products).toHaveLength(0)
    expect(await db.products.count()).toBe(1) // データは残っている
    await expect(saveProduct(db, shirt(tops), id)).rejects.toThrow('削除されています')
  })
})

describe('一覧の並び順', () => {
  it('カテゴリーの並び順、その中では名前順', async () => {
    const bottoms = await addCategory(db, 'ボトムス')
    const tops = await addCategory(db, 'トップス')
    await moveCategory(db, tops, -1)
    await saveProduct(db, shirt(bottoms, { name: 'デニム' }))
    await saveProduct(db, shirt(tops, { name: 'ニット' }))
    await saveProduct(db, shirt(tops, { name: 'カットソー' }))
    const names = (await loadCatalog(db)).products.map((p) => p.name)
    expect(names).toEqual(['カットソー', 'ニット', 'デニム'])
  })
})
