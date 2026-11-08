// 各テーブルに保存するデータの型(仕様書 §8)。
import type { PaymentMethod } from '../lib/payment'

// 金額はすべて円単位の整数。日時は ISO 8601 形式の文字列、営業日は 'YYYY-MM-DD'。

export type Category = {
  id: string
  name: string
  /** 並び順(小さいほど先) */
  sortOrder: number
  createdAt: string
}

export type Product = {
  id: string
  name: string
  categoryId: string
  /** 販売価格(税込) */
  priceIncl: number
  /** 仕入価格 */
  cost: number
  /** false なら削除済み(論理削除)。過去の売上が参照しているので実際には消さない */
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** 商品のサイズ × 色の組み合わせ1つ。在庫はここで持つ。 */
export type Variant = {
  id: string
  productId: string
  size: string
  color: string
  /** 在庫数。マイナスもあり得る(登録漏れに気づけるようにするため) */
  stock: number
  sizeOrder: number
  colorOrder: number
  isActive: boolean
}

/** 1回の会計 */
export type Sale = {
  id: string
  /** 会計番号 YYYYMMDD-NNN */
  saleNo: string
  businessDate: string
  soldAt: string
  totalIncl: number
  taxAmount: number
  totalExcl: number
  /** お預かり。キャッシュレスでは合計と同じ */
  received: number
  /** お釣り。キャッシュレスでは0 */
  change: number
  /** 支払い方法。v1.3 までのデータにはなく、現金として扱う(paymentMethodOf を使う) */
  paymentMethod?: PaymentMethod
}

/** 会計の明細。商品名などは会計した時点の値を書き写しておく */
export type SaleItem = {
  id: string
  saleId: string
  /** 会計の中で何行目か(0から)。カートに入れた順に表示するため。古いデータにはない */
  lineNo?: number
  variantId: string
  productName: string
  categoryName: string
  size: string
  color: string
  unitPriceIncl: number
  qty: number
  lineTotal: number
  /** 返品済みの数 */
  returnedQty: number
}

/** 1回の返品 */
export type Refund = {
  id: string
  saleId: string
  /** 返品した日の営業日(元の会計の日ではない) */
  businessDate: string
  refundedAt: string
  amountIncl: number
  taxAmount: number
  amountExcl: number
  memo: string
  /** 返金の方法。元の会計と同じ。ないときは現金(paymentMethodOf を使う) */
  paymentMethod?: PaymentMethod
}

export type RefundItem = {
  id: string
  refundId: string
  saleItemId: string
  qty: number
  amountIncl: number
}

/** 金種(1万円札〜1円玉)ごとの枚数。キーは額面 */
export type DenominationCounts = Partial<Record<'10000' | '5000' | '2000' | '1000' | '500' | '100' | '50' | '10' | '5' | '1', number>>

/** レジ締め。1営業日に1件 */
export type Closing = {
  businessDate: string
  openingFloat: number
  /** 以下3つは締めた時点の値を保存しておく */
  cashSales: number
  refundsTotal: number
  expected: number
  counts: DenominationCounts
  countedTotal: number
  /** 数えた現金 − レジにあるはずの現金 */
  difference: number
  memo: string
  closedAt: string
}
