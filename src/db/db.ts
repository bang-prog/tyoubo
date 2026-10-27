import Dexie, { type EntityTable } from 'dexie'
import type { SettingRow } from './settings'
import type { Category, Closing, Product, Refund, RefundItem, Sale, SaleItem, Variant } from './types'

export const DB_NAME = 'tyoubo'

export type AppDB = Dexie & {
  categories: EntityTable<Category, 'id'>
  products: EntityTable<Product, 'id'>
  variants: EntityTable<Variant, 'id'>
  sales: EntityTable<Sale, 'id'>
  saleItems: EntityTable<SaleItem, 'id'>
  refunds: EntityTable<Refund, 'id'>
  refundItems: EntityTable<RefundItem, 'id'>
  closings: EntityTable<Closing, 'businessDate'>
  settings: EntityTable<SettingRow, 'key'>
}

/**
 * テーブルの定義。先頭が主キー、残りは検索や並べ替えに使う索引。
 * ここに書いていない項目(name や金額など)も保存される。
 *  - & は重複してはいけない索引
 *  - [a+b] は2つの項目を組み合わせた索引
 * true / false は IndexedDB の索引に使えないので、isActive は索引にせず読み込んだあとで絞り込む。
 * 形を変えるときは version(1) を残したまま version(2) を書き足す(仕様書 §8)。
 */
const SCHEMA_V1 = {
  categories: 'id, sortOrder',
  products: 'id, categoryId, name',
  variants: 'id, productId, &[productId+size+color]',
  sales: 'id, &saleNo, businessDate',
  saleItems: 'id, saleId, variantId',
  refunds: 'id, saleId, businessDate',
  refundItems: 'id, refundId, saleItemId',
  closings: 'businessDate',
  settings: 'key',
}

/** データベースを作る。テストでは毎回別の名前で作り、本番のデータと混ざらないようにする。 */
export function createDB(name = DB_NAME): AppDB {
  const db = new Dexie(name) as AppDB
  db.version(1).stores(SCHEMA_V1)
  return db
}

/** アプリ全体で使うデータベース。実際に開くのは最初に読み書きしたとき。 */
export const db = createDB()
