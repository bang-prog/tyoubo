import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import SaleDetailPanel from '../components/history/SaleDetailPanel'
import SaleList from '../components/history/SaleList'
import { db } from '../db/db'
import { loadDayHistory } from '../db/history'
import { getSetting } from '../db/settings'
import { formatYen } from '../lib/money'
import { addDays, businessDateOf, formatBusinessDate, isBusinessDate } from '../lib/time'
import styles from './HistoryPage.module.css'

/** 会計履歴(仕様書 §5 F3)。表示する日は URL の ?date=YYYY-MM-DD で持つ。 */
export default function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const today = businessDateOf()
  const param = params.get('date') ?? ''
  const date = isBusinessDate(param) ? param : today

  const day = useLiveQuery(() => loadDayHistory(db, date), [date])
  const purgedMonths = useLiveQuery(() => getSetting(db, 'purgedMonths'), []) ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** スマホで明細を全面に開いているか(仕様書 §10.1)。PC・iPad では一覧と明細を並べるので使わない */
  const [detailOpen, setDetailOpen] = useState(false)
  const pageRef = useRef<HTMLElement>(null)

  function goTo(next: string) {
    setParams(next === today ? {} : { date: next })
    setSelectedId(null)
    setDetailOpen(false)
  }

  // 選んでいる会計がその日になければ、一番新しい会計を表示する
  const selected =
    day && day.businessDate === date
      ? (day.sales.find((s) => s.id === selectedId) ?? day.sales[0])
      : undefined

  return (
    <section ref={pageRef} className={styles.page}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.navButton} onClick={() => goTo(addDays(date, -1))} aria-label="前の日">
          ‹
        </button>
        <h2 className={styles.date}>{formatBusinessDate(date)}</h2>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => goTo(addDays(date, 1))}
          disabled={date >= today}
          aria-label="次の日"
        >
          ›
        </button>
        <button type="button" className="btn btn-sm" onClick={() => goTo(today)} disabled={date === today}>
          今日
        </button>

        {day && (
          <dl className={styles.summary}>
            <div>
              <dt>会計</dt>
              <dd className="num">{day.sales.length}件</dd>
            </div>
            <div>
              <dt>現金売上</dt>
              <dd className="num">{formatYen(day.salesTotal)}</dd>
            </div>
            <div>
              <dt>返金</dt>
              <dd className="num">{formatYen(day.refundsTotal)}</dd>
            </div>
          </dl>
        )}
      </div>

      {!day || day.businessDate !== date ? (
        <p className="hint">読み込み中…</p>
      ) : day.sales.length === 0 ? (
        <p className={styles.empty}>
          {purgedMonths.includes(date.slice(0, 7)) ? 'この月のデータは削除済みです。' : 'この日の会計はありません。'}
        </p>
      ) : (
        <div className={styles.body} data-view={detailOpen ? 'detail' : 'list'}>
          <SaleList
            sales={day.sales}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setSelectedId(id)
              setDetailOpen(true)
              pageRef.current?.scrollTo({ top: 0 })
            }}
          />
          {selected && (
            <div className={styles.detail}>
              <button type="button" className={`btn btn-sm ${styles.back}`} onClick={() => setDetailOpen(false)}>
                ‹ 一覧に戻る
              </button>
              {/* 別の会計を選んだら、返品のチェックなどを消して作り直す */}
              <SaleDetailPanel key={selected.id} sale={selected} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
