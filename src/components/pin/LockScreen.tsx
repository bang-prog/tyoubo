import { useState } from 'react'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import { disablePin, verifyPin, verifyRecoveryCode } from '../../db/pin'
import { PIN_UNSUPPORTED_MESSAGE, pinSupported } from '../../lib/pin'
import PinPad from './PinPad'
import { useLockout } from './useLockout'
import styles from './LockScreen.module.css'

/** アプリを開いたときの暗証番号の入力画面(仕様書 §5 F6) */
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [mode, setMode] = useState<'pin' | 'recovery'>('pin')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { locked, seconds, check } = useLockout()

  async function submitPin() {
    if (busy || locked) return
    setBusy(true)
    const result = await check(() => verifyPin(db, pin))
    setBusy(false)
    if (result === true) onUnlock()
    else {
      setError(result)
      setPin('')
    }
  }

  async function submitCode() {
    if (busy || locked) return
    setBusy(true)
    try {
      const result = await check(() => verifyRecoveryCode(db, code), '復旧コード')
      if (result === true) {
        await disablePin(db)
        onUnlock()
      } else setError(result)
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.box}>
        <h1 className={styles.brand}>レジ帳簿</h1>
        {!pinSupported() ? (
          <p className="error" role="alert">
            {PIN_UNSUPPORTED_MESSAGE}
          </p>
        ) : mode === 'pin' ? (
          <>
            <p className={styles.lead}>暗証番号を入力してください</p>
            <PinPad value={pin} onChange={setPin} onSubmit={() => void submitPin()} disabled={busy || locked} submitLabel="解除" />
          </>
        ) : (
          <form
            className={styles.recovery}
            onSubmit={(e) => {
              e.preventDefault()
              void submitCode()
            }}
          >
            <label className={styles.lead} htmlFor="recovery-code">
              復旧コード(12文字)を入力してください
            </label>
            <input
              id="recovery-code"
              className={`input num ${styles.codeInput}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              disabled={busy || locked}
            />
            <p className="hint">正しいコードを入れると暗証番号がオフになります。設定画面でもう一度設定してください。</p>
            <button type="submit" className="btn btn-primary" disabled={busy || locked || code.trim() === ''}>
              復旧コードで解除
            </button>
          </form>
        )}

        {locked ? (
          <p className="error" role="alert">
            続けて間違えたため、あと{seconds}秒は入力できません。
          </p>
        ) : (
          error && (
            <p className="error" role="alert">
              {error}
            </p>
          )
        )}

        <button
          type="button"
          className={styles.switch}
          onClick={() => {
            setMode(mode === 'pin' ? 'recovery' : 'pin')
            setError(null)
          }}
        >
          {mode === 'pin' ? '暗証番号を忘れたとき' : '暗証番号の入力に戻る'}
        </button>
      </div>
    </main>
  )
}
