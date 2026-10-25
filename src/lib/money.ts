// 金額の計算(仕様書 §6)。金額はすべて円単位の整数で扱う。

/** 消費税率(%)。衣料品のため一律10%。 */
export const DEFAULT_TAX_RATE = 10

/** 入力できるお預かり金額の上限(7桁)。 */
export const MAX_RECEIVED = 9_999_999

export type TaxBreakdown = {
  /** 税込金額 */
  incl: number
  /** うち消費税 */
  tax: number
  /** 税抜金額 */
  excl: number
}

export type Line = {
  /** 単価(税込) */
  unitPriceIncl: number
  qty: number
}

/** 0以上の整数(円)でなければエラーにする。 */
export function assertYen(value: number, label = '金額'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label}は0以上の整数(円)で指定してください: ${value}`)
  }
}

/**
 * 税込金額に含まれる消費税額。1円未満は切り捨てる。
 * 1回の会計(または1回の返品)の税込合計に対して使う。明細ごとには計算しない。
 */
export function taxOf(totalIncl: number, ratePercent = DEFAULT_TAX_RATE): number {
  assertYen(totalIncl, '税込金額')
  assertYen(ratePercent, '税率')
  // 分子は整数なので割り算の誤差で整数の境目をまたぐことはない
  return Math.floor((totalIncl * ratePercent) / (100 + ratePercent))
}

/** 税込金額を、消費税と税抜金額に分ける。 */
export function splitTax(totalIncl: number, ratePercent = DEFAULT_TAX_RATE): TaxBreakdown {
  const tax = taxOf(totalIncl, ratePercent)
  return { incl: totalIncl, tax, excl: totalIncl - tax }
}

/** 明細1行の金額(単価 × 数量)。 */
export function lineTotal(line: Line): number {
  assertYen(line.unitPriceIncl, '単価')
  if (!Number.isSafeInteger(line.qty) || line.qty < 1) {
    throw new RangeError(`数量は1以上の整数で指定してください: ${line.qty}`)
  }
  return line.unitPriceIncl * line.qty
}

/** 会計の税込合計。 */
export function cartTotal(lines: readonly Line[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0)
}

/** 画面に表示する形にする。12345 → "¥12,345" */
export function formatYen(value: number): string {
  return '¥' + value.toLocaleString('ja-JP')
}

export type ChangeResult =
  | { ok: true; change: number }
  | { ok: false; shortage: number }

/** お釣りを計算する。お預かりが足りないときは不足額を返す。 */
export function calcChange(received: number, totalIncl: number): ChangeResult {
  assertYen(received, 'お預かり')
  assertYen(totalIncl, '税込合計')
  const diff = received - totalIncl
  return diff >= 0 ? { ok: true, change: diff } : { ok: false, shortage: -diff }
}
