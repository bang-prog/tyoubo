import { describe, expect, it } from 'vitest'
import type { ProductView } from '../db/catalog'
import { buildCartView, cartReducer, cartViewTotal, type CartAction, type CartLine } from './cart'

const run = (...actions: CartAction[]): CartLine[] => actions.reduce(cartReducer, [])

describe('cartReducer', () => {
  it('同じものを入れると数量が増え、別のものは後ろに足される', () => {
    expect(run({ type: 'add', variantId: 'a' }, { type: 'add', variantId: 'b' }, { type: 'add', variantId: 'a' })).toEqual([
      { variantId: 'a', qty: 2 },
      { variantId: 'b', qty: 1 },
    ])
  })

  it('数量を減らし、0点になったらカートから消える', () => {
    const lines = run({ type: 'add', variantId: 'a' }, { type: 'add', variantId: 'a' }, { type: 'add', variantId: 'b' })
    expect(cartReducer(lines, { type: 'decrement', variantId: 'a' })).toEqual([
      { variantId: 'a', qty: 1 },
      { variantId: 'b', qty: 1 },
    ])
    expect(cartReducer(lines, { type: 'decrement', variantId: 'b' })).toEqual([{ variantId: 'a', qty: 2 }])
  })

  it('すべて取り消す', () => {
    expect(cartReducer(run({ type: 'add', variantId: 'a' }), { type: 'clear' })).toEqual([])
  })
})

function product(id: string, priceIncl: number, variantIds: string[]): ProductView {
  const variants = variantIds.map((vid, i) => ({
    id: vid,
    productId: id,
    size: ['S', 'M', 'L'][i],
    color: '白',
    stock: 2,
    sizeOrder: i,
    colorOrder: 0,
    isActive: true,
  }))
  return {
    id,
    name: `商品${id}`,
    categoryId: 'c',
    priceIncl,
    cost: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    categoryName: 'トップス',
    sizes: variants.map((v) => v.size),
    colors: ['白'],
    variants,
    totalStock: variants.length * 2,
    hasNegative: false,
  }
}

describe('buildCartView', () => {
  const products = [product('1', 6980, ['v1', 'v2']), product('2', 990, ['v3'])]

  it('商品名・価格・小計を商品データから引く', () => {
    const items = buildCartView(
      [
        { variantId: 'v2', qty: 1 },
        { variantId: 'v3', qty: 3 },
      ],
      products,
    )
    expect(items.map((i) => [i.productName, i.size, i.unitPriceIncl, i.lineTotal])).toEqual([
      ['商品1', 'M', 6980, 6980],
      ['商品2', 'S', 990, 2970],
    ])
    expect(cartViewTotal(items)).toBe(9950)
  })

  it('削除された商品は使えない印を付け、合計に入れない', () => {
    const items = buildCartView(
      [
        { variantId: 'v1', qty: 1 },
        { variantId: 'gone', qty: 1 },
      ],
      products,
    )
    expect(items[1].available).toBe(false)
    expect(cartViewTotal(items)).toBe(6980)
  })
})
