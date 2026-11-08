import { useState } from 'react'
import { db } from '../../db/db'
import { userMessage } from '../../db/errors'
import { disablePin, enablePin, verifyPin, verifyRecoveryCode } from '../../db/pin'
import { formatRecoveryCode } from '../../lib/pin'
import { markUnlocked } from '../../lib/pinAttempts'
import Modal from '../Modal'
import PinPad from '../pin/PinPad'
import { useLockout } from '../pin/useLockout'
import styles from './PinDialog.module.css'

/** enable:オンにする / change:変更する / disable:オフにする */
export type PinAction = 'enable' | 'change' | 'disable'

type Step = 'current' | 'recovery' | 'new' | 'confirm' | 'code'

type Props = {
  action: PinAction
  onClose: () => void
  /** 終わったときに設定画面に出す文 */
  onDone: (message: string) => void
}

const TITLES: Record<PinAction, string> = {
  enable: '暗証番号をオンにする',
  change: '暗証番号を変更する',
  disable: '暗証番号をオフにする',
}

/**
 * 暗証番号の設定(仕様書 §5 F6)。新しい PIN は2回入力して確かめる。
 * 変更とオフは、今の PIN(忘れたときは復旧コード)を確かめてから行う。
 * 設定が終わったら、復旧コードを1回だけ表示する。
 */
export default function PinDialog({ action, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>(action === 'enable' ? 'new' : 'current')
  const [value, setValue] = useState('')
  const [first, setFirst] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { locked, seconds, check } = useLockout()

  /** 今の PIN か復旧コードを確かめたあと */
  async function afterVerified(viaRecovery: boolean) {
    if (action === 'disable' || viaRecovery) {
      await disablePin(db)
      onDone(viaRecovery && action !== 'disable' ? '復旧コードで暗証番号をオフにしました。' : '暗証番号をオフにしました。')
      return
    }
    setStep('new')
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (step === 'current') {
        const result = await check(() => verifyPin(db, value))
        if (result === true) await afterVerified(false)
        else setError(result)
      } else if (step === 'recovery') {
        const result = await check(() => verifyRecoveryCode(db, code), '復旧コード')
        if (result === true) await afterVerified(true)
        else setError(result)
      } else if (step === 'new') {
        setFirst(value)
        setStep('confirm')
      } else if (step === 'confirm') {
        if (value !== first) {
          setError('1回目と違う番号です。もう一度、新しい暗証番号を入力してください。')
          setFirst('')
          setStep('new')
        } else {
          // オンにしたその場でロックがかからないように、このタブは解除済みにしておく
          markUnlocked()
          setRecoveryCode(await enablePin(db, value))
          setStep('code')
        }
      }
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setValue('')
      setBusy(false)
    }
  }

  const lead: Record<Exclude<Step, 'code' | 'recovery'>, string> = {
    current: '今の暗証番号を入力してください',
    new: '新しい暗証番号(4〜6桁の数字)を入力してください',
    confirm: '確認のため、もう一度入力してください',
  }

  return (
    // 復旧コードを表示しているときは、メモしたことを押してもらうまで閉じない
    <Modal labelledBy="pin-title" onClose={() => step !== 'code' && onClose()} maxWidth={420}>
      <div className={styles.body}>
        <h2 id="pin-title" className={styles.title}>
          {step === 'code' ? '復旧コード' : TITLES[action]}
        </h2>

        {step === 'code' ? (
          <>
            <p>暗証番号を忘れたときは、このコードで解除できます。この画面は一度しか表示しません。紙に書くなどして、お店の安全な場所に保管してください。</p>
            <p className={`num ${styles.code}`}>{formatRecoveryCode(recoveryCode ?? '')}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onDone(action === 'enable' ? '暗証番号をオンにしました。' : '暗証番号を変更しました。')}
            >
              メモしました
            </button>
          </>
        ) : step === 'recovery' ? (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <label htmlFor="settings-recovery">復旧コード(12文字)を入力してください。正しければ暗証番号をオフにします。</label>
            <input
              id="settings-recovery"
              className={`input num ${styles.codeInput}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              disabled={busy || locked}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || locked || code.trim() === ''}>
              復旧コードで解除
            </button>
          </form>
        ) : (
          <>
            <p className={styles.lead}>{lead[step]}</p>
            <PinPad value={value} onChange={setValue} onSubmit={() => void submit()} disabled={busy || locked} />
          </>
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

        {step !== 'code' && (
          <div className={styles.actions}>
            {(step === 'current' || step === 'recovery') && (
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setStep(step === 'current' ? 'recovery' : 'current')
                  setError(null)
                }}
              >
                {step === 'current' ? '暗証番号を忘れたとき' : '暗証番号の入力に戻る'}
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              やめる
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
