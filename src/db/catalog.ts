// カテゴリーと商品の読み書き(仕様書 §5 F1)。

import { newId } from '../lib/id'
import { MAX_RECEIVED } from '../lib/money'
import { nowIso } from '../lib/time'
import { canonicalOption, hasOption, MAX_OPTION_LENGTH, MAX_OPTIONS, optionKey, type OptionKind } from '../lib/variantOptions'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import type { Category, Product, Variant } from './types'

/** サイズと色の組み合わせのキー。全角・半角や大文字・小文字の違いは同じものとして扱う */
const variantKey = (size: string, color: string) => `${optionKey(size)}\u0000${optionKey(color)}`

function cleanName(value: string, label: string): string {
  const name = value.trim()
  if (!name) throw new ValidationError(`${label}を入力してください`)
  return name
}

// ---------- カテゴリー ----------

export async function addCategory(db: AppDB, name: string): Promise<string> {
  const clean = cleanName(name, 'カテゴリー名')
  return db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray()
    if (all.some((c) => c.name === clean)) throw new ValidationError(`カテゴリー「${clean}」はすでにあります`)
    const id = newId()
    const sortOrder = Math.max(0, ...all.map((c) => c.sortOrder)) + 1
    await db.categories.add({ id, name: clean, sortOrder, createdAt: nowIso() })
    return id
  })
}

export async function renameCategory(db: AppDB, id: string, name: string): Promise<void> {
  const clean = cleanName(name, 'カテゴリー名')
  await db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray()
    if (all.some((c) => c.id !== id && c.name === clean)) {
      throw new ValidationError(`カテゴリー「${clean}」はすでにあります`)
    }
    await db.categories.update(id, { name: clean })
  })
}

/** 並び順を1つ上(-1)か下(+1)に動かす。端ならなにもしない。 */
export async function moveCategory(db: AppDB, id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const list = await db.categories.orderBy('sortOrder').toArray()
    const i = list.findIndex((c) => c.id === id)
    const j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    await db.categories.update(list[i].id, { sortOrder: list[j].sortOrder })
    await db.categories.update(list[j].id, { sortOrder: list[i].sortOrder })
  })
}

/** 商品が登録されているカテゴリーは削除できない。 */
export async function deleteCategory(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.products, async () => {
    const count = await db.products
      .where('categoryId')
      .equals(id)
      .filter((p) => p.isActive)
      .count()
    if (count > 0) throw new ValidationError(`このカテゴリーには商品が${count}件あるため削除できません`)
    await db.categories.delete(id)
  })
}

// ---------- 商品 ----------

export type StockEntry = { size: string; color: string; stock: number }

export type ProductInput = {
  name: string
  categoryId: string
  priceIncl: number
  cost: number
  sizes: string[]
  colors: string[]
  /** サイズ × 色ごとの在庫数。書いていない組み合わせは0 */
  stocks: StockEntry[]
}

function checkPrice(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_RECEIVED) {
    throw new ValidationError(`${label}は0〜${MAX_RECEIVED.toLocaleString('ja-JP')}円の整数で入力してください`)
  }
}

/**
 * サイズや色の一覧をそろえる。全角の英数字や余分な空白は直し、決まった書き方のあるサイズは大文字にする(canonicalOption)。
 * 大文字・小文字だけが違うもの(「m」と「M」)は同じものとして重なりを見つける。
 */
function cleanList(values: string[], kind: OptionKind): string[] {
  const label = kind === 'size' ? 'サイズ' : '色'
  const out: string[] = []
  for (const value of values) {
    const v = canonicalOption(value, kind)
    if (!v) continue
    if (v.length > MAX_OPTION_LENGTH) throw new ValidationError(`${label}「${v}」は${MAX_OPTION_LENGTH}文字までにしてください`)
    if (hasOption(out, v)) throw new ValidationError(`${label}「${v}」が重なっています`)
    out.push(v)
  }
  if (out.length === 0) throw new ValidationError(`${label}を1つ以上入力してください`)
  if (out.length > MAX_OPTIONS[kind]) throw new ValidationError(`${label}は${MAX_OPTIONS[kind]}個までです`)
  return out
}

/**
 * 商品を保存する。id を渡すと既存の商品を更新する。
 * サイズや色を減らしたときのバリエーションは消さずに論理削除し、同じ組み合わせが戻ったら元のものを使い直す。
 */
