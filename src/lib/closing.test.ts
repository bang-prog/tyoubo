import { describe, expect, it } from 'vitest'
import { countedTotal, DENOMINATIONS, differenceOf, expectedCash } from './closing'

describe('countedTotal', () => {
  it('額面 × 枚数を足す', () => {
    expect(countedTotal({ '10000': 2, '1000': 5, '100': 3, '1': 4 })).toBe(25304)
  })

  it('全部の金種を1枚ずつ', () => {
    const all = Object.fromEntries(DENOMINATIONS.map((d) => [d.key, 1]))
    expect(countedTotal(all)).toBe(18666)
  })

  it('何も入れていなければ0円', () => {
    expect(countedTotal({})).toBe(0)
  })
})

describe('expectedCash', () => {
  it('準備金 + 現金売上 − 返金', () => {
    expect(expectedCash({ openingFloat: 30000, cashSales: 15940, refundsTotal: 1980 })).toBe(43960)
  })
})

describe('differenceOf', () => {
  it('ぴったり・多い・足りない', () => {
    expect(differenceOf(43960, 43960)).toEqual({ difference: 0, status: 'even' })
    expect(differenceOf(44000, 43960)).toEqual({ difference: 40, status: 'over' })
    expect(differenceOf(43860, 43960)).toEqual({ difference: -100, status: 'short' })
  })
})
