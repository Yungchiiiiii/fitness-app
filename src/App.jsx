import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import HomeScreen from './screens/HomeScreen'
import TrainingScreen from './screens/TrainingScreen'
import DietScreen from './screens/DietScreen'
import CoachScreen from './screens/CoachScreen'

const TABS = [
  { id: 'home',     label: '摘要',  icon: HomeIcon },
  { id: 'training', label: '訓練',  icon: DumbbellIcon },
  { id: 'diet',     label: '飲食',  icon: LeafIcon },
  { id: 'coach',    label: 'AI',    icon: SparkleIcon },
]

const MIN_OTP_LENGTH = 6
const MAX_OTP_LENGTH = 10

const getAuthRedirectUrl = () => import.meta.env.VITE_SITE_URL
  || new URL(import.meta.env.BASE_URL, window.location.origin).toString()

export default function App() {
  const [tab, setTab] = useState('home')
  const [session, setSession] = useState(null)
  const [bootReady, setBootReady] = useState(false)
  const [bootError, setBootError] = useState('')

  const restoreSession = async () => {
    setBootError('')
    if (!isSupabaseConfigured) {
      setBootError('雲端設定尚未完成，請稍後再試。')
      setBootReady(true)
      return
    }
    const authParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const authError = authParams.get('error_description')
    if (authError) {
      setBootError(`Email 登入未完成：${decodeURIComponent(authError.replace(/\+/g, ' '))}`)
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
    }
    const { data: existing, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      setBootError(`雲端連線失敗：${sessionError.message}`)
      setBootReady(true)
      return
    }
    if (existing.session) setSession(existing.session)
    setBootReady(true)
  }

  useEffect(() => {
    restoreSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setBootReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!session || session.user?.is_anonymous) {
    return <CloudBoot ready={bootReady} error={bootError} onRetry={restoreSession} anonymousSession={session?.user?.is_anonymous ? session : null} />
  }

  const screens = {
    home:     <HomeScreen session={session} />,
    training: <TrainingScreen session={session} />,
    diet:     <DietScreen session={session} />,
    coach:    <CoachScreen session={session} />,
  }

  return (
    <div style={{ position: 'relative', height: '100%', background: 'var(--bg-app)' }}>
      <div className="screen screen-fade" key={tab}>
        {screens[tab]}
      </div>

      <nav className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function CloudBoot({ ready, error, onRetry, anonymousSession }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [phase, setPhase] = useState('email')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState('')
  const [existingAccountConflict, setExistingAccountConflict] = useState(false)

  const normalizedEmail = email.trim().toLowerCase()

  const sendOtp = async () => {
    if (!normalizedEmail || submitting) return
    setSubmitting(true)
    setMessage('')
    setMessageTone('')
    setExistingAccountConflict(false)
    const redirectTo = getAuthRedirectUrl()
    const { error: sendError } = anonymousSession
      ? await supabase.auth.updateUser({ email: normalizedEmail }, { emailRedirectTo: redirectTo })
      : await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
        })
    if (sendError) {
      const isExistingAccount = Boolean(anonymousSession && /already.*registered|already.*exists|email.*exists/i.test(sendError.message))
      setExistingAccountConflict(isExistingAccount)
      setMessage(isExistingAccount
        ? '這個 Email 已經有帳號。你可以改用既有帳號登入；這台裝置的臨時匿名資料不會自動合併。'
        : formatAuthError(sendError.message))
      setMessageTone('error')
    } else {
      setPhase('code')
      setMessage(`驗證碼已寄到 ${normalizedEmail}`)
      setMessageTone('success')
    }
    setSubmitting(false)
  }

  const signInToExistingAccount = async () => {
    if (!normalizedEmail || submitting) return
    setSubmitting(true)
    setMessage('')
    setMessageTone('')
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setMessage(formatAuthError(signOutError.message))
      setMessageTone('error')
      setSubmitting(false)
      return
    }
    const redirectTo = getAuthRedirectUrl()
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    })
    if (sendError) {
      setMessage(formatAuthError(sendError.message))
      setMessageTone('error')
    } else {
      setExistingAccountConflict(false)
      setPhase('code')
      setMessage(`驗證碼已寄到 ${normalizedEmail}`)
      setMessageTone('success')
    }
    setSubmitting(false)
  }

  const verifyOtp = async () => {
    if (token.length < MIN_OTP_LENGTH || token.length > MAX_OTP_LENGTH || submitting) return
    setSubmitting(true)
    setMessage('')
    setMessageTone('')
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: anonymousSession ? 'email_change' : 'email',
    })
    if (verifyError) {
      setMessage(formatAuthError(verifyError.message))
      setMessageTone('error')
      setSubmitting(false)
      return
    }
    if (data.session) {
      setMessage('驗證完成，正在載入你的訓練資料…')
      setMessageTone('success')
      return
    }
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session) {
      setMessage('Email 已驗證，請重新開啟 App 以載入帳號。')
      setMessageTone('success')
      setSubmitting(false)
    }
  }

  return <div className="cloud-boot">
    <div className="cloud-boot-card">
      <img className="cloud-logo" src={`${import.meta.env.BASE_URL}fitness-logo.png`} alt="手握啞鈴的訓練日記標誌" />
      {!ready && !error && <div className="cloud-copy"><span className="cloud-kicker">TRAINING DIARY</span><strong>正在確認帳號</strong><span>稍等一下，正在安全地連接你的訓練紀錄。</span></div>}
      {error && <div className="cloud-copy"><span className="cloud-kicker">連線需要處理</span><strong>無法完成 Email 登入</strong><span>{error}</span><button className="neon-button compact" onClick={onRetry}>重新檢查</button></div>}
      {ready && !error && <>
        <div className="cloud-copy">
          <span className="cloud-kicker">YOUR TRAINING, YOUR DATA</span>
          <strong>{phase === 'code' ? '輸入 Email 驗證碼' : anonymousSession ? '綁定你的 Email' : '先用 Email 登入'}</strong>
          <span>{phase === 'code' ? `請查看 ${normalizedEmail} 的收件匣；驗證碼使用一次後就會失效。` : anonymousSession ? '驗證後會保留這台裝置已有的紀錄，並可在其他裝置繼續使用。' : '每個 Email 都有獨立的訓練空間，目標與紀錄不會和其他人混在一起。'}</span>
        </div>
        {phase === 'email' ? <>
          <label className="auth-field">
            <span>Email</span>
            <input type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendOtp()} />
          </label>
          <div className="cloud-benefits" aria-label="登入後功能">
            <div><i>01</i><span><b>自動區分帳號</b><small>每個 Email 對應各自的資料</small></span></div>
            <div><i>02</i><span><b>雲端儲存目標</b><small>換裝置也能接著使用</small></span></div>
            <div><i>03</i><span><b>免記密碼</b><small>每次用一次性驗證碼安全登入</small></span></div>
          </div>
          <button className="email-auth-button" disabled={!normalizedEmail || submitting} onClick={sendOtp}>{submitting ? '正在寄送…' : '寄送驗證碼'}</button>
          {existingAccountConflict && <button className="existing-account-button" disabled={submitting} onClick={signInToExistingAccount}>改用這個既有帳號登入</button>}
        </> : <>
          <label className="auth-field otp-field">
            <span>驗證碼</span>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" minLength={MIN_OTP_LENGTH} maxLength={MAX_OTP_LENGTH} placeholder="輸入郵件中的數字" value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, MAX_OTP_LENGTH))} onKeyDown={event => event.key === 'Enter' && verifyOtp()} autoFocus />
          </label>
          <button className="email-auth-button" disabled={token.length < MIN_OTP_LENGTH || token.length > MAX_OTP_LENGTH || submitting} onClick={verifyOtp}>{submitting ? '正在驗證…' : '驗證並進入 App'}</button>
          <div className="auth-code-actions">
            <button disabled={submitting} onClick={sendOtp}>重新寄送</button>
            <button disabled={submitting} onClick={() => { setPhase('email'); setToken(''); setMessage(''); setMessageTone(''); setExistingAccountConflict(false) }}>更換 Email</button>
          </div>
        </>}
        <p className="cloud-account-hint">登入代表你同意由 Supabase 安全驗證 Email；App 不會儲存信箱密碼。</p>
        {message && <p className={`cloud-message ${messageTone}`}>{message}</p>}
      </>}
    </div>
  </div>
}

function formatAuthError(message = '') {
  if (/rate limit/i.test(message)) return '寄送次數太頻繁，請稍等一分鐘再試。'
  if (/invalid.*email/i.test(message)) return 'Email 格式不正確，請重新確認。'
  if (/expired|invalid.*token|token.*invalid/i.test(message)) return '驗證碼錯誤或已過期，請重新寄送。'
  if (/not authorized/i.test(message)) return '目前寄信服務尚未完成設定，暫時只能寄給後台已授權的測試帳號。'
  if (/already.*registered|already.*exists|identity.*exists/i.test(message)) return '這個 Email 已有帳號，請改用既有帳號登入。'
  return `登入失敗：${message}`
}

// ── Icons ─────────────────────────────────────────────
function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
}
function DumbbellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M7 16l3-3 2 2 5-6"/><path d="M14 9h3v3"/></svg>
}
function LeafIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-13a7 7 0 0 0-14 0c0 6.8 7 13 7 13z"/><path d="M12 6v7M9.5 9.5L12 12l2.5-2.5"/></svg>
}
function SparkleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6v6h-6"/><path d="M19 12a7 7 0 1 1-2-6"/><circle cx="12" cy="12" r="2"/></svg>
}
