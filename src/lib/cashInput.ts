// 電卓画面の「お預かり」入力欄の状態と、キーを押したときの変化(仕様書 §5 F2)。
// 状態は数字だけの文字列で持つ。'' は「まだ何も入力していない」。

import { MAX_RECEIVED } from './money'

const MAX_DIGITS = String(MAX_RECEIVED).length // 7桁

/** 電卓の数字キー */
export const CASH_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00'] as const
export type CashKey = (typeof CASH_KEYS)[number]

export type CashAction =
  | { type: 'press'; key: CashKey }
  | { type: 'backspace' }
  | { type: 'clear' }
  /** 「＋1,000」など、今の金額に足す */
  | { type: 'add'; amount: number }
  /** 「ちょうど」など、金額をそのまま入れる */
  | { type: 'set'; amount: number }

export function isCashKey(key: string): key is CashKey {
  return (CASH_KEYS as readonly string[]).includes(key)
}

export function toAmount(input: string): number {
  return input === '' ? 0 : Number(input)
}

function fromAmount(amount: number): string {
  const clamped = Math.min(MAX_RECEIVED, Math.max(0, Math.floor(amount)))
  return clamped === 0 ? '' : String(clamped)
}

export function cashInputReducer(input: string, action: CashAction): string {
  switch (action.type) {
    case 'press': {
      // 先頭に0は付けない
      if (input === '' && (action.key === '0' || action.key === '00')) return input
      const next = input + action.key
      // 桁があふれる入力は受け付けない(途中で切ると打ち間違いに気づけないため)
      return next.length > MAX_DIGITS ? input : next
    }
    case 'backspace':
      return input.slice(0, -1)
    case 'clear':
      return ''
    case 'add':
      return fromAmount(toAmount(input) + action.amount)
    case 'set':
      return fromAmount(action.amount)
  }
}
