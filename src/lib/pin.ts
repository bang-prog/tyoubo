// 暗証番号(PIN)と復旧コードのハッシュ化(仕様書 §5 F6)。
// これは他の人に画面を触られないための簡易なロックで、データの暗号化ではない。

/** PIN は4〜6桁の数字 */
export const PIN_PATTERN = /^\d{4,6}$/

/** PBKDF2 の繰り返し回数。iPhone でも1秒かからない程度にしている */
const ITERATIONS = 200_000

/** 復旧コードに使う文字。見間違えやすい 0 O 1 I L は使わない */
const RECOVERY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const RECOVERY_LENGTH = 12

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

/** ハッシュに混ぜるソルト(16バイトの乱数) */
export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)))
}

/** PIN や復旧コードを PBKDF2(SHA-256)でハッシュ化する */
export async function hashSecret(secret: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations: ITERATIONS },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

/** 12文字の復旧コード。表示は formatRecoveryCode で4文字ずつ区切る */
export function generateRecoveryCode(): string {
  const chars: string[] = []
  // 文字の種類で割り切れない値は捨てて、どの文字も同じ確率で出るようにする
  const limit = 256 - (256 % RECOVERY_CHARS.length)
  while (chars.length < RECOVERY_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(RECOVERY_LENGTH * 2))) {
      if (b < limit && chars.length < RECOVERY_LENGTH) chars.push(RECOVERY_CHARS[b % RECOVERY_CHARS.length])
    }
  }
  return chars.join('')
}

/** 'ABCD2345EFGH' → 'ABCD-2345-EFGH' */
export function formatRecoveryCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

/** 入力された復旧コードを比べられる形にする(小文字やハイフン、空白を許す) */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
