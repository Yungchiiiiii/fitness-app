import { useEffect, useState } from 'react'
import { deleteExercise, getSessions } from '../lib/db'
import { ExercisePickerSheet, SetsFillerSheet } from '../components/NewSessionModal'
import ProfileScreen from './ProfileScreen'
import { demoSessions, macroSnapshot, muscleLoad, prHighlights } from '../lib/prototypeData'

export default function HomeScreen({ session }) {
  const name = session?.user?.user_metadata?.name || '你'
  const today = new Date()
  const dateStr = today.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
  const greeting = today.getHours() < 12 ? '早安' : today.getHours() < 18 ? '午安' : '晚安'
  const prototypeOnly = !!session.prototype

  const [sessions, setSessions] = useState(prototypeOnly ? demoSessions : [])
  const [showPicker, setShowPicker] = useState(false)
  const [fillData, setFillData] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [openDate, setOpenDate] = useState(null)
  const [targetDays, setTargetDays] = useState(() => getSavedTargetDays())

  useEffect(() => {
    if (prototypeOnly) {
      setSessions(demoSessions)
      return
    }
    getSessions(session.user.id).then(({ data }) => setSessions(data || []))
  }, [prototypeOnly, session.user.id])
  useEffect(() => {
    const syncGoals = (event) => setTargetDays(clampTargetDays(event.detail?.trainingDays || getSavedTargetDays()))
    window.addEventListener('fitness-goals-updated', syncGoals)
    return () => window.removeEventListener('fitness-goals-updated', syncGoals)
  }, [])

  const reload = () => {
    if (prototypeOnly) return
    getSessions(session.user.id).then(({ data }) => setSessions(data || []))
  }
  const todayStr = today.toISOString().split('T')[0]
  const trainedToday = new Set(sessions.map(s => s.date)).has(todayStr)
  const trainedWeekDays = Math.max(new Set(sessions.slice(0, 7).map(s => s.date)).size, 3)
  const weekProgress = Math.min(trainedWeekDays, targetDays)
  const proteinPct = Math.round((macroSnapshot.protein.value / macroSnapshot.protein.target) * 100)
  const groupedRecent = groupRecentSessions(sessions)
  const deleteRecentDay = (date) => {
    setSessions(prev => prev.filter(session => session.date !== date))
    if (openDate === date) setOpenDate(null)
  }
  const removeRecentExercise = async (exercise) => {
    const previous = sessions
    setSessions(prev => prev
      .map(item => item.id === exercise.sessionId
        ? { ...item, session_exercises: (item.session_exercises || []).filter(ex => ex.id !== exercise.id) }
        : item)
      .filter(item => (item.session_exercises || []).length > 0))
    if (prototypeOnly || String(exercise.id).startsWith('proto-')) return
    const { error } = await deleteExercise(exercise.id)
    if (error) {
      setSessions(previous)
      alert('刪除動作失敗：' + (error.message || '請稍後再試'))
    }
  }

  return (
    <div className="screen-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 4px 4px' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 800 }}>{dateStr}</div>
          <div className="display" style={{ fontSize: 31, fontWeight: 900, color: 'var(--ink-1)', marginTop: 2 }}>
            {greeting}，{name}
          </div>
        </div>
        <button onClick={() => setShowProfile(true)} style={{
          width: 46, height: 46, borderRadius: 16,
          background: 'linear-gradient(135deg, #FF7A1E, #F43F5E)',
          color: '#fff', display: 'grid', placeItems: 'center',
          fontSize: 18, fontWeight: 900, boxShadow: 'var(--shadow-md)',
        }}>
          {name[0]?.toUpperCase()}
        </button>
      </div>

      <div className="metric-grid" style={{ marginTop: 18 }}>
        <MetricCard label="今日" value={trainedToday ? '已訓練' : '待開始'} detail={trainedToday ? 'Nice work' : '30-45 分鐘'} />
        <MetricCard label="蛋白質" value={`${macroSnapshot.protein.value}g`} detail={`${proteinPct}% / ${macroSnapshot.protein.target}g`} />
        <MetricCard label="週目標" value={`${weekProgress}/${targetDays}`} detail="訓練日" />
      </div>

      <button className="cta-card" style={{ marginTop: 16 }} onClick={() => setShowPicker(true)}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 800 }}>準備好了嗎？</div>
          <div className="display" style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginTop: 2 }}>開始今日訓練</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.24)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800 }}>+</div>
      </button>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>本週運動目標</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>穩定比爆衝更重要</div>
          </div>
          <span className="pill" style={{ color: 'var(--orange-d)', background: 'var(--blue-soft)' }}>{weekProgress}/{targetDays} 天</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, trainedWeekDays / targetDays * 100)}%` }} />
        </div>
        <WeekStrip sessions={sessions} todayStr={todayStr} />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>肌肉群訓練量</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>有效組數模擬分佈</div>
          </div>
          <span className="pill" style={{ color: '#fff', background: 'var(--orange)' }}>本週</span>
        </div>
        <MuscleRadar data={muscleLoad} />
      </div>

      <div className="section-title">PR 亮點</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {prHighlights.map(pr => (
          <div key={pr.exercise} className="card" style={{ padding: 14 }}>
            <div className="pill pr-badge" style={{ display: 'inline-flex', marginBottom: 10 }}>PR</div>
            <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{pr.exercise}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{pr.value}</div>
            <div style={{ fontSize: 12, color: 'var(--orange-d)', fontWeight: 900, marginTop: 6 }}>est. 1RM {pr.estimate}</div>
          </div>
        ))}
      </div>

      <div className="section-title">最近訓練</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groupedRecent.map(day => (
          <RecentDayCard
            key={day.date}
            day={day}
            open={openDate === day.date}
            onToggle={() => setOpenDate(openDate === day.date ? null : day.date)}
            onEdit={() => setOpenDate(day.date)}
            onDelete={() => deleteRecentDay(day.date)}
            onRemoveExercise={removeRecentExercise}
          />
        ))}
      </div>

      {showPicker && (
        <ExercisePickerSheet
          sessions={sessions}
          onClose={() => setShowPicker(false)}
          onDone={(selected, date) => {
            setShowPicker(false)
            setTimeout(() => setFillData({ selected, date }), 280)
          }}
        />
      )}

      {fillData && (
        <SetsFillerSheet
          selected={fillData.selected}
          date={fillData.date}
          sessions={sessions}
          prototypeOnly={prototypeOnly}
          onClose={() => setFillData(null)}
          onSaved={(created) => {
            if (prototypeOnly && created) setSessions(prev => [created, ...prev])
            setFillData(null)
            reload()
          }}
        />
      )}

      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 260, background: 'var(--bg-app)', overflowY: 'auto' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
            <button onClick={() => setShowProfile(false)} style={{ color: 'var(--ink-3)', fontSize: 24 }}>←</button>
            <div className="display" style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink-1)' }}>個人設定</div>
          </div>
          <div style={{ padding: '0 16px 80px' }}>
            <ProfileScreen session={session} />
          </div>
        </div>
      )}
    </div>
  )
}

function clampTargetDays(value) {
  return Math.max(1, Math.min(7, Number(value) || 5))
}

function getSavedTargetDays() {
  try {
    const saved = window.localStorage.getItem('fitness-goals')
    if (!saved) return 5
    return clampTargetDays(JSON.parse(saved).trainingDays)
  } catch {
    return 5
  }
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="card metric-card" style={{ padding: 14 }}>
      <div className="metric-label">{label}</div>
      <div>
        <div className="metric-value">{value}</div>
        <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: '#FFE4C4' }}>
          <div style={{ width: '74%', height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #FF7A1E, #F43F5E)' }} />
        </div>
        <div style={{ color: 'var(--orange-d)', fontSize: 11, fontWeight: 900, marginTop: 6 }}>{detail}</div>
      </div>
    </div>
  )
}

function WeekStrip({ sessions, todayStr }) {
  const dates = new Set(sessions.map(s => s.date))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 7, marginTop: 14 }}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const ds = d.toISOString().split('T')[0]
        const active = dates.has(ds) || [1, 2, 4].includes(i)
        const isToday = ds === todayStr
        return (
          <div key={ds} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: isToday ? 'var(--orange-d)' : 'var(--ink-4)', fontWeight: 900 }}>
              {d.toLocaleDateString('zh-TW', { weekday: 'narrow' })}
            </div>
            <div style={{
              margin: '6px auto 0', width: 24, height: 24, borderRadius: 99,
              background: active ? 'linear-gradient(135deg, #FF7A1E, #F43F5E)' : 'var(--bg-sunk)',
              border: isToday && !active ? '2px solid var(--orange)' : 'none',
            }} />
          </div>
        )
      })}
    </div>
  )
}

function MuscleRadar({ data }) {
  const points = data.map((d, i) => {
    const angle = (-90 + i * 72) * Math.PI / 180
    const radius = 28 + d.value * 0.38
    return `${100 + Math.cos(angle) * radius},${100 + Math.sin(angle) * radius}`
  }).join(' ')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14, alignItems: 'center', marginTop: 12 }}>
      <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 150 }}>
        {[35, 55, 75].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#FED7AA" strokeWidth="1.5" />)}
        {data.map((d, i) => {
          const angle = (-90 + i * 72) * Math.PI / 180
          return <line key={d.label} x1="100" y1="100" x2={100 + Math.cos(angle) * 78} y2={100 + Math.sin(angle) * 78} stroke="#FDBA74" opacity="0.45" />
        })}
        <polygon points={points} fill="rgba(249,115,22,0.2)" stroke="var(--orange)" strokeWidth="3" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(d => (
          <div key={d.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 900, color: 'var(--ink-2)' }}>
              <span>{d.label}</span><span>{d.sets} 組</span>
            </div>
            <div className="progress-track" style={{ height: 6, marginTop: 4 }}>
              <div className="progress-fill" style={{ width: `${d.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentDayCard({ day, open, onToggle, onEdit, onDelete, onRemoveExercise }) {
  const [swipeX, setSwipeX] = useState(0)
  const [startX, setStartX] = useState(null)
  const [openExercise, setOpenExercise] = useState(null)
  const [editing, setEditing] = useState(false)
  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
  const move = (clientX) => {
    if (startX === null) return
    const dx = clientX - startX
    setSwipeX(Math.max(-160, Math.min(0, dx)))
  }
  const end = () => {
    setSwipeX(swipeX < -48 ? -160 : 0)
    setStartX(null)
  }

  return (
    <div className="swipe-row">
      <div className="swipe-actions">
        <button className="swipe-edit" onClick={() => { setEditing(true); onEdit(); setSwipeX(0) }}>編輯</button>
        <button className="swipe-delete" onClick={onDelete}>刪除</button>
      </div>
      <div
        className="card swipe-card"
        style={{ transform: `translateX(${swipeX}px)`, padding: 15 }}
        onTouchStart={e => setStartX(e.touches[0].clientX)}
        onTouchMove={e => move(e.touches[0].clientX)}
        onTouchEnd={end}
        onMouseDown={e => setStartX(e.clientX)}
        onMouseMove={e => e.buttons === 1 && move(e.clientX)}
        onMouseUp={end}
        onMouseLeave={() => startX !== null && end()}
      >
        <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <ExerciseArt name={day.exercises[0]?.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ color: 'var(--orange-d)', fontWeight: 900 }}>{dateLabel}</div>
              <div style={{ color: 'var(--ink-4)' }}>{open ? '▲' : '▼'}</div>
            </div>
            <div style={{ color: 'var(--ink-1)', fontWeight: 900, marginTop: 5 }}>{day.exercises.map(e => e.name).join(' · ')}</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 3 }}>{day.exercises.length} 個動作 · {day.totalSets} 組</div>
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editing && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: 'var(--bg-sunk)', color: 'var(--ink-3)', fontSize: 12, fontWeight: 800 }}>
                <span>點選動作右側刪除即可移除單項運動</span>
                <button onClick={() => setEditing(false)} style={{ color: 'var(--orange-d)', fontWeight: 900 }}>完成</button>
              </div>
            )}
            {day.exercises.map(ex => (
              <div key={ex.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setOpenExercise(openExercise === ex.id ? null : ex.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left' }}>
                    <ExerciseArt name={ex.name} small />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{ex.name}</div>
                      <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{ex.exercise_sets?.length || 0} 組</div>
                    </div>
                    <span style={{ color: 'var(--ink-4)' }}>{openExercise === ex.id ? '收合' : '展開'}</span>
                  </button>
                  {editing && (
                    <button
                      onClick={() => onRemoveExercise(ex)}
                      style={{ width: 36, height: 36, borderRadius: 12, background: '#FEE2E2', color: '#DC2626', fontWeight: 900, flexShrink: 0 }}
                    >
                      刪
                    </button>
                  )}
                </div>
                {openExercise === ex.id && (
                  <div style={{ margin: '8px 0 0 48px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {ex.exercise_sets?.map((set, i) => (
                      <div key={set.id || i} style={{ color: 'var(--ink-2)', fontSize: 13, fontWeight: 800 }}>
                        第 {i + 1} 組：{formatSet(set)}
                      </div>
                    ))}
                    {ex.note && <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 3 }}>備註：{ex.note}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExerciseArt({ name, small = false }) {
  const size = small ? 36 : 48
  const kind = name?.includes('深蹲') ? 'squat' : name?.includes('臥推') ? 'bench' : name?.includes('硬舉') ? 'deadlift' : 'core'
  return (
    <div className="icon-tile" style={{ width: size, height: size, borderRadius: small ? 12 : 16 }}>
      <svg viewBox="0 0 48 48" width={small ? 26 : 32} height={small ? 26 : 32} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'squat' && <><path d="M9 15h30"/><path d="M17 15l6 9-5 12"/><path d="M31 15l-6 9 6 12"/><circle cx="24" cy="9" r="4"/></>}
        {kind === 'bench' && <><path d="M8 31h32"/><path d="M14 25h20"/><path d="M16 18h16"/><path d="M20 18l-4 7"/><path d="M28 18l4 7"/></>}
        {kind === 'deadlift' && <><path d="M8 34h32"/><path d="M14 28l10-13 10 13"/><path d="M24 15v19"/><circle cx="24" cy="9" r="4"/></>}
        {kind === 'core' && <><path d="M10 28h28"/><path d="M16 28l8-10 8 10"/><circle cx="24" cy="13" r="4"/></>}
      </svg>
    </div>
  )
}

function formatSet(set) {
  if (set.duration_seconds) {
    const minutes = `${Math.round(set.duration_seconds / 60)} 分`
    if (set.unit === 'kmh' && set.weight) return `${minutes} · ${set.weight} 速度/等級`
    if (set.weight) return `${minutes} · ${set.weight}kg`
    return minutes
  }
  return `${set.weight || 0}kg x ${set.reps || 0}`
}

function groupRecentSessions(sessions) {
  const source = sessions.length ? sessions : demoSessions
  const grouped = {}
  source.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = []
    grouped[s.date].push(...(s.session_exercises || []).map(ex => ({ ...ex, sessionId: s.id })))
  })
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4)
    .map(([date, exercises]) => ({
      date,
      exercises,
      totalSets: exercises.reduce((sum, ex) => sum + (ex.exercise_sets?.length || 0), 0),
    }))
}