export async function saveProduct(db: AppDB, input: ProductInput, id?: string): Promise<string> {
  const name = cleanName(input.name, '商品名')
  checkPrice(input.priceIncl, '販売価格')
  checkPrice(input.cost, '仕入価格')
  const sizes = cleanList(input.sizes, 'size')
  const colors = cleanList(input.colors, 'color')
  const stockOf = new Map<string, number>()
  for (const s of input.stocks) {
    if (!Number.isSafeInteger(s.stock)) {
      throw new ValidationError(`在庫数(${s.color} / ${s.size})は整数で入力してください`)
    }
    stockOf.set(variantKey(s.size, s.color), s.stock)
  }

  return db.transaction('rw', db.categories, db.products, db.variants, async () => {
    if (!(await db.categories.get(input.categoryId))) throw new ValidationError('カテゴリーを選んでください')

    const now = nowIso()
    const productId = id ?? newId()
    const fields = { name, categoryId: input.categoryId, priceIncl: input.priceIncl, cost: input.cost }
    if (id) {
      const existing = await db.products.get(id)
      if (!existing?.isActive) throw new ValidationError('この商品は削除されています')
      await db.products.update(id, { ...fields, updatedAt: now })
    } else {
      await db.products.add({ id: productId, ...fields, isActive: true, createdAt: now, updatedAt: now })
    }

    const existingVariants = await db.variants.where('productId').equals(productId).toArray()
    // 書き方だけが違う同じ組み合わせ(「Ｍ」と「M」など)が前から2つあるときは、使っている方を選ぶ
    const byKey = new Map<string, Variant>()
    for (const v of existingVariants) {
      const key = variantKey(v.size, v.color)
      const other = byKey.get(key)
      if (!other || (v.isActive && !other.isActive)) byKey.set(key, v)
    }
    /** 使い続けるバリエーションの id */
    const kept = new Set<string>()
    for (const [colorOrder, color] of colors.entries()) {
      for (const [sizeOrder, size] of sizes.entries()) {
        const key = variantKey(size, color)
        const stock = stockOf.get(key) ?? 0
        const found = byKey.get(key)
        if (found) {
          kept.add(found.id)
          // 名前の書き方(全角・半角など)が変わっていたら、そろえた名前に直す。ほかの行がもうその名前なら、重なるので直さない。
          // 過去の売上は会計時の名前を書き写しているので変わらない
          const taken = existingVariants.some((o) => o.id !== found.id && o.size === size && o.color === color)
          const names = taken ? {} : { size, color }
          await db.variants.update(found.id, { ...names, stock, sizeOrder, colorOrder, isActive: true })
        } else {
          await db.variants.add({ id: newId(), productId, size, color, stock, sizeOrder, colorOrder, isActive: true })
        }
      }
    }
    for (const v of existingVariants) {
      if (v.isActive && !kept.has(v.id)) await db.variants.update(v.id, { isActive: false })
    }
    return productId
  })
}

/** 商品を削除する(論理削除)。過去の売上から参照されているので、データは残す。 */
export async function deleteProduct(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.products, db.variants, async () => {
    await db.products.update(id, { isActive: false, updatedAt: nowIso() })
    await db.variants.where('productId').equals(id).modify({ isActive: false })
  })
}

// ---------- 画面に表示するための読み込み ----------

export type ProductView = Product & {
  categoryName: string
  /** 並び順どおりのサイズと色 */
  sizes: string[]
  colors: string[]
  variants: Variant[]
  totalStock: number
  /** 在庫がマイナスのバリエーションがある */
  hasNegative: boolean
}

export type Catalog = {
  categories: Category[]
  products: ProductView[]
}

/** 削除していないカテゴリーと商品を、並び順どおりに読み込む。 */
export async function loadCatalog(db: AppDB): Promise<Catalog> {
  const [categories, products, variants] = await Promise.all([
    db.categories.orderBy('sortOrder').toArray(),
    db.products.toArray(),
    db.variants.toArray(),
  ])
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const variantsByProduct = new Map<string, Variant[]>()
  for (const v of variants) {
    if (!v.isActive) continue
    const list = variantsByProduct.get(v.productId) ?? []
    list.push(v)
    variantsByProduct.set(v.productId, list)
  }

  const views = products
    .filter((p) => p.isActive)
    .map((p): ProductView => {
      const vs = (variantsByProduct.get(p.id) ?? []).sort(
        (a, b) => a.colorOrder - b.colorOrder || a.sizeOrder - b.sizeOrder,
      )
      const sizes = [...vs].sort((a, b) => a.sizeOrder - b.sizeOrder).map((v) => v.size)
      const colors = vs.map((v) => v.color)
      return {
        ...p,
        categoryName: categoryById.get(p.categoryId)?.name ?? '',
        sizes: [...new Set(sizes)],
        colors: [...new Set(colors)],
        variants: vs,
        totalStock: vs.reduce((sum, v) => sum + v.stock, 0),
        hasNegative: vs.some((v) => v.stock < 0),
      }
    })
    .sort(
      (a, b) =>
        (categoryById.get(a.categoryId)?.sortOrder ?? 0) - (categoryById.get(b.categoryId)?.sortOrder ?? 0) ||
        a.name.localeCompare(b.name, 'ja'),
    )

  return { categories, products: views }
}
