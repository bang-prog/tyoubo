import { useState } from 'react'
import { addCategory, deleteCategory, moveCategory, renameCategory } from '../../db/catalog'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import type { Category } from '../../db/types'
import styles from './CategoryPanel.module.css'

type Props = {
  categories: Category[]
  /** カテゴリーごとの商品の数 */
  productCounts: Map<string, number>
}

/** カテゴリーの追加・名前の変更・並べ替え・削除。 */
export default function CategoryPanel({ categories, productCounts }: Props) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** 保存の処理を行い、失敗したらエラーを表示する。成功したら true */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(userMessage(e))
      return false
    }
  }

  async function handleAdd() {
    if (await run(() => addCategory(db, newName))) setNewName('')
  }

  async function handleRename(id: string) {
    if (await run(() => renameCategory(db, id, editName))) setEditingId(null)
  }

  return (
    <div className="panel">
      <h2 className={styles.title}>カテゴリー</h2>

      {categories.length === 0 ? (
        <p className="hint">まだカテゴリーがありません。下の欄から追加してください(例:トップス、ボトムス、小物)。</p>
      ) : (
        <ul className={styles.list}>
          {categories.map((c, i) => {
            const count = productCounts.get(c.id) ?? 0
            return (
              <li key={c.id} className={styles.row}>
                {editingId === c.id ? (
                  <form
                    className={styles.edit}
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleRename(c.id)
                    }}
                  >
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="カテゴリー名"
                      autoFocus
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      保存
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>
                      やめる
                    </button>
                  </form>
                ) : (
                  <>
                    <span className={styles.name}>
                      {c.name}
                      <small className={styles.count}>{count}件</small>
                    </span>
                    <div className={styles.buttons}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={i === 0}
                        aria-label={`${c.name}を上へ`}
                        onClick={() => void run(() => moveCategory(db, c.id, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={i === categories.length - 1}
                        aria-label={`${c.name}を下へ`}
                        onClick={() => void run(() => moveCategory(db, c.id, 1))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditName(c.name)
                          setError(null)
                        }}
                      >
                        名前を変更
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={count > 0}
                        title={count > 0 ? '商品があるカテゴリーは削除できません' : undefined}
                        onClick={() => void run(() => deleteCategory(db, c.id))}
                      >
                        削除
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {categories.some((c) => (productCounts.get(c.id) ?? 0) > 0) && (
        <p className="hint">商品があるカテゴリーは削除できません。</p>
      )}

      <form
        className={styles.add}
        onSubmit={(e) => {
          e.preventDefault()
          void handleAdd()
        }}
      >
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しいカテゴリー名"
          aria-label="新しいカテゴリー名"
        />
        <button type="submit" className="btn">
          追加
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
