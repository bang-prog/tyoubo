import { describe, expect, it } from 'vitest'
import { assertYen, calcChange, cartTotal, lineTotal, MAX_RECEIVED, splitTax, taxOf } from './money'

describe('taxOf', () => {
  it('仕様書の例:11,270円 → 消費税1,024円', () => {
    expect(taxOf(11270)).toBe(1024)
  })

  it('1円未満を切り捨てる', () => {
    expect(taxOf(109)).toBe(9) // 9.909…
    expect(taxOf(6980)).toBe(634) // 634.54…
    expect(taxOf(1)).toBe(0)
  })

  it('割り切れるときはそのまま', () => {
    expect(taxOf(110)).toBe(10)
    expect(taxOf(11000)).toBe(1000)
  })

  it('0円なら0円', () => {
    expect(taxOf(0)).toBe(0)
  })

  it('大きな金額でもずれない', () => {
    expect(taxOf(MAX_RECEIVED)).toBe(909090) // 909,090.81…
    for (let incl = 0; incl <= 20000; incl++) {
      const tax = taxOf(incl)
      // 税抜 × 1.1 が税込を超えない、かつ1円足すと超える
      expect(tax * 110).toBeLessThanOrEqual(incl * 10)
      expect((tax + 1) * 110).toBeGreaterThan(incl * 10)
    }
  })

  it('税率を指定できる', () => {
    expect(taxOf(1080, 8)).toBe(80)
  })

  it('整数でない金額やマイナスはエラー', () => {
    expect(() => taxOf(100.5)).toThrow(RangeError)
    expect(() => taxOf(-1)).toThrow(RangeError)
    expect(() => taxOf(Number.NaN)).toThrow(RangeError)
  })
})

describe('splitTax', () => {
  it('税込 = 税抜 + 消費税 になる', () => {
    expect(splitTax(11270)).toEqual({ incl: 11270, tax: 1024, excl: 10246 })
  })
})

describe('lineTotal / cartTotal', () => {
  it('単価 × 数量を足し合わせる', () => {
    const lines = [
      { unitPriceIncl: 6980, qty: 1 },
      { unitPriceIncl: 990, qty: 3 },
    ]
    expect(lineTotal(lines[1])).toBe(2970)
    expect(cartTotal(lines)).toBe(9950)
  })

  it('空のカートは0円', () => {
    expect(cartTotal([])).toBe(0)
  })

  it('数量が0以下や小数ならエラー', () => {
    expect(() => lineTotal({ unitPriceIncl: 990, qty: 0 })).toThrow(RangeError)
    expect(() => lineTotal({ unitPriceIncl: 990, qty: 1.5 })).toThrow(RangeError)
  })
})

describe('calcChange', () => {
  it('お釣りを返す', () => {
    expect(calcChange(10000, 6980)).toEqual({ ok: true, change: 3020 })
  })

  it('ちょうどならお釣り0円', () => {
    expect(calcChange(6980, 6980)).toEqual({ ok: true, change: 0 })
  })

  it('足りないときは不足額を返す', () => {
    expect(calcChange(5000, 6980)).toEqual({ ok: false, shortage: 1980 })
  })
})

describe('assertYen', () => {
  it('0以上の整数なら何もしない', () => {
    expect(() => assertYen(0)).not.toThrow()
    expect(() => assertYen(19800)).not.toThrow()
  })
})
