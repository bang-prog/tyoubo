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
