import { describe, expect, it } from 'vitest'
import { nowIso } from './time'

describe('nowIso', () => {
  it('時差付きの ISO 8601 形式になる', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  })

  it('元の日時と同じ時刻を指す(秒まで)', () => {
    const d = new Date('2026-10-29T05:05:09.700Z')
    expect(new Date(nowIso(d)).getTime()).toBe(new Date('2026-10-29T05:05:09Z').getTime())
  })
})
