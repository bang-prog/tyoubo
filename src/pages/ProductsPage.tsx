import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import CategoryPanel from '../components/products/CategoryPanel'
import ProductForm from '../components/products/ProductForm'
import ProductList from '../components/products/ProductList'
import { loadCatalog } from '../db/catalog'
import { db } from '../db/db'
import styles from './ProductsPage.module.css'

/** 選んでいるもの:商品の id、新しい商品('new')、なにも選んでいない(null) */
type Selection = string | 'new' | null

export default function ProductsPage() {
  // データベースが変わると、自動で読み込み直して画面を描き直す
  const catalog = useLiveQuery(() => loadCatalog(db), [])
  const [selected, setSelected] = useState<Selection>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const pageRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(timer)
  }, [flash])

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of catalog?.products ?? []) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1)
    return counts
  }, [catalog])

  if (!catalog) {
    return (
      <section className={styles.page}>
        <p className="hint">読み込み中…</p>
      </section>
    )
  }

  const product = selected && selected !== 'new' ? catalog.products.find((p) => p.id === selected) : undefined
  const showForm = selected === 'new' || product !== undefined

  function select(next: Selection) {
    setSelected(next)
    setFlash(null)
    // スマホでは一覧と入力欄が入れ替わるので、いちばん上から見せる
    pageRef.current?.scrollTo({ top: 0 })
  }

  return (
    <section ref={pageRef} className={styles.page}>
      {/* スマホでは一覧と入力欄のどちらか一方だけを全面に出す(仕様書 §10.1) */}
      <div className={styles.grid} data-view={showForm ? 'form' : 'list'}>
        <div className={styles.left}>
          <ProductList
            products={catalog.products}
            categories={catalog.categories}
            selectedId={product?.id ?? null}
            onSelect={select}
            onAdd={() => select('new')}
          />
          <CategoryPanel categories={catalog.categories} productCounts={productCounts} />
        </div>

        <div className={styles.right}>
          {showForm && (
            <button type="button" className={`btn btn-sm ${styles.back}`} onClick={() => select(null)}>
              ‹ 一覧に戻る
            </button>
          )}
          {showForm ? (
            <ProductForm
              // 別の商品を選んだら、入力欄を作り直して中身を入れ替える
              key={product?.id ?? 'new'}
              categories={catalog.categories}
              product={product}
              notice={flash}
              onSaved={(id) => {
                setSelected(id)
                setFlash('保存しました')
              }}
              onDeleted={() => select(null)}
              onCancel={() => select(null)}
            />
          ) : (
            <div className={`panel ${styles.placeholder}`}>
              <p className="hint">一覧から商品を選ぶか、「＋ 商品を追加」を押してください。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
