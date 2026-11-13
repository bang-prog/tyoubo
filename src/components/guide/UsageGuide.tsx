import { useState } from 'react'
import Modal from '../Modal'
import { GUIDE_PAGES } from './guidePages'
import styles from './UsageGuide.module.css'

type Props = {
  onClose: () => void
  /** 最初に開いたときの案内か(最後のボタンを「はじめる」にする) */
  firstRun?: boolean
}

/**
 * 使い方の説明。1ページずつ「次へ」で進む。
 * 初めて開いたときに表示し(StartupGuides)、設定画面の「使い方を見る」からいつでも開ける。
 */
export default function UsageGuide({ onClose, firstRun = false }: Props) {
  const [index, setIndex] = useState(0)
  const page = GUIDE_PAGES[index]
  const last = index === GUIDE_PAGES.length - 1

  return (
    <Modal
      labelledBy="guide-title"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && !last) setIndex(index + 1)
        if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
      }}
      maxWidth={520}
    >
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={`num ${styles.count}`}>
            使い方 {index + 1} / {GUIDE_PAGES.length}
          </span>
          {!last && (
            <button type="button" className={styles.skip} onClick={onClose}>
              {firstRun ? 'スキップ' : '閉じる'}
            </button>
          )}
        </div>

        {page.tab && <span className={styles.tab}>{page.tab}</span>}
        <h2 id="guide-title" className={styles.title}>
          {page.title}
        </h2>
        <div className={styles.content} aria-live="polite">
          {page.body}
        </div>

        <div className={styles.dots} aria-hidden="true">
          {GUIDE_PAGES.map((p, i) => (
            <span key={p.title} className={i === index ? `${styles.dot} ${styles.current}` : styles.dot} />
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            戻る
          </button>
          {last ? (
            <button type="button" className={`btn btn-primary ${styles.next}`} onClick={onClose}>
              {firstRun ? 'はじめる' : '閉じる'}
            </button>
          ) : (
            <button type="button" className={`btn btn-primary ${styles.next}`} onClick={() => setIndex(index + 1)}>
              次へ
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
