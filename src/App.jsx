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
    const { data: existing, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      setBootError(`雲端連線失敗：${sessionError.message}`)
      setBootReady(true)
      return
    }
    if (existing.session) setSession(existing.session)
    setBootReady(true)
  }

  const startAnonymous = async () => {
    setBootError('')
    const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { name: 'Kei' } } })
    if (error) {
      setBootError(`無法建立雲端使用身分：${error.message}`)
      return
    }
    setSession(data.session)
  }

  useEffect(() => {
    restoreSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setBootReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!session) return <CloudBoot ready={bootReady} error={bootError} onRetry={restoreSession} onStart={startAnonymous} />

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

function CloudBoot({ ready, error, onRetry, onStart }) {
  const [showRestore, setShowRestore] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const sendRestoreLink = async () => {
    if (!email.trim() || sending) return
    setSending(true)
    setMessage('')
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
    setMessage(signInError ? `無法寄送：${signInError.message}` : '登入連結已寄出，請到信箱點開即可回到原本資料。')
    setSending(false)
  }

  return <div className="cloud-boot">
    <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="訓練日記" />
    {!ready && !error && <><strong>正在連接訓練紀錄</strong><span>正在確認這台裝置是否有既有資料。</span></>}
    {error && <><strong>雲端暫時無法連線</strong><span>{error}</span><button className="neon-button compact" onClick={onRetry}>重新連線</button></>}
    {ready && !error && !showRestore && <>
      <strong>歡迎使用訓練日記</strong>
      <span>第一次使用可直接開始；若曾刪除捷徑或更換裝置，請用已綁定的信箱找回。</span>
      <button className="neon-button cloud-primary" onClick={onStart}>第一次使用，直接開始</button>
      <button className="cloud-secondary" onClick={() => setShowRestore(true)}>我有原本資料，用信箱找回</button>
    </>}
    {ready && !error && showRestore && <div className="cloud-restore-form">
      <strong>找回原本資料</strong>
      <span>輸入之前在「我」裡綁定的信箱。</span>
      <input type="email" inputMode="email" autoComplete="email" placeholder="你的 Email" value={email} onChange={event => setEmail(event.target.value)} />
      <button className="neon-button" disabled={!email.trim() || sending} onClick={sendRestoreLink}>{sending ? '寄送中…' : '寄登入連結到信箱'}</button>
      {message && <p>{message}</p>}
      <button className="cloud-secondary" onClick={() => { setShowRestore(false); setMessage('') }}>返回</button>
    </div>}
  </div>
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
