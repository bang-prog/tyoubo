// 帳簿の Excel(.xlsx)を作る(仕様書 §7)。
// ExcelJS は大きいので、出力するときだけ読み込む(アプリの起動を遅くしないため)。

import type { LedgerData, LedgerRow } from '../db/ledger'
import { sizeLabel } from './labels'
import { PAYMENT_LABELS, paymentMethodOf } from './payment'
import { formatBusinessDate, timeOf } from './time'

const YEN = '#,##0'
const PERCENT = '0.0%'

type Column = { header: string; width: number; format?: string }
/** null は空欄 */
type Cell = string | number | null

/** ファイル名。1か月分は 帳簿_2026-11.xlsx、1年分は 帳簿_2026.xlsx、1日分は 帳簿_2026-11-07.xlsx */
export function ledgerFileName(data: LedgerData): string {
  return `帳簿_${data.period}.xlsx`
}

/**
 * Excel を出力したことにする月('YYYY-MM')。古いデータの削除(仕様書 F8)で使う。
 * 1日分の出力では、その月のほかの日が含まれないので、月を出力したことにはしない。
 */
export function exportedMonthsOf(data: LedgerData): string[] {
  if (data.mode === 'date') return []
  return data.mode === 'day' ? [data.period] : data.rows.map((r) => r.key)
}

function summaryRow(label: string, r: LedgerRow): Cell[] {
  const note = r.count === 0 && r.refundIncl === 0 ? '会計なし' : ''
  return [label, r.count, r.salesIncl, r.salesExcl, r.salesTax, r.refundIncl, r.refundTax, r.netIncl, note]
}

