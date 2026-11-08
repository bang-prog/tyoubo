import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatRecoveryCode, normalizeRecoveryCode, RECOVERY_LENGTH } from '../lib/pin'
import { createBackup, isBackupDue, parseBackup, restoreBackup, summarize } from './backup'
import { addCategory, loadCatalog, saveProduct } from './catalog'
import { saveClosing } from './closings'
import { createDB, type AppDB } from './db'
import { ValidationError } from './errors'
import { disablePin, enablePin, verifyPin, verifyRecoveryCode } from './pin'
import { firstKeptMonth, listPurgeCandidates, purgeMonths } from './purge'
import { createRefund } from './refunds'
import { createSale } from './sales'
import { getSetting, markExported, setSetting, setTaxRate } from './settings'

let db: AppDB
let socks: string

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const goods = await addCategory(db, '小物')
  await saveProduct(db, {
    name: 'ソックス',
    categoryId: goods,
    priceIncl: 990,
    cost: 300,
    sizes: ['F'],
    colors: ['黒'],
    stocks: [{ size: 'F', color: '黒', stock: 50 }],
  })
  socks = (await loadCatalog(db)).products[0].variants[0].id
})

afterEach(async () => {
  await db.delete()
})

/** その日時に1点売る */
const sell = (at: Date) => createSale(db, { lines: [{ variantId: socks, qty: 1 }], received: 1000, expectedTotal: 990 }, at)

describe('暗証番号', () => {
  it('オンにすると PIN と復旧コードで確かめられ、オフにするとハッシュも消える', async () => {
    const code = await enablePin(db, '1234')
    expect(code).toHaveLength(RECOVERY_LENGTH)
    expect(await getSetting(db, 'pinEnabled')).toBe(true)
    expect(await getSetting(db, 'pinHash')).not.toContain('1234')
    expect(await verifyPin(db, '1234')).toBe(true)
    expect(await verifyPin(db, '1235')).toBe(false)
    // 小文字やハイフン付きで入れても通る
    expect(await verifyRecoveryCode(db, formatRecoveryCode(code).toLowerCase())).toBe(true)
    expect(await verifyRecoveryCode(db, 'AAAAAAAAAAAA')).toBe(false)

    await disablePin(db)
    expect(await getSetting(db, 'pinEnabled')).toBe(false)
    expect(await getSetting(db, 'pinHash')).toBeNull()
    expect(await verifyPin(db, '1234')).toBe(false)
  })

  it('4〜6桁の数字以外は受け付けない', async () => {
    for (const pin of ['123', '1234567', '12a4', '']) {
      await expect(enablePin(db, pin)).rejects.toBeInstanceOf(ValidationError)
    }
  })

  it('復旧コードの入力は大文字にし、記号を除いて比べる', () => {
    expect(normalizeRecoveryCode(' abcd-2345 efgh ')).toBe('ABCD2345EFGH')
    expect(formatRecoveryCode('ABCD2345EFGH')).toBe('ABCD-2345-EFGH')
  })
})

describe('税率', () => {
  it('0〜30 の整数だけ保存する', async () => {
    await setTaxRate(db, 8)
    expect(await getSetting(db, 'taxRate')).toBe(8)
    for (const rate of [-1, 31, 8.5, Number.NaN]) {
      await expect(setTaxRate(db, rate)).rejects.toBeInstanceOf(ValidationError)
    }
  })
})

