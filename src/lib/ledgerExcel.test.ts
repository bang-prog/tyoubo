import 'fake-indexeddb/auto'

import ExcelJS from 'exceljs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCategory, loadCatalog, saveProduct } from '../db/catalog'
import { saveClosing } from '../db/closings'
import { createDB, type AppDB } from '../db/db'
import { loadLedger } from '../db/ledger'
import { createRefund } from '../db/refunds'
import { createSale } from '../db/sales'
import { getSetting, markExported } from '../db/settings'
import { buildLedgerWorkbook, exportedMonthsOf, ledgerFileName } from './ledgerExcel'

let db: AppDB
const at = (d: number, h = 12) => new Date(2026, 10, d, h)

beforeEach(async () => {
  db = createDB(`test-${crypto.randomUUID()}`)
  const tops = await addCategory(db, 'トップス')
  await saveProduct(db, { name: 'シャツ', categoryId: tops, priceIncl: 6980, cost: 0, sizes: ['M'], colors: ['白'], stocks: [{ size: 'M', color: '白', stock: 10 }] })
  const variantId = (await loadCatalog(db)).products[0].variants[0].id
  const sale = await createSale(db, { lines: [{ variantId, qty: 2 }], received: 20000, expectedTotal: 13960 }, at(2))
  await createRefund(db, { saleId: sale.id, items: [{ saleItemId: sale.items[0].id, qty: 1 }], memo: '色違い' }, at(3))
  await saveClosing(db, { businessDate: '2026-11-02', openingFloat: 30000, counts: { '10000': 4, '1000': 3 }, memo: '' }, at(2, 19))
})

afterEach(async () => {
  await db.delete()
})

async function readBack(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb
}

describe('buildLedgerWorkbook', () => {
  it('6つのシートがあり、金額は数値で「#,##0」の形', async () => {
    const data = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    const wb = await readBack(await buildLedgerWorkbook(data))
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['集計', '会計一覧', '売上明細', '返品', 'カテゴリー別', 'レジ締め'])

    const summary = wb.getWorksheet('集計')!
    // 見出し + 11/1〜11/7 の7行 + 合計
    expect(summary.rowCount).toBe(9)
    const total = summary.getRow(9)
    expect(total.getCell(1).value).toBe('合計')
    expect(total.getCell(3).value).toBe(13960) // 売上
    expect(total.getCell(6).value).toBe(6980) // 返金
    expect(total.getCell(8).value).toBe(6980) // 差引売上
    expect(total.getCell(3).numFmt).toBe('#,##0')
    expect(summary.getRow(2).getCell(9).value).toBe('会計なし') // 11/1
  })

  it('明細・返品・レジ締めの中身', async () => {
    const data = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    const wb = await readBack(await buildLedgerWorkbook(data))
    expect(wb.getWorksheet('売上明細')!.getRow(2).values).toEqual([
      undefined, '20261102-001', '2026-11-02', '12:00', 'シャツ', 'トップス', '白', 'M', 2, 6980, 13960, 1,
    ])
    const refund = wb.getWorksheet('返品')!.getRow(2)
    expect(refund.getCell(3).value).toBe('20261102-001')
    expect(refund.getCell(4).value).toBe('シャツ(白/M)×1')
    expect(refund.getCell(9).value).toBe('色違い')
    const closing = wb.getWorksheet('レジ締め')!.getRow(2)
    expect(closing.getCell(5).value).toBe(43960) // 30,000 + 13,960
    expect(closing.getCell(7).value).toBe(-960) // 数えたのは 43,000。43,000 − 43,960
    const category = wb.getWorksheet('カテゴリー別')!.getRow(2)
    expect(category.getCell(4).value).toBe(1)
    expect(category.getCell(4).numFmt).toBe('0.0%')
  })
})

describe('ファイル名と出力した月', () => {
  it('日別は1か月、月別はその年の今月まで、1日分は月に数えない', async () => {
    const day = await loadLedger(db, 'day', '2026-11', '2026-11-07')
    const year = await loadLedger(db, 'month', '2026', '2026-11-07')
    const date = await loadLedger(db, 'date', '2026-11-02', '2026-11-07')
    expect(ledgerFileName(day)).toBe('帳簿_2026-11.xlsx')
    expect(ledgerFileName(year)).toBe('帳簿_2026.xlsx')
    expect(ledgerFileName(date)).toBe('帳簿_2026-11-02.xlsx')
    expect(exportedMonthsOf(day)).toEqual(['2026-11'])
    expect(exportedMonthsOf(year)).toHaveLength(11)
    expect(exportedMonthsOf(date)).toEqual([])
  })

  it('1日分の Excel は、集計がその日1行と合計', async () => {
    const date = await loadLedger(db, 'date', '2026-11-02', '2026-11-07')
    const wb = await readBack(await buildLedgerWorkbook(date))
    const summary = wb.getWorksheet('集計')!
    expect(summary.rowCount).toBe(3)
    expect(summary.getRow(1).getCell(1).value).toBe('日付')
    expect(summary.getRow(2).getCell(1).value).toBe('2026-11-02')
    expect(summary.getRow(3).getCell(3).value).toBe(13960)
    expect(wb.getWorksheet('レジ締め')!.rowCount).toBe(2)
  })

  it('出力した月を重ならないように記録する', async () => {
    await markExported(db, ['2026-11'])
    await markExported(db, ['2026-10', '2026-11'])
    expect(await getSetting(db, 'exportedMonths')).toEqual(['2026-10', '2026-11'])
  })
})