/** 帳簿の Excel を作り、ファイルの中身を返す。 */
export async function buildLedgerWorkbook(data: LedgerData): Promise<ArrayBuffer> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'レジ帳簿'
  wb.created = new Date()

  function addSheet(name: string, columns: Column[], rows: Cell[][], totalRow?: Cell[]) {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = columns.map((c) => ({ header: c.header, width: c.width }))
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF4' } }
    for (const row of rows) ws.addRow(row)
    if (totalRow) ws.addRow(totalRow).font = { bold: true }
    columns.forEach((c, i) => {
      if (c.format) ws.getColumn(i + 1).numFmt = c.format
    })
  }

  // 1. 集計
  addSheet(
    '集計',
    [
      { header: data.mode === 'month' ? '月' : '日付', width: 14 },
      { header: '件数', width: 8 },
      { header: '売上(税込)', width: 14, format: YEN },
      { header: '税抜', width: 14, format: YEN },
      { header: '消費税', width: 12, format: YEN },
      { header: '返金(税込)', width: 14, format: YEN },
      { header: '返金の消費税', width: 14, format: YEN },
      { header: '差引売上', width: 14, format: YEN },
      { header: '備考', width: 12 },
    ],
    data.rows.map((r) => summaryRow(r.key, r)),
    summaryRow('合計', data.total),
  )

  // 2. 会計一覧
  addSheet(
    '会計一覧',
    [
      { header: '会計番号', width: 16 },
      { header: '日付', width: 12 },
      { header: '時刻', width: 8 },
      { header: '支払い方法', width: 16 },
      { header: '点数', width: 8 },
      { header: '合計(税込)', width: 14, format: YEN },
      { header: '税抜', width: 14, format: YEN },
      { header: '消費税', width: 12, format: YEN },
      { header: 'お預かり', width: 14, format: YEN },
      { header: 'お釣り', width: 12, format: YEN },
    ],
    data.sales.map((s) => [
      s.saleNo,
      s.businessDate,
      timeOf(s.soldAt),
      PAYMENT_LABELS[paymentMethodOf(s)],
      s.items.reduce((sum, i) => sum + i.qty, 0),
      s.totalIncl,
      s.totalExcl,
      s.taxAmount,
      // お預かりとお釣りは現金のときだけ(キャッシュレスは空欄)
      paymentMethodOf(s) === 'cash' ? s.received : null,
      paymentMethodOf(s) === 'cash' ? s.change : null,
    ]),
  )

  // 3. 売上明細
  addSheet(
    '売上明細',
    [
      { header: '会計番号', width: 16 },
      { header: '日付', width: 12 },
      { header: '時刻', width: 8 },
      { header: '商品名', width: 28 },
      { header: 'カテゴリー', width: 14 },
      { header: '色', width: 10 },
      { header: 'サイズ', width: 10 },
      { header: '数量', width: 8 },
      { header: '単価(税込)', width: 12, format: YEN },
      { header: '金額(税込)', width: 12, format: YEN },
      { header: '返品数', width: 8 },
    ],
    data.sales.flatMap((s) =>
      s.items.map((i) => [
        s.saleNo,
        s.businessDate,
        timeOf(s.soldAt),
        i.productName,
        i.categoryName,
        i.color,
        sizeLabel(i.size),
        i.qty,
        i.unitPriceIncl,
        i.lineTotal,
        i.returnedQty,
      ]),
    ),
  )

  // 4. 返品(消費税は返品ごとに計算しているので、1回の返品を1行にする)
  addSheet(
    '返品',
    [
      { header: '返品日', width: 12 },
      { header: '時刻', width: 8 },
      { header: '元の会計番号', width: 16 },
      { header: '返品した商品', width: 40 },
      { header: '点数', width: 8 },
      { header: '返金方法', width: 16 },
      { header: '返金額(税込)', width: 14, format: YEN },
      { header: '税抜', width: 14, format: YEN },
      { header: '消費税', width: 12, format: YEN },
      { header: 'メモ', width: 24 },
    ],
    data.refunds.map((r) => [
      r.businessDate,
      timeOf(r.refundedAt),
      r.saleNo,
      r.items
        .map((i) =>
          i.saleItem ? `${i.saleItem.productName}(${i.saleItem.color}/${sizeLabel(i.saleItem.size)})×${i.qty}` : `×${i.qty}`,
        )
        .join('、'),
      r.items.reduce((sum, i) => sum + i.qty, 0),
      PAYMENT_LABELS[paymentMethodOf(r)],
      r.amountIncl,
      r.amountExcl,
      r.taxAmount,
      r.memo,
    ]),
  )

  // 5. カテゴリー別
  const categoryQty = data.categories.reduce((sum, c) => sum + c.qty, 0)
  const categoryAmount = data.categories.reduce((sum, c) => sum + c.amountIncl, 0)
  addSheet(
    'カテゴリー別',
    [
      { header: 'カテゴリー', width: 18 },
      { header: '点数', width: 8 },
      { header: '売上(税込)', width: 14, format: YEN },
      { header: '構成比', width: 10, format: PERCENT },
    ],
    data.categories.map((c) => [c.name, c.qty, c.amountIncl, c.share]),
    ['合計', categoryQty, categoryAmount, categoryAmount ? 1 : 0],
  )

  // 6. 支払い方法別
  const paymentTotal = data.payments.reduce(
    (t, p) => ({ count: t.count + p.count, sales: t.sales + p.salesIncl, refund: t.refund + p.refundIncl }),
    { count: 0, sales: 0, refund: 0 },
  )
  addSheet(
    '支払い方法別',
    [
      { header: '支払い方法', width: 18 },
      { header: '件数', width: 8 },
      { header: '売上(税込)', width: 14, format: YEN },
      { header: '返金(税込)', width: 14, format: YEN },
      { header: '差引売上', width: 14, format: YEN },
    ],
    data.payments.map((p) => [PAYMENT_LABELS[p.method], p.count, p.salesIncl, p.refundIncl, p.netIncl]),
    ['合計', paymentTotal.count, paymentTotal.sales, paymentTotal.refund, paymentTotal.sales - paymentTotal.refund],
  )

  // 7. レジ締め
  addSheet(
    'レジ締め',
    [
      { header: '日付', width: 12 },
      { header: '釣り銭準備金', width: 14, format: YEN },
      { header: '現金売上', width: 14, format: YEN },
      { header: '返金', width: 12, format: YEN },
      { header: 'レジにあるはずの現金', width: 20, format: YEN },
      { header: '数えた現金', width: 14, format: YEN },
      { header: '過不足', width: 12, format: YEN },
      { header: 'メモ', width: 28 },
      { header: '保存した日時', width: 22 },
    ],
    data.closings.map((c) => [
      c.businessDate,
      c.openingFloat,
      c.cashSales,
      c.refundsTotal,
      c.expected,
      c.countedTotal,
      c.difference,
      c.memo,
      `${formatBusinessDate(c.closedAt.slice(0, 10))} ${timeOf(c.closedAt)}`,
    ]),
  )

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
