import { useState } from 'react'
import type { ProductView } from '../../db/catalog'
import type { Category } from '../../db/types'
import { formatYen } from '../../lib/money'
import styles from './ProductList.module.css'

type Props = {
  products: ProductView[]
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}

/** 商品の一覧。商品名で検索、カテゴリーで絞り込みができる。 */
export default function ProductList({ products, categories, selectedId, onSelect, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const q = query.trim()
  const shown = products.filter((p) => (!categoryId || p.categoryId === categoryId) && (!q || p.name.includes(q)))

  return (
    <div className="panel">
      <div className={styles.toolbar}>
        <h2 className={styles.title}>商品</h2>
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          ＋ 商品を追加
        </button>
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          className={`input ${styles.search}`}
          placeholder="商品名で探す"
          aria-label="商品名で探す"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`input ${styles.select}`}
          aria-label="カテゴリーで絞り込む"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">すべてのカテゴリー</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {products.length === 0 ? (
        <p className={styles.empty}>まだ商品がありません。「＋ 商品を追加」から登録してください。</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>条件に合う商品はありません。</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>商品名</th>
                <th className={styles.wide}>カテゴリー</th>
                <th className={styles.r}>税込価格</th>
                <th className={`${styles.r} ${styles.wide}`}>仕入価格</th>
                <th className={styles.r}>在庫</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={p.id === selectedId ? styles.selected : undefined} onClick={() => onSelect(p.id)}>
                  <td>
                    {/* 行全体をタップ・クリックでも選べるが、キーボードでも選べるように名前はボタンにする */}
                    <button type="button" className={styles.nameButton} onClick={() => onSelect(p.id)}>
                      {p.name}
                    </button>
                    {/* スマホではカテゴリーの列を省き、商品名の下に出す */}
                    <small className={styles.narrow}>{p.categoryName}</small>
                  </td>
                  <td className={styles.wide}>{p.categoryName}</td>
                  <td className={`num ${styles.r}`}>{formatYen(p.priceIncl)}</td>
                  <td className={`num ${styles.r} ${styles.wide}`}>{formatYen(p.cost)}</td>
                  <td className={`num ${styles.r}`}>
                    {p.hasNegative ? (
                      <span className="badge badge-bad">{p.totalStock}(マイナスあり)</span>
                    ) : p.totalStock <= 0 ? (
                      <span className="badge badge-warn">{p.totalStock}</span>
                    ) : (
                      p.totalStock
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
