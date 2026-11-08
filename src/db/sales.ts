// 会計の保存(仕様書 §5 F2、§9)。

import { newId } from '../lib/id'
import { isPaymentMethod, type PaymentMethod } from '../lib/payment'
import { calcChange, cartTotal, lineTotal, MAX_RECEIVED, taxOf } from '../lib/money'
import { businessDateOf, nowIso } from '../lib/time'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import { getSetting } from './settings'
import type { Sale, SaleItem } from './types'

export type SaleLineInput = { variantId: string; qty: number }

export type CreateSaleInput = {
  lines: SaleLineInput[]
  /** 支払い方法。省略すると現金 */
  paymentMethod?: PaymentMethod
  /** お預かり(現金のとき)。キャッシュレスでは使わず、合計と同じ金額を記録する */
  received: number
  /** 画面に表示していた合計。保存の直前に計算し直した合計と違えば保存しない */
  expectedTotal: number
}

/** 会計番号 YYYYMMDD-NNN の NNN を、その営業日の最大 + 1 にする */
async function nextSaleNo(db: AppDB, businessDate: string): Promise<string> {
  const prefix = businessDate.replaceAll('-', '')
  const sales = await db.sales.where('businessDate').equals(businessDate).toArray()
  const max = sales.reduce((m, s) => Math.max(m, Number(s.saleNo.split('-')[1]) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

/**
 * 会計を確定する。会計と明細の保存、在庫を減らす処理を1つのトランザクションで行う。
 * 合計は画面の値を信用せず、今の商品の価格から計算し直す。
 */
export async function createSale(
  db: AppDB,
  input: CreateSaleInput,
  at = new Date(),
): Promise<Sale & { items: SaleItem[] }> {
  if (input.lines.length === 0) throw new ValidationError('カートに商品がありません')
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new ValidationError('数量が正しくありません')
  }
  const paymentMethod = input.paymentMethod ?? 'cash'
  if (!isPaymentMethod(paymentMethod)) throw new ValidationError('支払い方法が正しくありません')
  const isCash = paymentMethod === 'cash'
  if (isCash && (!Number.isSafeInteger(input.received) || input.received < 0 || input.received > MAX_RECEIVED)) {
    throw new ValidationError('お預かりの金額が正しくありません')
  }

  return db.transaction('rw', [db.variants, db.products, db.categories, db.sales, db.saleItems, db.settings], async () => {
    const saleId = newId()
    const items: SaleItem[] = []
    const stockAfter: { id: string; stock: number }[] = []

    for (const line of input.lines) {
      const variant = await db.variants.get(line.variantId)
      const product = variant && (await db.products.get(variant.productId))
      if (!variant?.isActive || !product?.isActive) {
        throw new ValidationError('削除された商品がカートに入っています。カートから外してください')
      }
      const category = await db.categories.get(product.categoryId)
      items.push({
        id: newId(),
        saleId,
        lineNo: items.length,
        variantId: variant.id,
        productName: product.name,
        categoryName: category?.name ?? '',
        size: variant.size,
        color: variant.color,
        unitPriceIncl: product.priceIncl,
        qty: line.qty,
        lineTotal: lineTotal({ unitPriceIncl: product.priceIncl, qty: line.qty }),
        returnedQty: 0,
      })
      stockAfter.push({ id: variant.id, stock: variant.stock - line.qty })
    }

    const totalIncl = cartTotal(items)
    if (totalIncl !== input.expectedTotal) {
      throw new ValidationError('商品の価格が変わったため、合計が変わりました。カートの合計を確認してください')
    }
    // キャッシュレスは Square で合計ちょうどを受けているので、お預かり = 合計、お釣り = 0 とする
    const received = isCash ? input.received : totalIncl
    const result = calcChange(received, totalIncl)
    if (!result.ok) throw new ValidationError('お預かりが足りません')

    const taxAmount = taxOf(totalIncl, await getSetting(db, 'taxRate'))
    const businessDate = businessDateOf(at)
    const sale: Sale = {
      id: saleId,
      saleNo: await nextSaleNo(db, businessDate),
      businessDate,
      soldAt: nowIso(at),
      totalIncl,
      taxAmount,
      totalExcl: totalIncl - taxAmount,
      received,
      change: result.change,
      paymentMethod,
    }

    await db.sales.add(sale)
    await db.saleItems.bulkAdd(items)
    // 在庫は足りなくても減らす(マイナスになってよい。仕様書 §5 F2)
    for (const v of stockAfter) await db.variants.update(v.id, { stock: v.stock })

    return { ...sale, items }
  })
}
