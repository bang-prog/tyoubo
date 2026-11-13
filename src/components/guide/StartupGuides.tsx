import { useState } from 'react'
import { hasSeenUsageGuide, markUsageGuideSeen } from '../../lib/guide'
import { installGuideNeeded } from '../../lib/install'
import InstallGuide from '../install/InstallGuide'
import UsageGuide from './UsageGuide'

type Step = 'install' | 'usage' | null

/**
 * 最初に開いたときの案内。iPhone の Safari のタブなら先に「ホーム画面に追加」を出し、
 * 閉じたら続けて使い方の説明を出す。使い方は一度閉じたら、この端末では自動で出さない
 * (設定画面の「使い方を見る」からいつでも見られる)。
 */
export default function StartupGuides() {
  const [step, setStep] = useState<Step>(() => (installGuideNeeded() ? 'install' : hasSeenUsageGuide() ? null : 'usage'))

  if (step === 'install') return <InstallGuide onClose={() => setStep(hasSeenUsageGuide() ? null : 'usage')} />
  if (step === 'usage') {
    return (
      <UsageGuide
        firstRun
        onClose={() => {
          markUsageGuideSeen()
          setStep(null)
        }}
      />
    )
  }
  return null
}
