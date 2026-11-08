// 支払い方法(仕様書 §3、§5 F2)。キャッシュレスの決済は Square のアプリで行い、このアプリは記録だけをする。

export const PAYMENT_METHODS = ['cash', 'card', 'emoney', 'qr'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'クレジットカード',
  emoney: '電子マネー',
  qr: 'QRコード',
}

/** 狭い場所(バッジやボタン)に出す短い名前 */
export const PAYMENT_SHORT_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'カード',
  emoney: '電子マネー',
  qr: 'QR',
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** v1.3 までのデータには支払い方法がないので、現金として扱う */
export function paymentMethodOf(record: { paymentMethod?: PaymentMethod }): PaymentMethod {
  return record.paymentMethod ?? 'cash'
}
