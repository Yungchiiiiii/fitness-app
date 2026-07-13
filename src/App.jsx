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
