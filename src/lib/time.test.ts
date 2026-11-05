import { describe, expect, it } from 'vitest'
import { addDays, businessDateOf, formatBusinessDate, isBusinessDate, nowIso, timeOf } from './time'

describe('addDays', () => {
  it('前後の日にずらす。月末・年末もまたげる', () => {
    expect(addDays('2026-11-06', 1)).toBe('2026-11-07')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29') // うるう年
  })
})

describe('isBusinessDate', () => {
  it('実際にある日付だけを通す', () => {
    expect(isBusinessDate('2026-11-06')).toBe(true)
    expect(isBusinessDate('2026-02-30')).toBe(false)
    expect(isBusinessDate('2026-1-6')).toBe(false)
    expect(isBusinessDate('abc')).toBe(false)
  })
})

describe('formatBusinessDate / timeOf', () => {
  it('画面に出す形にする', () => {
    expect(formatBusinessDate('2026-11-06')).toBe('2026年11月6日(金)')
    expect(timeOf('2026-11-06T14:05:09+09:00')).toBe('14:05')
  })
})

describe('businessDateOf', () => {
  it('端末の日付を YYYY-MM-DD にする', () => {
    expect(businessDateOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(businessDateOf(new Date(2026, 10, 4, 0, 0))).toBe('2026-11-04')
  })
})

describe('nowIso', () => {
  it('時差付きの ISO 8601 形式になる', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  })

  it('元の日時と同じ時刻を指す(秒まで)', () => {
    const d = new Date('2026-10-29T05:05:09.700Z')
    expect(new Date(nowIso(d)).getTime()).toBe(new Date('2026-10-29T05:05:09Z').getTime())
  })
})
