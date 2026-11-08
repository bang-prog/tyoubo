import { useEffect } from 'react'
import styles from './PinPad.module.css'

const MAX_LENGTH = 6

type Props = {
  value: string
  onChange: (value: string) => void
  /** 「決定」を押したとき(4桁以上入っているときだけ) */
  onSubmit: () => void
  disabled?: boolean
  submitLabel?: string
}

/**
 * 暗証番号を入れる数字キー(仕様書 §5 F6)。入れた数字は●で表示する。
 * PC で確かめやすいように、キーボードの数字・Backspace・Enter でも入力できる。
 */
export default function PinPad({ value, onChange, onSubmit, disabled = false, submitLabel = '決定' }: Props) {
  const canSubmit = !disabled && value.length >= 4

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        if (value.length < MAX_LENGTH) onChange(value + e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onChange(value.slice(0, -1))
      } else if (e.key === 'Enter' && value.length >= 4) {
        e.preventDefault()
        onSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, value, onChange, onSubmit])

  return (
    <div className={styles.pad}>
      <div className={styles.dots} aria-live="polite" aria-label={`${value.length}桁入力済み`}>
        {Array.from({ length: MAX_LENGTH }, (_, i) => (
          <span key={i} className={i < value.length ? `${styles.dot} ${styles.filled}` : styles.dot} />
        ))}
      </div>
      <div className={styles.keys}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            className={`num ${styles.key}`}
            onClick={() => value.length < MAX_LENGTH && onChange(value + d)}
            disabled={disabled}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.key} ${styles.sub}`}
          onClick={() => onChange(value.slice(0, -1))}
          disabled={disabled || value === ''}
          aria-label="1文字削除"
        >
          ⌫
        </button>
        <button
          type="button"
          className={`num ${styles.key}`}
          onClick={() => value.length < MAX_LENGTH && onChange(value + '0')}
          disabled={disabled}
        >
          0
        </button>
        <button type="button" className={`${styles.key} ${styles.submit}`} onClick={onSubmit} disabled={!canSubmit}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
