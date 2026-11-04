const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * 営業日('YYYY-MM-DD')。端末の時計の日付をそのまま使う。
 * 営業時間は日付をまたがない(仕様書 §3、§13 Q3 で決定)。
 */
export function businessDateOf(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 端末の時刻を、時差付きの ISO 8601 形式にする。例:2026-10-29T14:05:09+09:00 */
export function nowIso(date = new Date()): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  )
}
