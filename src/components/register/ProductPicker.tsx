import { useState } from 'react'
import { Link } from 'react-router'
import type { ProductView } from '../../db/catalog'
import type { Category } from '../../db/types'
import { formatYen } from '../../lib/money'
import styles from './ProductPicker.module.css'

type Props = {
  categories: Category[]
  products: ProductView[]
  onPick: (product: ProductView) => void
}

/** 会計画面の左側。カテゴリーで絞り込み、売れた商品をタップする。 */
export default function ProductPicker({ categories, products, onPick }: Props) {
  const [categoryId, setCategoryId] = useState('')

  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p>商品がまだ登録されていません。</p>
        <Link to="/products" className="btn btn-primary">
          商品管理を開く
        </Link>
      </div>
    )
  }

  // 商品のあるカテゴリーだけをボタンにする
  const used = categories.filter((c) => products.some((p) => p.categoryId === c.id))
  // 選んでいたカテゴリーの商品がなくなったら「すべて」に戻す
  const current = used.some((c) => c.id === categoryId) ? categoryId : ''
  const shown = products.filter((p) => !current || p.categoryId === current)

  return (
    <div className={styles.picker}>
      <div className={styles.chips} role="group" aria-label="カテゴリーで絞り込む">
        <button type="button" className={styles.chip} aria-pressed={current === ''} onClick={() => setCategoryId('')}>
          すべて
        </button>
        {used.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.chip}
            aria-pressed={current === c.id}
            onClick={() => setCategoryId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {shown.map((p) => (
          <button key={p.id} type="button" className={styles.card} onClick={() => onPick(p)}>
            <span className={styles.category}>{p.categoryName}</span>
            <span className={styles.name}>{p.name}</span>
            <span className={`num ${styles.price}`}>{formatYen(p.priceIncl)}</span>
            <span className={p.totalStock > 0 ? styles.stock : `${styles.stock} ${styles.out}`}>
              {p.totalStock > 0 ? `在庫 ${p.totalStock}` : '在庫なし'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
