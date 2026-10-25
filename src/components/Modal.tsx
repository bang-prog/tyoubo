import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Modal.module.css'

type Props = {
  /** ダイアログの見出しの id(読み上げ用) */
  labelledBy: string
  /** Esc キーで閉じようとしたとき */
  onClose: () => void
  onKeyDown?: (e: KeyboardEvent<HTMLDialogElement>) => void
  /** 横幅の上限(px) */
  maxWidth: number
  children: ReactNode
}

/**
 * 画面の上に重ねて表示するダイアログ。ブラウザ標準の <dialog> を使う。
 * 表示している間は後ろの画面を操作できない。呼び出し側で、表示するときだけ描画する。
 */
export default function Modal({ labelledBy, onClose, onKeyDown, maxWidth, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // キーボード入力をすぐ受け取れるように、ダイアログ自体にフォーカスする
    dialog.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ maxWidth }}
      tabIndex={-1}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        // ブラウザに勝手に閉じさせず、呼び出し側に任せる
        e.preventDefault()
        onClose()
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </dialog>
  )
}
