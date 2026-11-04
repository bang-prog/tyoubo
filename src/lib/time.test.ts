import { describe, expect, it } from 'vitest'
import { businessDateOf, nowIso } from './time'

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
