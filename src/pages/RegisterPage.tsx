import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import ChangeDialog from '../components/ChangeDialog'
import PayDialog from '../components/PayDialog'
import CartPanel from '../components/register/CartPanel'
import ProductPicker from '../components/register/ProductPicker'
import VariantDialog from '../components/register/VariantDialog'
import { useBackupDownload } from '../components/useBackupDownload'
import { loadBackupDue } from '../db/backup'
import { loadCatalog, type ProductView } from '../db/catalog'
import { db } from '../db/db'
import { userMessage } from '../db/errors'
import { createSale } from '../db/sales'
import type { Variant } from '../db/types'
import { buildCartView, cartViewTotal } from '../lib/cart'
import { sizeLabel } from '../lib/labels'
import { useCart } from '../state/CartContext'
import styles from './RegisterPage.module.css'

type Done = { saleNo: string; total: number; received: number; change: number }
type Toast = { text: string; warn: boolean }

/** 会計画面(仕様書 §5 F2)。商品を選んでカートに入れ、お預かりを入力して会計を確定する。 */
export default function RegisterPage() {
  const catalog = useLiveQuery(() => loadCatalog(db), [])
  // 最後のバックアップから7日以上たったら、上に注意を出す(仕様書 §5 F2)
  const backupDue = useLiveQuery(() => loadBackupDue(db), [])
  const backup = useBackupDownload()
  const { lines, dispatch } = useCart()
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.warn ? 3200 : 1800)
    return () => clearTimeout(timer)
  }, [toast])

  if (!catalog) {
    return (
      <section className={styles.page}>
        <p className="hint">読み込み中…</p>
      </section>
    )
  }

  const items = buildCartView(lines, catalog.products)
  const total = cartViewTotal(items)
  const picking = pickingId ? catalog.products.find((p) => p.id === pickingId) : undefined

  /** カートに1点入れる。在庫を超えるときは警告するが、入れることはできる */
  function addOne(variantId: string, label: string, stock: number) {
    const inCart = lines.find((l) => l.variantId === variantId)?.qty ?? 0
    dispatch({ type: 'add', variantId })
    setToast(
      inCart + 1 > stock
        ? { warn: true, text: `在庫が${stock}点の商品です。在庫の登録漏れがないか確認してください` }
        : { warn: false, text: `${label}を追加しました` },
    )
  }

  function addVariant(product: ProductView, variant: Variant) {
    addOne(variant.id, `${product.name}(${variant.color} / ${sizeLabel(variant.size)})`, variant.stock)
  }

  function pick(product: ProductView) {
    // サイズも色も1つだけなら、選ぶ画面を出さずにそのまま入れる
    if (product.variants.length === 1) addVariant(product, product.variants[0])
    else setPickingId(product.id)
  }

  async function confirmSale(received: number) {
    if (saving) return
    setSaving(true)
    setPayError(null)
    try {
      const sale = await createSale(db, { lines, received, expectedTotal: total })
      dispatch({ type: 'clear' })
      setPaying(false)
      setDone({ saleNo: sale.saleNo, total: sale.totalIncl, received: sale.received, change: sale.change })
    } catch (e) {
      // 保存できなかったときはカートを消さず、電卓の画面にエラーを出す
      setPayError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.page}>
      {backupDue && (
        <div className={styles.backup} role="status">
          <p>
            <strong>バックアップを保存してください。</strong>
            {backupDue === 'never' ? 'まだ一度も保存していません。' : '最後の保存から7日以上たっています。'}
          </p>
          {backup.error && <p className="error">{backup.error}</p>}
          <button type="button" className="btn btn-sm" onClick={() => void backup.run()} disabled={backup.busy}>
            {backup.busy ? '保存しています…' : 'バックアップを保存'}
          </button>
        </div>
      )}
      <div className={styles.layout}>
        <ProductPicker categories={catalog.categories} products={catalog.products} onPick={pick} />
        <CartPanel
          items={items}
          total={total}
          onIncrement={(item) => addOne(item.variantId, item.productName, item.stock)}
          onDecrement={(item) => dispatch({ type: 'decrement', variantId: item.variantId })}
          onClear={() => dispatch({ type: 'clear' })}
          onPay={() => {
            setPayError(null)
            setPaying(true)
          }}
        />
      </div>

      {picking && (
        <VariantDialog
          product={picking}
          onClose={() => setPickingId(null)}
          onPick={(variant) => {
            setPickingId(null)
            addVariant(picking, variant)
          }}
        />
      )}

      {paying && (
        <PayDialog
          total={total}
          busy={saving}
          error={payError}
          onCancel={() => setPaying(false)}
          onConfirm={({ received }) => void confirmSale(received)}
        />
      )}

      {done && <ChangeDialog {...done} onNext={() => setDone(null)} />}

      {toast && (
        <div className={toast.warn ? `${styles.toast} ${styles.warn}` : styles.toast} role="status">
          {toast.text}
        </div>
      )}
    </section>
  )
}
