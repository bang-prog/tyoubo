import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import PinDialog, { type PinAction } from '../components/settings/PinDialog'
import RestoreDialog from '../components/settings/RestoreDialog'
import { BACKUP_DESTINATION_HINT, useBackupDownload } from '../components/useBackupDownload'
import { parseBackup, type BackupFile } from '../db/backup'
import { db } from '../db/db'
import { userMessage } from '../db/errors'
import { getSetting, setTaxRate } from '../db/settings'
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '../lib/storage'
import { formatDateTime } from '../lib/time'
import styles from './SettingsPage.module.css'

async function loadSettings() {
  const [pinEnabled, lastBackupAt, taxRate] = await Promise.all([
    getSetting(db, 'pinEnabled'),
    getSetting(db, 'lastBackupAt'),
    getSetting(db, 'taxRate'),
  ])
  return { pinEnabled, lastBackupAt, taxRate }
}

/** 設定(仕様書 §5 設定画面)。暗証番号、バックアップと復元、データの保存状態、税率、バージョン */
export default function SettingsPage() {
  const settings = useLiveQuery(loadSettings, [])

  // ---------- 暗証番号 ----------
  const [pinAction, setPinAction] = useState<PinAction | null>(null)
  const [pinNotice, setPinNotice] = useState<string | null>(null)

  // ---------- バックアップと復元 ----------
  const backup = useBackupDownload()
  const fileInput = useRef<HTMLInputElement>(null)
  const [restoring, setRestoring] = useState<{ file: BackupFile; name: string } | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    // 同じファイルをもう一度選んでも反応するように、選んだ内容を空にしておく
    e.target.value = ''
    if (!picked) return
    setRestoreNotice(null)
    setRestoreError(null)
    try {
      setRestoring({ file: parseBackup(await picked.text()), name: picked.name })
    } catch (err) {
      setRestoreError(userMessage(err))
    }
  }

  // ---------- データの保存状態 ----------
  const [storage, setStorage] = useState<StorageStatus | null>(null)
  const [storageBusy, setStorageBusy] = useState(false)
  useEffect(() => {
    let alive = true
    void getStorageStatus().then((s) => alive && setStorage(s))
    return () => {
      alive = false
    }
  }, [])

  async function askPersist() {
    setStorageBusy(true)
    await requestPersistentStorage()
    setStorage(await getStorageStatus())
    setStorageBusy(false)
  }

  // ---------- 税率 ----------
  const [taxText, setTaxText] = useState<string | null>(null)
  const [taxNotice, setTaxNotice] = useState<string | null>(null)
  const [taxError, setTaxError] = useState<string | null>(null)

  async function saveTax() {
    setTaxNotice(null)
    setTaxError(null)
    const text = (taxText ?? '').trim()
    try {
      await setTaxRate(db, /^\d+$/.test(text) ? Number(text) : Number.NaN)
      setTaxText(null)
      setTaxNotice('税率を保存しました。これからの会計と返品に使います。')
    } catch (e) {
      setTaxError(userMessage(e))
    }
  }

  if (!settings) {
    return (
      <section className={styles.page}>
        <p className="hint">読み込み中…</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>設定</h2>

      <div className={styles.sections}>
        {/* ---------- 暗証番号(F6) ---------- */}
        <section className="panel" aria-labelledby="pin-heading">
          <div className={styles.head}>
            <h3 id="pin-heading" className={styles.heading}>
              暗証番号
            </h3>
            <span className={settings.pinEnabled ? 'badge badge-good' : 'badge badge-muted'}>
              {settings.pinEnabled ? 'オン' : 'オフ'}
            </span>
          </div>
          <p className="hint">
            オンにすると、アプリを閉じてもう一度開いたときに暗証番号を求めます。開いたままなら求めません。
            <br />
            これは他の人に画面を触られないための簡易なロックで、データの暗号化ではありません。
          </p>
          {pinNotice && <p className="notice">{pinNotice}</p>}
          <div className={styles.buttons}>
            {settings.pinEnabled ? (
              <>
                <button type="button" className="btn" onClick={() => setPinAction('change')}>
                  暗証番号を変更
                </button>
                <button type="button" className="btn" onClick={() => setPinAction('disable')}>
                  オフにする
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setPinAction('enable')}>
                オンにする
              </button>
            )}
          </div>
        </section>

        {/* ---------- バックアップと復元(F7) ---------- */}
        <section className="panel" aria-labelledby="backup-heading">
          <h3 id="backup-heading" className={styles.heading}>
            バックアップと復元
          </h3>
          <dl className={styles.facts}>
            <div>
              <dt>最後のバックアップ</dt>
              <dd className="num">{settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : 'まだありません'}</dd>
            </div>
          </dl>
          <p className="hint">
            全データ(商品、在庫、会計、返品、レジ締め、設定)を1つのファイルに保存します。暗証番号は含みません。
            {BACKUP_DESTINATION_HINT}
          </p>
          {backup.message && <p className="notice">{backup.message}</p>}
          {backup.error && <p className="error">{backup.error}</p>}
          <div className={styles.buttons}>
            <button type="button" className="btn btn-primary" onClick={() => void backup.run()} disabled={backup.busy}>
              {backup.busy ? '保存しています…' : 'バックアップを保存'}
            </button>
          </div>

          <h4 className={styles.subheading}>バックアップから戻す</h4>
          <p className="hint">
            保存したバックアップファイルを選ぶと、中身を確認してから読み込みます。端末を変えるときもこの方法でデータを移します。
          </p>
          {restoreNotice && <p className="notice">{restoreNotice}</p>}
          {restoreError && <p className="error">{restoreError}</p>}
          <div className={styles.buttons}>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
              ファイルを選んで読み込む
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void pickFile(e)}
            />
          </div>
        </section>

        {/* ---------- データの保存状態 ---------- */}
        <section className="panel" aria-labelledby="storage-heading">
          <h3 id="storage-heading" className={styles.heading}>
            データの保存状態
          </h3>
          <p className="hint">データはこの端末のブラウザの中だけに保存しています。外部には送りません。</p>
          {!storage ? (
            <p className="hint">確認しています…</p>
          ) : (
            <>
              <dl className={styles.facts}>
                <div>
                  <dt>消されにくい保存(永続ストレージ)</dt>
                  <dd>
                    {storage.persisted === null ? '確認できません' : storage.persisted ? '許可されています' : '許可されていません'}
                  </dd>
                </div>
                <div>
                  <dt>使っている容量</dt>
                  <dd className="num">
                    {storage.usage === null
                      ? '確認できません'
                      : `${formatBytes(storage.usage)}${storage.quota ? ` / 目安 ${formatBytes(storage.quota)}` : ''}`}
                  </dd>
                </div>
              </dl>
              {storage.persisted === false && (
                <>
                  <p className="hint">
                    許可されていないと、端末の空き容量が少なくなったときや、しばらく開かなかったときに、ブラウザがデータを消すことがあります。
                    iPhone ではホーム画面に追加して使うと許可されやすくなります。こまめにバックアップを保存してください。
                  </p>
                  <div className={styles.buttons}>
                    <button type="button" className="btn btn-sm" onClick={() => void askPersist()} disabled={storageBusy}>
                      もう一度許可をリクエスト
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* ---------- 税率 ---------- */}
        <section className="panel" aria-labelledby="tax-heading">
          <h3 id="tax-heading" className={styles.heading}>
            消費税率
          </h3>
          <form
            className={styles.taxForm}
            onSubmit={(e) => {
              e.preventDefault()
              void saveTax()
            }}
          >
            <label className="sr-only" htmlFor="tax-rate">
              消費税率(%)
            </label>
            <input
              id="tax-rate"
              className={`input num ${styles.taxInput}`}
              inputMode="numeric"
              value={taxText ?? String(settings.taxRate)}
              onChange={(e) => setTaxText(e.target.value)}
              autoComplete="off"
            />
            <span>%</span>
            <button type="submit" className="btn" disabled={taxText === null || taxText.trim() === String(settings.taxRate)}>
              保存
            </button>
          </form>
          <p className="hint">衣料品は10%です。変えると、これからの会計と返品の消費税に使います。保存済みの会計は変わりません。</p>
          {taxNotice && <p className="notice">{taxNotice}</p>}
          {taxError && <p className="error">{taxError}</p>}
        </section>

        {/* ---------- 古いデータの削除・バージョン ---------- */}
        <section className="panel" aria-labelledby="other-heading">
          <h3 id="other-heading" className={styles.heading}>
            そのほか
          </h3>
          <p className="hint">
            古いデータの削除は、<Link to="/ledger">帳簿</Link>の画面の「古いデータの削除」から行います。
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>アプリのバージョン</dt>
              <dd className="num">{__APP_VERSION__}</dd>
            </div>
          </dl>
        </section>
      </div>

      {pinAction && (
        <PinDialog
          action={pinAction}
          onClose={() => setPinAction(null)}
          onDone={(message) => {
            setPinAction(null)
            setPinNotice(message)
          }}
        />
      )}

      {restoring && (
        <RestoreDialog
          file={restoring.file}
          fileName={restoring.name}
          onClose={() => setRestoring(null)}
          onDone={() => {
            setRestoring(null)
            setRestoreNotice('バックアップを読み込みました。')
          }}
        />
      )}
    </section>
  )
}
