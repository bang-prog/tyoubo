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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                {product.sizes.map((size) => (
                  <th key={size}>{sizeLabel(size)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.colors.map((color) => (
                <tr key={color}>
                  <th className={styles.color}>{color}</th>
                  {product.sizes.map((size) => {
                    const v = find(size, color)
                    return (
                      <td key={size}>
                        {v && (
                          <button
                            type="button"
                            className={v.stock > 0 ? styles.cell : `${styles.cell} ${styles.zero}`}
                            onClick={() => onPick(v)}
                          >
                            <span className={styles.size}>{sizeLabel(size)}</span>
                            <small className="num">在庫 {v.stock}</small>
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
