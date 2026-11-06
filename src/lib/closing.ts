// レジ締めの計算(仕様書 §5 F4)。

import type { DenominationCounts } from '../db/types'

export type DenominationKey = keyof DenominationCounts

/** 金種(大きい順) */
export const DENOMINATIONS: readonly { key: DenominationKey; value: number; label: string }[] = [
  { key: '10000', value: 10000, label: '1万円札' },
  { key: '5000', value: 5000, label: '5千円札' },
  { key: '2000', value: 2000, label: '2千円札' },
  { key: '1000', value: 1000, label: '千円札' },
  { key: '500', value: 500, label: '500円玉' },
  { key: '100', value: 100, label: '100円玉' },
  { key: '50', value: 50, label: '50円玉' },
  { key: '10', value: 10, label: '10円玉' },
  { key: '5', value: 5, label: '5円玉' },
  { key: '1', value: 1, label: '1円玉' },
]

/** 1つの金種で入力できる枚数の上限 */
export const MAX_COUNT = 99_999

/** 数えた現金 = 金種ごとに「額面 × 枚数」を足したもの */
export function countedTotal(counts: DenominationCounts): number {
  return DENOMINATIONS.reduce((sum, d) => sum + d.value * (counts[d.key] ?? 0), 0)
}

/** レジにあるはずの現金 = 準備金 + その日の現金売上 − その日の返金 */
export function expectedCash(values: { openingFloat: number; cashSales: number; refundsTotal: number }): number {
  return values.openingFloat + values.cashSales - values.refundsTotal
}

export type DifferenceStatus = 'even' | 'over' | 'short'

/** 過不足 = 数えた現金 − レジにあるはずの現金。プラスは現金が多い(過剰)、マイナスは足りない(不足) */
export function differenceOf(counted: number, expected: number): { difference: number; status: DifferenceStatus } {
  const difference = counted - expected
  return { difference, status: difference === 0 ? 'even' : difference > 0 ? 'over' : 'short' }
}
