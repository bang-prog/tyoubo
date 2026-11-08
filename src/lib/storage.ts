// データの保存状態(仕様書 §9、設定画面)。

/**
 * 永続ストレージをリクエストする。許可されると、端末の空き容量が少なくなっても
 * ブラウザがデータを消しにくくなる。アプリを開いたときに呼ぶ。
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

export type StorageStatus = {
  /** 永続ストレージが許可されているか(調べられないときは null) */
  persisted: boolean | null
  /** 使っている容量(バイト) */
  usage: number | null
  /** 使える容量の目安(バイト) */
  quota: number | null
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const status: StorageStatus = { persisted: null, usage: null, quota: null }
  try {
    if (navigator.storage?.persisted) status.persisted = await navigator.storage.persisted()
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate()
      status.usage = usage ?? null
      status.quota = quota ?? null
    }
  } catch {
    // 調べられない項目は null のまま
  }
  return status
}

/** 1234567 → '1.2 MB' */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}
