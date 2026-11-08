import type { ProductView } from '../../db/catalog'
import type { Variant } from '../../db/types'
import { sizeLabel } from '../../lib/labels'
import { formatYen } from '../../lib/money'
import Modal from '../Modal'
import styles from './VariantDialog.module.css'

type Props = {
  product: ProductView
  onPick: (variant: Variant) => void
  onClose: () => void
}

/** サイズと色を選ぶ画面。選ぶとカートに入る。 */
export default function VariantDialog({ product, onPick, onClose }: Props) {
  const find = (size: string, color: string) => product.variants.find((v) => v.size === size && v.color === color)

  return (
    <Modal labelledBy="variant-title" onClose={onClose} maxWidth={720}>
      <div className={styles.body}>
        <div className={styles.head}>
          <div>
            <h2 id="variant-title" className={styles.title}>
              {product.name}
            </h2>
            <p className={`num ${styles.price}`}>{formatYen(product.priceIncl)}(税込)</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            閉じる
          </button>
        </div>
        <p className="hint">色とサイズを選ぶと、お会計に追加されます。</p>

        {/* 色ごとに、サイズのボタンを画面の幅で折り返して並べる(スマホでも横スクロールしない) */}
        <div className={styles.groups}>
          {product.colors.map((color) => (
            <section key={color} className={styles.group} aria-label={color}>
              <h3 className={styles.color}>{color}</h3>
              <div className={styles.cells}>
                {product.sizes.map((size) => {
                  const v = find(size, color)
                  return (
                    v && (
                      <button
                        key={size}
                        type="button"
                        className={v.stock > 0 ? styles.cell : `${styles.cell} ${styles.zero}`}
                        onClick={() => onPick(v)}
                        aria-label={`${color} ${sizeLabel(size)}(在庫 ${v.stock})`}
                      >
                        <span className={styles.size}>{sizeLabel(size)}</span>
                        <small className="num">在庫 {v.stock}</small>
                      </button>
                    )
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  )
}
