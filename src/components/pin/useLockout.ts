import { useEffect, useState } from 'react'
import { attemptsLeft, lockRemaining, recordFailure, resetFailures } from '../../lib/pinAttempts'

/**
 * 5回続けて間違えたら30秒入力できなくする(仕様書 §5 F6)。
 * check に PIN や復旧コードを確かめる処理を渡すと、結果に応じて回数を数える。
 */
export function useLockout() {
  const [remaining, setRemaining] = useState(() => lockRemaining())
  const locked = remaining > 0

  useEffect(() => {
    if (!locked) return
    const timer = setInterval(() => setRemaining(lockRemaining()), 500)
    return () => clearInterval(timer)
  }, [locked])

  /** 正しければ true。間違えたときは、画面に出す文を返す */
  async function check(verify: () => Promise<boolean>, what = '暗証番号'): Promise<true | string> {
    if (lockRemaining() > 0) return 'しばらく待ってからお試しください。'
    if (await verify()) {
      resetFailures()
      return true
    }
    recordFailure()
    setRemaining(lockRemaining())
    if (lockRemaining() > 0) return `${what}を続けて間違えたため、30秒間は入力できません。`
    return `${what}が違います(あと${attemptsLeft()}回間違えると、30秒間入力できなくなります)。`
  }

  return { locked, seconds: Math.ceil(remaining / 1000), check }
}
