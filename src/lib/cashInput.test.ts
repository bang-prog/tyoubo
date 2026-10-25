import { describe, expect, it } from 'vitest'
import { cashInputReducer, isCashKey, toAmount, type CashAction } from './cashInput'

/** 最初の状態('')から順にキーを押した結果 */
function run(...actions: CashAction[]): string {
  return actions.reduce(cashInputReducer, '')
}
const press = (key: Extract<CashAction, { type: 'press' }>['key']): CashAction => ({ type: 'press', key })

describe('cashInputReducer', () => {
  it('数字を順に入力できる', () => {
    expect(run(press('1'), press('0'), press('00'))).toBe('1000')
  })

  it('先頭の0は入らない', () => {
    expect(run(press('0'), press('00'), press('5'))).toBe('5')
  })

  it('7桁を超える入力は受け付けない', () => {
    const full = run(press('9'), press('9'), press('9'), press('9'), press('9'), press('9'))
    expect(cashInputReducer(full, press('9'))).toBe('9999999')
    expect(cashInputReducer(full, press('00'))).toBe(full) // 8桁になるので無視
    expect(cashInputReducer('9999999', press('1'))).toBe('9999999')
  })

  it('1文字消す・全部消す', () => {
    expect(run(press('1'), press('2'), { type: 'backspace' })).toBe('1')
    expect(run(press('1'), { type: 'backspace' }, { type: 'backspace' })).toBe('')
    expect(run(press('1'), press('2'), { type: 'clear' })).toBe('')
  })

  it('お札のボタンは押すたびに足す', () => {
    expect(run({ type: 'add', amount: 1000 }, { type: 'add', amount: 1000 })).toBe('2000')
    expect(run(press('5'), press('00'), { type: 'add', amount: 10000 })).toBe('10500')
  })

  it('足し算でも上限を超えない', () => {
    expect(cashInputReducer('9995000', { type: 'add', amount: 10000 })).toBe('9999999')
  })

  it('「ちょうど」は金額をそのまま入れる', () => {
    expect(run(press('3'), { type: 'set', amount: 6980 })).toBe('6980')
  })
})

describe('toAmount', () => {
  it('未入力は0円', () => {
    expect(toAmount('')).toBe(0)
    expect(toAmount('6980')).toBe(6980)
  })
})

describe('isCashKey', () => {
  it('電卓の数字キーだけを通す', () => {
    expect(isCashKey('7')).toBe(true)
    expect(isCashKey('00')).toBe(true)
    expect(isCashKey('a')).toBe(false)
    expect(isCashKey('Enter')).toBe(false)
  })
})
