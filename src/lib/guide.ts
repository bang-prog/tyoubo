// 使い方の説明を、最初に開いたときに1回だけ出す。
// 端末ごとに覚えておけば足りるので localStorage に置く。使えないときは毎回出さない(閉じた記録が残らず、何度も出るのを防ぐ)。

const SEEN_KEY = 'tyoubo-usage-guide-seen'

export function hasSeenUsageGuide(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markUsageGuideSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // 覚えておけなくても、閉じることはできる
  }
}
