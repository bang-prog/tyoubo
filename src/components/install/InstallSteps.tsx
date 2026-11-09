import styles from './InstallGuide.module.css'

/** iPhone の Safari の共有ボタン(四角から上向きの矢印) */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5v10h14V11h-1" />
    </svg>
  )
}

/** 「ホーム画面に追加」の手順(仕様書 §9)。最初の案内と設定画面で使う */
export default function InstallSteps() {
  return (
    <>
      <ol className={styles.steps}>
        <li>
          Safari の画面の下(または上)にある共有ボタン
          <span className={styles.icon}>
            <ShareIcon />
          </span>
          をタップします。
        </li>
        <li>
          一覧から<b>「ホーム画面に追加」</b>を選びます。見つからないときは、一覧を下にスクロールするか「もっと見る」を押してください。
        </li>
        <li>
          右上の<b>「追加」</b>をタップします。
        </li>
        <li>
          これからは、ホーム画面の<b>「レジ帳簿」</b>のアイコンから開いてください。
        </li>
      </ol>
      <p className={styles.caution}>
        Safari のタブで入れたデータは、ホーム画面のアプリには移りません(保存場所が別のため)。Safari で使っていた場合は、設定の「バックアップを保存」をしてから、ホーム画面のアプリで「ファイルを選んで読み込む」をしてください。
      </p>
    </>
  )
}
