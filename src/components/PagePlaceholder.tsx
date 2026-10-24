import styles from './PagePlaceholder.module.css'

type Props = {
  title: string
  /** この画面で作る予定の内容 */
  note: string
}

/** 中身ができるまでの仮の画面。 */
export default function PagePlaceholder({ title, note }: Props) {
  return (
    <section className={styles.page}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.note}>{note}</p>
    </section>
  )
}
