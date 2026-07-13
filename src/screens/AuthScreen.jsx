import { useState } from 'react'
import { signIn, signUp } from '../lib/db'

export default function AuthScreen({ onDemo, backendReady = true }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { error } = await signUp(email, password, name)
        if (error) throw error
        setDone(true)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={styles.wrap}>
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="訓練日記" style={{ width: 70, height: 70, borderRadius: 22, alignSelf: 'center', marginBottom: 12 }} />
      <div className="display" style={styles.logo}>訓練日記</div>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink-1)', marginBottom: 8 }}>確認信已寄出</div>
        <div style={{ color: 'var(--ink-3)', lineHeight: 1.6 }}>請去 {email} 點擊驗證連結，完成後回來登入。</div>
      </div>
      <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => { setMode('login'); setDone(false) }}>回到登入</button>
    </div>
  )

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="訓練日記" style={{ width: 92, height: 92, borderRadius: 28, marginBottom: 8 }} />
        <div className="display" style={styles.logo}>訓練日記</div>
        <div style={{ color: 'var(--ink-3)', marginTop: 6 }}>記錄每一次進步</div>
      </div>

      {!backendReady && (
        <div className="card" style={{ marginBottom: 12, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5 }}>
          雲端後端尚未設定完成，目前可以先使用示範模式。完成部署設定後，登入即可同步資料。
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'signup' && (
          <input className="inp" placeholder="你的名字" value={name} onChange={e => setName(e.target.value)} />
        )}
        <input className="inp" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="inp" type="password" placeholder="密碼（至少 6 位）" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />

        {error && <div style={{ color: 'var(--coral)', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        <button className="btn-primary" onClick={submit} disabled={loading || !backendReady} style={{ marginTop: 4 }}>
          {loading ? '載入中...' : mode === 'login' ? '登入' : '建立帳號'}
        </button>
        <button className="btn-ghost" onClick={onDemo} type="button">
          體驗互動原型
        </button>
      </div>

      <button style={{ marginTop: 20, color: 'var(--ink-3)', fontSize: 14, width: '100%' }}
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
        {mode === 'login' ? '還沒有帳號？立即註冊' : '已有帳號？登入'}
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '32px 24px',
    maxWidth: 420,
    margin: '0 auto',
  },
  logo: {
    fontSize: 36,
    fontWeight: 800,
    color: 'var(--orange)',
    letterSpacing: 0,
  }
}
