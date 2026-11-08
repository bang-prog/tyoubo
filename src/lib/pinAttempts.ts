// PIN を続けて間違えた回数と、入力できない時間(仕様書 §5 F6)。
// 画面を開き直しても続くように localStorage に置く。使えないときはメモリだけで数える。

export const MAX_ATTEMPTS = 5
export const LOCK_MS = 30_000

const KEY = 'tyoubo-pin-attempts'

type State = { failures: number; lockedUntil: number }

let memory: State = { failures: 0, lockedUntil: 0 }

function read(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<State>
      return { failures: Number(v.failures) || 0, lockedUntil: Number(v.lockedUntil) || 0 }
    }
  } catch {
    // 読めないときはメモリの値を使う
  }
  return memory
}

function write(state: State): void {
  memory = state
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 保存できなくてもメモリでは数えている
  }
}

/** 入力できるようになるまでの残りミリ秒(入力できるなら 0) */
export function lockRemaining(now = Date.now()): number {
  return Math.max(0, read().lockedUntil - now)
}

/** 間違えたことを記録する。5回目で30秒ロックし、回数は0に戻す */
export function recordFailure(now = Date.now()): void {
  const failures = read().failures + 1
  write(failures >= MAX_ATTEMPTS ? { failures: 0, lockedUntil: now + LOCK_MS } : { failures, lockedUntil: 0 })
}

export function resetFailures(): void {
  write({ failures: 0, lockedUntil: 0 })
}

/** あと何回間違えるとロックされるか */
export function attemptsLeft(): number {
  return MAX_ATTEMPTS - read().failures
}

// ---------- このタブで解除済みか ----------
// sessionStorage はタブ(ホーム画面のアプリ)を閉じると消え、再読み込みでは残る。
// 仕様書の「閉じて開き直したときだけ求める」をそのまま実現できる。

const UNLOCK_KEY = 'tyoubo-unlocked'
let unlockedInMemory = false

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return unlockedInMemory
  }
}

export function markUnlocked(): void {
  unlockedInMemory = true
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1')
  } catch {
    // メモリだけで覚えておく(再読み込みすると、もう一度求める)
  }
}
