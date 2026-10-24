import { useEffect, useState } from 'react'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function format(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]}) ${hh}:${mm}`
}

/** ヘッダーの日付と時刻。分が変わったら表示を更新する。 */
export default function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // 10秒ごとに確認すれば、分の切り替わりから大きく遅れない
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <time className={`num ${className ?? ''}`} dateTime={now.toISOString()}>
      {format(now)}
    </time>
  )
}
