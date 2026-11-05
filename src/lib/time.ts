const pad2 = (n: number) => String(n).padStart(2, '0')

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

function parseBusinessDate(businessDate: string): Date {
  const [y, m, d] = businessDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 'YYYY-MM-DD' の形で、実際にある日付か */
export function isBusinessDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && businessDateOf(parseBusinessDate(value)) === value
}

/** 営業日を days 日ずらす。月や年の変わり目もまたげる */
export function addDays(businessDate: string, days: number): string {
  const d = parseBusinessDate(businessDate)
  d.setDate(d.getDate() + days)
  return businessDateOf(d)
}

/** '2026-11-06' → '2026年11月6日(金)' */
export function formatBusinessDate(businessDate: string): string {
  const d = parseBusinessDate(businessDate)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`
}

/** nowIso() で作った日時から時刻だけを取り出す。'2026-11-06T14:05:09+09:00' → '14:05' */
export function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

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
