// カートの中身(仕様書 §5 F2)。
// カートには「どのバリエーションを何点」だけを持ち、商品名や価格は表示するたびに商品データから引く。
// あとから商品管理で価格を変えても、カートの表示がずれないようにするため。

import type { ProductView } from '../db/catalog'
import { cartTotal } from './money'

export type CartLine = { variantId: string; qty: number }

export type CartAction =
  | { type: 'add'; variantId: string }
  | { type: 'decrement'; variantId: string }
  | { type: 'clear' }

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add':
      return lines.some((l) => l.variantId === action.variantId)
        ? lines.map((l) => (l.variantId === action.variantId ? { ...l, qty: l.qty + 1 } : l))
        : [...lines, { variantId: action.variantId, qty: 1 }]
    case 'decrement':
      // 0点になったらカートから消す
      return lines.flatMap((l) => (l.variantId !== action.variantId ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []))
    case 'clear':
      return []
  }
}

export type CartItemView = {
  variantId: string
  qty: number
  /** false なら、カートに入れたあとに商品やサイズ・色が削除された */
  available: boolean
  productName: string
  size: string
  color: string
  unitPriceIncl: number
  lineTotal: number
  stock: number
}

/** カートの中身を、表示に必要な情報と合わせる。 */
export function buildCartView(lines: CartLine[], products: ProductView[]): CartItemView[] {
  const byVariant = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)))
  return lines.map((line) => {
    const found = byVariant.get(line.variantId)
    if (!found) {
      return {
        variantId: line.variantId,
        qty: line.qty,
        available: false,
        productName: '(削除された商品)',
        size: '',
        color: '',
        unitPriceIncl: 0,
        lineTotal: 0,
        stock: 0,
      }
    }
    const { product, variant } = found
    return {
      variantId: line.variantId,
      qty: line.qty,
      available: true,
      productName: product.name,
      size: variant.size,
      color: variant.color,
      unitPriceIncl: product.priceIncl,
      lineTotal: product.priceIncl * line.qty,
      stock: variant.stock,
    }
  })
}

/** カートの税込合計。削除された商品は含めない。 */
export function cartViewTotal(items: CartItemView[]): number {
  return cartTotal(items.filter((i) => i.available))
}
