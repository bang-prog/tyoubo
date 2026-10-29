import { useState } from 'react'
import { deleteProduct, saveProduct, type ProductView, type StockEntry } from '../../db/catalog'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import type { Category } from '../../db/types'
import { formatYen, splitTax } from '../../lib/money'
import styles from './ProductForm.module.css'

type Props = {
  categories: Category[]
  /** 編集する商品。なければ新しい商品 */
  product?: ProductView
  /** 保存したあとの「保存しました」 */
  notice: string | null
  onSaved: (id: string) => void
  onDeleted: () => void
  onCancel: () => void
}

const stockKey = (size: string, color: string) => `${size}\u0000${color}`

/** 「S, M、L」→ ['S', 'M', 'L']。カンマと読点のどちらで区切ってもよい */
function splitList(text: string): string[] {
  return [...new Set(text.split(/[,、]/).map((s) => s.trim()).filter(Boolean))]
}

/** 空なら null。数字以外が入っていても null */
function toInt(text: string): number | null {
  if (!/^-?\d+$/.test(text)) return null
  return Number(text)
}

/** 商品の登録・編集フォーム。 */
export default function ProductForm({ categories, product, notice, onSaved, onDeleted, onCancel }: Props) {
  // 入力中の値は文字列で持ち、保存するときに数値にする
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '')
  const [price, setPrice] = useState(product ? String(product.priceIncl) : '')
  const [cost, setCost] = useState(product ? String(product.cost) : '')
  const [sizesText, setSizesText] = useState(product ? product.sizes.join(', ') : 'S, M, L')
  const [colorsText, setColorsText] = useState(product ? product.colors.join(', ') : '')
  // 在庫は「サイズと色の名前」で覚えておく。サイズや色を打ち直しても、同じ名前に戻せば数が残る
  const [stocks, setStocks] = useState<Record<string, string>>(() =>
    Object.fromEntries((product?.variants ?? []).map((v) => [stockKey(v.size, v.color), String(v.stock)])),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // 選んでいるカテゴリーが一覧にないとき(入力欄を開いたあとにカテゴリーを追加・削除したとき)は、
  // 選択欄に見えている先頭のカテゴリーを使う。見た目と保存する値を食い違わせないため
  const selectedCategoryId = categories.some((c) => c.id === categoryId) ? categoryId : (categories[0]?.id ?? '')
  const sizes = splitList(sizesText)
  const colors = splitList(colorsText)
  const priceNum = toInt(price)
  const breakdown = priceNum !== null && priceNum > 0 ? splitTax(priceNum) : null

  async function handleSave() {
    setError(null)
    const priceIncl = toInt(price)
    const costNum = toInt(cost)
    if (priceIncl === null) return setError('販売価格を入力してください')
    if (costNum === null) return setError('仕入価格を入力してください')

    const entries: StockEntry[] = []
    for (const color of colors) {
      for (const size of sizes) {
        const text = stocks[stockKey(size, color)] ?? ''
        const stock = text === '' ? 0 : toInt(text)
        if (stock === null) return setError(`在庫数(${color} / ${size})は整数で入力してください`)
        entries.push({ size, color, stock })
      }
    }

    setSaving(true)
    try {
      const id = await saveProduct(
        db,
        { name, categoryId: selectedCategoryId, priceIncl, cost: costNum, sizes, colors, stocks: entries },
        product?.id,
      )
      onSaved(id)
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    try {
      await deleteProduct(db, product.id)
      onDeleted()
    } catch (e) {
      setError(userMessage(e))
    }
  }

  if (categories.length === 0) {
    return (
      <div className="panel">
        <h2 className={styles.title}>新しい商品</h2>
        <p className="hint">先に、下の「カテゴリー」でカテゴリーを追加してください。</p>
      </div>
    )
  }

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSave()
      }}
    >
      <h2 className={styles.title}>{product ? '商品を編集' : '新しい商品'}</h2>
      {notice && <p className="notice">{notice}</p>}

      <label className={styles.field}>
        商品名
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例:オックスフォードシャツ" />
      </label>

      <label className={styles.field}>
        カテゴリー
        <select className="input" value={selectedCategoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.two}>
        <label className={styles.field}>
          販売価格(税込)
          <input
            className={`input num ${styles.yen}`}
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
          />
          <span className={styles.help}>
            {breakdown ? `税抜 ${formatYen(breakdown.excl)} / 消費税 ${formatYen(breakdown.tax)}` : '税込の金額を入れます'}
          </span>
        </label>
        <label className={styles.field}>
          仕入価格
          <input
            className={`input num ${styles.yen}`}
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
          />
        </label>
      </div>

      <div className={styles.two}>
        <label className={styles.field}>
          サイズ
          <input className="input" value={sizesText} onChange={(e) => setSizesText(e.target.value)} placeholder="例:S, M, L" />
          <span className={styles.help}>カンマで区切る(F はフリー)</span>
        </label>
        <label className={styles.field}>
          色
          <input className="input" value={colorsText} onChange={(e) => setColorsText(e.target.value)} placeholder="例:白, 黒" />
          <span className={styles.help}>カンマで区切る</span>
        </label>
      </div>

      <div className={styles.field}>
        在庫数
        {sizes.length > 0 && colors.length > 0 ? (
          <div className={styles.stockWrap}>
            <table className={styles.stockGrid}>
              <thead>
                <tr>
                  <th />
                  {sizes.map((size) => (
                    <th key={size}>{size === 'F' ? 'フリー' : size}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colors.map((color) => (
                  <tr key={color}>
                    <th className={styles.colorName}>{color}</th>
                    {sizes.map((size) => {
                      const key = stockKey(size, color)
                      const value = stocks[key] ?? ''
                      return (
                        <td key={size}>
                          <input
                            className={`num ${styles.stockInput} ${value.startsWith('-') ? styles.negative : ''}`}
                            inputMode="numeric"
                            value={value}
                            placeholder="0"
                            aria-label={`${color} ${size} の在庫数`}
                            onChange={(e) => {
                              const next = e.target.value.replace(/[^\d-]/g, '')
                              setStocks((prev) => ({ ...prev, [key]: next }))
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <span className={styles.help}>サイズと色を入れると、在庫数の表が出ます。</span>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {confirmingDelete ? (
        <div className={styles.confirm}>
          <p>「{product?.name}」を削除します。会計の画面に出なくなります(過去の売上の記録は残ります)。</p>
          <div className={styles.actions}>
            <button type="button" className="btn btn-danger" onClick={() => void handleDelete()}>
              削除する
            </button>
            <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
              やめる
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="submit" className={`btn btn-primary ${styles.save}`} disabled={saving}>
            保存
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            閉じる
          </button>
          {product && (
            <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
              削除
            </button>
          )}
        </div>
      )}
    </form>
  )
}
