// 返品の保存(仕様書 §5 F3、§9)。

import { newId } from '../lib/id'
import { paymentMethodOf } from '../lib/payment'
import { taxOf } from '../lib/money'
import { businessDateOf, nowIso } from '../lib/time'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import { getSetting } from './settings'
import type { Refund, RefundItem } from './types'

export type RefundLineInput = { saleItemId: string; qty: number }

export type CreateRefundInput = {
  saleId: string
  items: RefundLineInput[]
  memo?: string
}

/**
 * 返品を確定する。返品と返品の明細の保存、明細の返品済みの数、在庫を戻す処理を1つのトランザクションで行う。
 * 返金は返品した日の営業日に記録する。元の会計の金額は変えない。
 */
export async function createRefund(
  db: AppDB,
  input: CreateRefundInput,
  at = new Date(),
): Promise<Refund & { items: RefundItem[] }> {
  if (input.items.length === 0) throw new ValidationError('返品する商品を選んでください')
  for (const line of input.items) {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new ValidationError('返品する数が正しくありません')
  }
  if (new Set(input.items.map((i) => i.saleItemId)).size !== input.items.length) {
    throw new ValidationError('同じ商品が重なっています')
  }

  return db.transaction(
    'rw',
    [db.sales, db.saleItems, db.refunds, db.refundItems, db.variants, db.settings],
    async () => {
      const sale = await db.sales.get(input.saleId)
      if (!sale) throw new ValidationError('この会計は見つかりません')

      const refundId = newId()
      const items: RefundItem[] = []
      const updates: { saleItemId: string; returnedQty: number; variantId: string; qty: number }[] = []

      for (const line of input.items) {
        const saleItem = await db.saleItems.get(line.saleItemId)
        if (!saleItem || saleItem.saleId !== sale.id) throw new ValidationError('この会計にない商品が含まれています')
        const remaining = saleItem.qty - saleItem.returnedQty
        if (line.qty > remaining) {
          throw new ValidationError(`「${saleItem.productName}」は、あと${remaining}点までしか返品できません`)
        }
        items.push({
          id: newId(),
          refundId,
          saleItemId: saleItem.id,
          qty: line.qty,
          amountIncl: saleItem.unitPriceIncl * line.qty,
        })
        updates.push({
          saleItemId: saleItem.id,
          returnedQty: saleItem.returnedQty + line.qty,
          variantId: saleItem.variantId,
          qty: line.qty,
        })
      }

      const amountIncl = items.reduce((sum, i) => sum + i.amountIncl, 0)
      // 消費税は会計と同じく、1回の返品の合計からまとめて計算する(仕様書 §6)
      const taxAmount = taxOf(amountIncl, await getSetting(db, 'taxRate'))
      const refund: Refund = {
        id: refundId,
        saleId: sale.id,
        businessDate: businessDateOf(at),
        refundedAt: nowIso(at),
        amountIncl,
        taxAmount,
        amountExcl: amountIncl - taxAmount,
        memo: input.memo?.trim() ?? '',
        // 返金は元の会計と同じ方法で行う(キャッシュレスは Square のアプリで返金する)
        paymentMethod: paymentMethodOf(sale),
      }

      await db.refunds.add(refund)
      await db.refundItems.bulkAdd(items)
      for (const u of updates) {
        await db.saleItems.update(u.saleItemId, { returnedQty: u.returnedQty })
        // 在庫を戻す。商品やサイズ・色が削除済みでも、在庫の数は戻しておく
        const variant = await db.variants.get(u.variantId)
        if (variant) await db.variants.update(variant.id, { stock: variant.stock + u.qty })
      }

      return { ...refund, items }
    },
  )
}
