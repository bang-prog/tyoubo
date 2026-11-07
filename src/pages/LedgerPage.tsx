import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import CategoryTable from '../components/ledger/CategoryTable'
import LedgerSummary from '../components/ledger/LedgerSummary'
import LedgerTable from '../components/ledger/LedgerTable'
import { db } from '../db/db'
import { userMessage } from '../db/errors'
import { loadLedger, type LedgerMode } from '../db/ledger'
import { markExported } from '../db/settings'
import { downloadFile, XLSX_MIME } from '../lib/download'
import { buildLedgerWorkbook, exportedMonthsOf, ledgerFileName } from '../lib/ledgerExcel'
import { businessDateOf } from '../lib/time'
import styles from './LedgerPage.module.css'

/** 'YYYY-MM' を months か月ずらす */
function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 帳簿(仕様書 §5 F5)。日別(月を選ぶ)と月別(年を選ぶ)を切り替える。
 * 表示している期間は URL の ?mode=day&month=YYYY-MM / ?mode=month&year=YYYY で持つ。
 */
export default function LedgerPage() {
  const [params, setParams] = useSearchParams()
  const today = businessDateOf()
  const thisMonth = today.slice(0, 7)
  const thisYear = today.slice(0, 4)

  const mode: LedgerMode = params.get('mode') === 'month' ? 'month' : 'day'
  const monthParam = params.get('month') ?? ''
  const yearParam = params.get('year') ?? ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth
  const year = /^\d{4}$/.test(yearParam) && yearParam <= thisYear ? yearParam : thisYear
  const period = mode === 'day' ? month : year

  const data = useLiveQuery(() => loadLedger(db, mode, period, today), [mode, period, today])
  /** 出力している期間('YYYY-MM' / 'YYYY' / 'YYYY-MM-DD')。出力中は次の出力を押せなくする */
  const [exporting, setExporting] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  function go(nextMode: LedgerMode, nextPeriod: string) {
    setParams(nextMode === 'day' ? { mode: 'day', month: nextPeriod } : { mode: 'month', year: nextPeriod })
    setNotice(null)
    setError(null)
  }

  const canGoNext = mode === 'day' ? month < thisMonth : year < thisYear
  const periodLabel = mode === 'day' ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : `${year}年`

  /** 表示している期間(1か月・1年)か、表で選んだ1日・1か月の Excel を出力する */
  async function exportLedger(exportMode: LedgerMode, exportPeriod: string) {
    if (exporting) return
    setExporting(exportPeriod)
    setNotice(null)
    setError(null)
    try {
      const target = await loadLedger(db, exportMode, exportPeriod, today)
      const buffer = await buildLedgerWorkbook(target)
      const fileName = ledgerFileName(target)
      downloadFile(buffer, fileName, XLSX_MIME)
      await markExported(db, exportedMonthsOf(target))
      setNotice(`${fileName} を出力しました。お店の帳簿として保存しておいてください。`)
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setExporting(null)
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.seg} role="group" aria-label="集計の単位">
          <button type="button" aria-pressed={mode === 'day'} onClick={() => go('day', month)}>
            日別
          </button>
          <button type="button" aria-pressed={mode === 'month'} onClick={() => go('month', year)}>
            月別
          </button>
        </div>
        <div className={styles.periodNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => go(mode, mode === 'day' ? shiftMonth(month, -1) : String(Number(year) - 1))}
            aria-label={mode === 'day' ? '前の月' : '前の年'}
          >
            ‹
          </button>
          <h2 className={styles.period}>{periodLabel}</h2>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => go(mode, mode === 'day' ? shiftMonth(month, 1) : String(Number(year) + 1))}
            disabled={!canGoNext}
            aria-label={mode === 'day' ? '次の月' : '次の年'}
          >
            ›
          </button>
        </div>
        <button
          type="button"
          className={`btn btn-primary ${styles.export}`}
          onClick={() => void exportLedger(mode, period)}
          disabled={!data || Boolean(exporting)}
        >
          {exporting === period ? '作成しています…' : mode === 'day' ? 'この月の Excel をダウンロード' : 'この年の Excel をダウンロード'}
        </button>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {!data || data.period !== period || data.mode !== mode ? (
        <p className="hint">読み込み中…</p>
      ) : (
        <>
          <LedgerSummary total={data.total} />
          <div className={styles.grid}>
            <div className="panel">
              <h3 className={styles.heading}>{mode === 'day' ? '日別の売上' : '月別の売上'}</h3>
              <LedgerTable
                mode={mode}
                rows={data.rows}
                total={data.total}
                // 日別の行は1日分、月別の行は1か月分(日別表示の「この月の Excel」と同じ中身)を出力する
                onDownloadRow={(key) => void exportLedger(mode === 'day' ? 'date' : 'day', key)}
                downloadingKey={exporting}
              />
              <p className="hint">
                {mode === 'day'
                  ? '各日の「保存」で、その日1日分の Excel を出力できます。'
                  : '各月の「保存」で、その月1か月分の Excel を出力できます。'}
              </p>
            </div>
            <div className="panel">
              <h3 className={styles.heading}>カテゴリー別の売上</h3>
              <CategoryTable categories={data.categories} />
            </div>
          </div>
        </>
      )}
    </section>
  )
}
