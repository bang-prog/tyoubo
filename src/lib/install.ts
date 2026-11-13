// ホーム画面に追加して使っているか(仕様書 §3、§9)。
// iPhone の Safari には「インストールしますか？」と聞く仕組みがないので、手順を画面で案内する。

export type InstallEnv = {
  userAgent: string
  /** iPad の Safari は PC と同じ「MacIntel」を名のるので、タッチできるかで見分ける */
  platform: string
  maxTouchPoints: number
  /** (display-mode: standalone) に当てはまるか */
  displayStandalone: boolean
  /** iPhone の Safari だけにある navigator.standalone */
  navigatorStandalone?: boolean
}

/** iPhone・iPad か */
export function isIOS(env: InstallEnv): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
}

/** ホーム画面のアイコンから(アプリとして)開いているか */
export function isStandalone(env: InstallEnv): boolean {
  return env.displayStandalone || env.navigatorStandalone === true
}

/** 「ホーム画面に追加」の案内を出すか。iPhone・iPad の Safari で、まだブラウザのタブで開いているとき */
export function shouldShowInstallGuide(env: InstallEnv): boolean {
  return isIOS(env) && !isStandalone(env)
}

/** 今の端末の情報 */
export function currentInstallEnv(): InstallEnv {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    displayStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
  }
}

// ---------- 最初に開いたときの案内を出したか ----------

/** 「表示しない」を押したら、この端末では二度と出さない */
const DISMISS_KEY = 'tyoubo-install-guide-dismissed'
/** 「あとで」を押したら、このタブ(Safari)を閉じるまで出さない */
const LATER_KEY = 'tyoubo-install-guide-later'

/** 最初に開いたときに「ホーム画面に追加」の案内を出すか */
export function installGuideNeeded(): boolean {
  return shouldShowInstallGuide(currentInstallEnv()) && !wasDismissed()
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1' || sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    return false
  }
}

/** 案内を閉じたことを覚える。local:この端末では二度と出さない / session:このタブを閉じるまで出さない */
export function rememberInstallGuideClosed(storage: 'local' | 'session'): void {
  try {
    if (storage === 'local') localStorage.setItem(DISMISS_KEY, '1')
    else sessionStorage.setItem(LATER_KEY, '1')
  } catch {
    // 覚えておけなくても、閉じることはできる
  }
}
