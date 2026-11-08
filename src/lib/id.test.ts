import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('UUID v4 の形の id を作る', () => {
    expect(newId()).toMatch(UUID)
  })

  it('http で開いて crypto.randomUUID が使えないときも、同じ形の重ならない id を作る', () => {
    vi.stubGlobal('isSecureContext', false)
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(UUID)
  })
})
