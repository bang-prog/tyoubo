import { describe, expect, it } from 'vitest'
import { isIOS, isStandalone, shouldShowInstallGuide, type InstallEnv } from './install'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0'

const env = (over: Partial<InstallEnv>): InstallEnv => ({
  userAgent: IPHONE,
  platform: 'iPhone',
  maxTouchPoints: 5,
  displayStandalone: false,
  ...over,
})

describe('ホーム画面に追加の案内', () => {
  it('iPhone の Safari のタブで開いているときだけ案内を出す', () => {
    expect(shouldShowInstallGuide(env({}))).toBe(true)
    expect(shouldShowInstallGuide(env({ navigatorStandalone: true }))).toBe(false)
    expect(shouldShowInstallGuide(env({ displayStandalone: true }))).toBe(false)
  })

  it('iPad は Mac と同じ名前を名のるが、タッチできるかで見分ける', () => {
    expect(isIOS(env({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true)
    expect(isIOS(env({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false)
  })

  it('PC では案内を出さない', () => {
    expect(shouldShowInstallGuide(env({ userAgent: WINDOWS, platform: 'Win32', maxTouchPoints: 0 }))).toBe(false)
    expect(isStandalone(env({ userAgent: WINDOWS, displayStandalone: true }))).toBe(true)
  })
})