describe('バックアップと復元', () => {
  it('書き出したファイルを別のデータベースに読み込むと同じデータになる。PIN は含めない', async () => {
    const sale = await sell(new Date(2026, 10, 4, 10, 0))
    await createRefund(db, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, qty: 1 }] }, new Date(2026, 10, 5, 10, 0))
    await saveClosing(db, { businessDate: '2026-11-04', openingFloat: 20000, counts: { '1000': 21 }, memo: '' })
    await setTaxRate(db, 8)
    await enablePin(db, '1234')

    const file = await createBackup(db, new Date(2026, 10, 6, 18, 0))
    const text = JSON.stringify(file)
    expect(text).not.toContain('pinHash')
    expect(summarize(file)).toMatchObject({ products: 1, sales: 1, refunds: 1, closings: 1 })

    const other = createDB(`test-${crypto.randomUUID()}`)
    try {
      // 移す先にあったデータは消え、移す先の PIN の設定は残る
      await addCategory(other, '消えるカテゴリー')
      await enablePin(other, '9999')
      await restoreBackup(other, parseBackup(text))

      expect((await other.categories.toArray()).map((c) => c.name)).toEqual(['小物'])
      expect(await other.sales.count()).toBe(1)
      expect(await other.saleItems.count()).toBe(1)
      expect(await other.refunds.count()).toBe(1)
      expect(await other.refundItems.count()).toBe(1)
      expect(await other.closings.count()).toBe(1)
      expect(await getSetting(other, 'taxRate')).toBe(8)
      expect(await getSetting(other, 'lastBackupAt')).toBe(file.exportedAt)
      expect(await verifyPin(other, '9999')).toBe(true)
    } finally {
      await other.delete()
    }
  })

  it('ほかのアプリのファイルや壊れたファイルは読み込まない', async () => {
    const good = JSON.stringify(await createBackup(db))
    expect(() => parseBackup('not json')).toThrow(ValidationError)
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(ValidationError)
    expect(() => parseBackup(good.replace('"format":1', '"format":99'))).toThrow(/新しい形式/)
    const broken = JSON.parse(good)
    broken.tables.sales = [{ noId: true }]
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(ValidationError)
  })

  it('途中で失敗したら元のデータのまま残す', async () => {
    await sell(new Date(2026, 10, 4, 10, 0))
    const file = parseBackup(JSON.stringify(await createBackup(db)))
    // 主キーが重なる会計を入れて、bulkAdd を失敗させる
    file.tables.sales = [...file.tables.sales, ...file.tables.sales]
    file.tables.categories = []
    await expect(restoreBackup(db, file)).rejects.toThrow()
    expect(await db.categories.count()).toBe(1)
    expect(await db.sales.count()).toBe(1)
  })

  it('7日以上バックアップしていないと注意を出す。一度もしていなければ会計があるときだけ', () => {
    const now = new Date('2026-11-08T12:00:00+09:00')
    expect(isBackupDue(null, false, now)).toBe(false)
    expect(isBackupDue(null, true, now)).toBe(true)
    expect(isBackupDue('2026-11-02T12:00:00+09:00', true, now)).toBe(false)
    expect(isBackupDue('2026-11-01T12:00:00+09:00', true, now)).toBe(true)
  })
})

describe('古いデータの削除', () => {
  const today = '2026-10-24'

  it('残すのは今月と直近3か月', () => {
    expect(firstKeptMonth(today)).toBe('2026-07')
    expect(firstKeptMonth('2026-02-10')).toBe('2025-11')
  })

  it('削除できる月に、件数と出力済みか、バックアップ済みかを出す', async () => {
    await sell(new Date(2026, 4, 10, 10, 0)) // 5月
    await sell(new Date(2026, 5, 10, 10, 0)) // 6月
    await sell(new Date(2026, 5, 11, 10, 0)) // 6月
    await sell(new Date(2026, 6, 1, 10, 0)) // 7月(残す月)
    await markExported(db, ['2026-05'])
    await setSetting(db, 'lastBackupAt', '2026-06-20T10:00:00+09:00')

    expect(await listPurgeCandidates(db, today)).toEqual([
      { month: '2026-05', sales: 1, refunds: 0, closings: 0, exported: true, backedUp: true },
      { month: '2026-06', sales: 2, refunds: 0, closings: 0, exported: false, backedUp: false },
    ])
  })

  it('選んだ月の会計・明細・返品・レジ締めだけを消し、商品と在庫は残す', async () => {
    const june = await sell(new Date(2026, 5, 10, 10, 0))
    await createRefund(db, { saleId: june.id, items: [{ saleItemId: june.items[0].id, qty: 1 }] }, new Date(2026, 5, 12, 10, 0))
    await saveClosing(db, { businessDate: '2026-06-10', openingFloat: 0, counts: {}, memo: '' }, new Date(2026, 5, 10, 20, 0))
    await sell(new Date(2026, 6, 1, 10, 0))
    await markExported(db, ['2026-06'])
    const stock = (await db.variants.get(socks))!.stock

    await purgeMonths(db, ['2026-06'], today)

    expect(await db.sales.count()).toBe(1)
    expect(await db.saleItems.count()).toBe(1)
    expect(await db.refunds.count()).toBe(0)
    expect(await db.refundItems.count()).toBe(0)
    expect(await db.closings.count()).toBe(0)
    expect((await db.variants.get(socks))!.stock).toBe(stock)
    expect(await db.products.count()).toBe(1)
    expect(await getSetting(db, 'purgedMonths')).toEqual(['2026-06'])
    expect(await listPurgeCandidates(db, today)).toEqual([])
  })

  it('Excel を出力していない月と、保存期間中の月は消さない', async () => {
    await sell(new Date(2026, 5, 10, 10, 0))
    await markExported(db, ['2026-07'])
    await expect(purgeMonths(db, ['2026-06'], today)).rejects.toThrow(/Excel を出力していない/)
    await expect(purgeMonths(db, ['2026-07'], today)).rejects.toThrow(/保存期間中/)
    expect(await db.sales.count()).toBe(1)
    expect(await getSetting(db, 'purgedMonths')).toEqual([])
  })
})
