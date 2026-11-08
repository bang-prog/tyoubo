import { useLiveQuery } from 'dexie-react-hooks'
import { useReducer, type ReactNode } from 'react'
import { db } from '../../db/db'
import { getSetting } from '../../db/settings'
import { isUnlocked, markUnlocked } from '../../lib/pinAttempts'
import LockScreen from './LockScreen'

/**
 * 暗証番号がオンで、このタブ(アプリ)を開いてからまだ解除していなければ、
 * アプリの代わりに入力画面を出す(仕様書 §5 F6)。
 * 設定画面で PIN をオンにするときは先に markUnlocked() を呼ぶので、その場でロックはかからない。
 */
export default function PinGate({ children }: { children: ReactNode }) {
  const enabled = useLiveQuery(() => getSetting(db, 'pinEnabled'), [])
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  // 設定を読み込むまでは何も出さない(一瞬でも売上が見えないように)
  if (enabled === undefined) return null
  if (enabled && !isUnlocked()) {
    return (
      <LockScreen
        onUnlock={() => {
          markUnlocked()
          rerender()
        }}
      />
    )
  }
  return children
}
