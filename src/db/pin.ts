// 暗証番号の設定と確認(仕様書 §5 F6)。

import { generateRecoveryCode, generateSalt, hashSecret, normalizeRecoveryCode, PIN_PATTERN } from '../lib/pin'
import type { AppDB } from './db'
import { ValidationError } from './errors'
import { getSetting, setSetting } from './settings'

/**
 * PIN をオンにする(変更も同じ)。新しい復旧コードを返すので、画面に1回だけ表示する。
 * ハッシュの計算はトランザクションの外で行う(トランザクションの中で別の非同期処理を待つと、
 * IndexedDB のトランザクションが閉じてしまうため)。
 */
export async function enablePin(db: AppDB, pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) throw new ValidationError('暗証番号は4〜6桁の数字にしてください。')
  const salt = generateSalt()
  const recoveryCode = generateRecoveryCode()
  const [pinHash, recoveryHash] = await Promise.all([hashSecret(pin, salt), hashSecret(recoveryCode, salt)])
  await db.transaction('rw', db.settings, async () => {
    await setSetting(db, 'pinSalt', salt)
    await setSetting(db, 'pinHash', pinHash)
    await setSetting(db, 'recoveryHash', recoveryHash)
    await setSetting(db, 'pinEnabled', true)
  })
  return recoveryCode
}

/** PIN をオフにし、ハッシュも消す */
export async function disablePin(db: AppDB): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await setSetting(db, 'pinEnabled', false)
    await setSetting(db, 'pinHash', null)
    await setSetting(db, 'pinSalt', null)
    await setSetting(db, 'recoveryHash', null)
  })
}

async function matches(db: AppDB, key: 'pinHash' | 'recoveryHash', secret: string): Promise<boolean> {
  const [salt, hash] = await Promise.all([getSetting(db, 'pinSalt'), getSetting(db, key)])
  if (!salt || !hash || !secret) return false
  return (await hashSecret(secret, salt)) === hash
}

export function verifyPin(db: AppDB, pin: string): Promise<boolean> {
  return matches(db, 'pinHash', pin)
}

export function verifyRecoveryCode(db: AppDB, code: string): Promise<boolean> {
  return matches(db, 'recoveryHash', normalizeRecoveryCode(code))
}
