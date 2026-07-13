import { useState, useEffect } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import AuthScreen from './screens/AuthScreen'
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
  const [session, setSession] = useState(null)
  const [demoSession, setDemoSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Splash />
  const activeSession = demoSession || session
  if (!activeSession) return <AuthScreen backendReady={isSupabaseConfigured} onDemo={() => setDemoSession({
    prototype: true,
    user: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'demo@fitness.local',
      user_metadata: { name: 'Kei' },
    },
  })} />

  const screens = {
    home:     <HomeScreen session={activeSession} />,
    training: <TrainingScreen session={activeSession} />,
    diet:     <DietScreen session={activeSession} />,
    coach:    <CoachScreen session={activeSession} />,
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

function Splash() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="訓練日記" style={{ width: 74, height: 74, borderRadius: 22 }} />
      <div className="display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>訓練日記</div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────
function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function DumbbellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M3 10.5h3v3H3zM18 10.5h3v3h-3zM6.5 12h11"/></svg>
}
function LeafIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
}
function SparkleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/></svg>
}
