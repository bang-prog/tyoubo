import { useId, useState } from 'react'
import { sizeLabel } from '../../lib/labels'
import { addOption, buildCandidates, removeOption, toggleOption, type OptionKind } from '../../lib/variantOptions'
import styles from './OptionPicker.module.css'

type Props = {
  kind: OptionKind
  /** 選んでいるもの(サイズは決まった順、色は選んだ順) */
  selected: string[]
  /** ほかの商品で使ったもの(多く使われている順) */
  used: string[]
  onChange: (next: string[]) => void
}

const TEXT = {
  size: { label: 'サイズ', add: '＋ ほかのサイズ', placeholder: '例:ワイド、24.5', empty: '下の候補から選んでください。' },
  color: { label: '色', add: '＋ ほかの色', placeholder: '例:杢グレー', empty: '下の候補から選んでください。' },
} as const

/** 画面に出す名前(サイズの「F」は「フリー」と出す) */
const display = (kind: OptionKind, name: string) => (kind === 'size' ? sizeLabel(name) : name)

/**
 * サイズや色を選ぶ部品(商品管理)。候補をタップして選び、候補にないものは1つずつ追加する。
 * カンマで区切って打つ必要はない。候補 = よく使うもの + ほかの商品で使ったもの。
 */
export default function OptionPicker({ kind, selected, used, onChange }: Props) {
  const text = TEXT[kind]
  const inputId = useId()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 選んだものは上に並べるので、「この商品で追加したもの」のグループは候補には出さない
  const groups = buildCandidates(kind, selected, used).filter((g) => g.candidates.every((c) => c.source !== 'added'))

  function tap(name: string) {
    const r = toggleOption(selected, name, kind)
    if (r.ok) {
      onChange(r.list)
      setError(null)
    } else setError(r.error)
  }

  function add() {
    const r = addOption(selected, draft, kind)
    if (!r.ok) return setError(r.error)
    onChange(r.list)
    setDraft('')
    setError(null)
  }

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label}>{text.label}</span>
        <span className={styles.count}>{selected.length}個</span>
      </div>

      {/* 選んでいるもの。× で外す */}
      {selected.length === 0 ? (
        <p className={styles.empty}>{text.empty}</p>
      ) : (
        <ul className={styles.chips} aria-label={`選んでいる${text.label}`}>
          {selected.map((name) => (
            <li key={name} className={styles.chip}>
              <span>{display(kind, name)}</span>
              <button type="button" onClick={() => onChange(removeOption(selected, name))} aria-label={`${display(kind, name)}を外す`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 候補。タップで選ぶ・外す */}
      <div className={styles.groups}>
        {groups.map((g) => (
          <div key={g.label} className={styles.group} role="group" aria-label={g.label}>
            <span className={styles.groupLabel}>{g.label}</span>
            <div className={styles.candidates}>
              {g.candidates.map((c) => (
                <button key={c.name} type="button" className={styles.candidate} aria-pressed={c.selected} onClick={() => tap(c.name)}>
                  {display(kind, c.name)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 候補にないものを1つずつ追加する */}
      {adding ? (
        <div className={styles.addRow}>
          <label className="sr-only" htmlFor={inputId}>
            追加する{text.label}
          </label>
          <input
            id={inputId}
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter で商品の保存まで進まないように、ここで止めて追加だけする
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder={text.placeholder}
            autoComplete="off"
            enterKeyHint="done"
            autoFocus
          />
          <button type="button" className="btn btn-primary" onClick={add}>
            追加
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setAdding(false)
              setDraft('')
              setError(null)
            }}
          >
            閉じる
          </button>
        </div>
      ) : (
        <button type="button" className={`btn btn-sm ${styles.addButton}`} onClick={() => setAdding(true)}>
          {text.add}
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
