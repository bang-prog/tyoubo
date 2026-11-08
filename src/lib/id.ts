/**
 * データの id(UUID v4)を作る。
 * crypto.randomUUID は https か localhost でしか使えないので、開発中に iPhone から
 * IP アドレス(http)で開いたときは、どこでも使える crypto.getRandomValues で同じ形の id を作る。
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function' && globalThis.isSecureContext !== false) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // バージョン 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 の形式
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
