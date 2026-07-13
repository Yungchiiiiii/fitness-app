import { useEffect, useMemo, useState } from 'react'
import {
  createSet,
  deleteExercise,
  deleteSession,
  deleteSet,
  getDailyNutrition,
  getProfile,
  getSessions,
  updateExercise,
  updateSession,
  updateSet,
} from '../lib/db'
import { ExercisePickerSheet, CAT_META } from '../components/NewSessionModal'
import ProfileScreen from './ProfileScreen'
import { macroSnapshot } from '../lib/prototypeData'

const isoDate = date => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export default function HomeScreen({ session }) {
  const prototypeOnly = Boolean(session.prototype)
  const today = useMemo(() => new Date(), [])
  const todayString = isoDate(today)
  const name = session?.user?.user_metadata?.name || '你'
  const [sessions, setSessions] = useState([])
  const [nutrition, setNutrition] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [openDays, setOpenDays] = useState({})
  const [collapsedMonths, setCollapsedMonths] = useState({})
  const [editingDay, setEditingDay] = useState(null)
  const targetDays = Math.max(1, Math.min(7, Number(profile?.training_days) || readTargetDays(session.user.id)))

  const reload = async () => {
    if (prototypeOnly) return
    const { data } = await getSessions(session.user.id)
    setSessions(data || [])
  }

  useEffect(() => {
    if (prototypeOnly) return
    reload()
    Promise.all([
      getDailyNutrition(session.user.id, todayString, todayString),
      getProfile(session.user.id),
    ]).then(([nutritionResult, profileResult]) => {
      setNutrition(nutritionResult.data?.[0] || null)
      setProfile(profileResult.data || null)
    })
  }, [prototypeOnly, session.user.id, todayString])

  useEffect(() => {
    const syncGoals = event => setProfile(previous => ({
      ...previous,
      training_days: event.detail.trainingDays,
      calories_target: event.detail.calories,
      protein_target: event.detail.protein,
    }))
    window.addEventListener('fitness-goals-updated', syncGoals)
    return () => window.removeEventListener('fitness-goals-updated', syncGoals)
  }, [])

  const days = useMemo(() => groupByDay(sessions), [sessions])
  const months = useMemo(() => groupByMonth(days), [days])
  const weekDates = getCurrentWeek(today)
  const trainedDates = new Set(days.map(day => day.date))
  const weekCount = weekDates.filter(day => trainedDates.has(day.date)).length
  const monthCount = days.filter(day => day.date.slice(0, 7) === todayString.slice(0, 7)).length
  const proteinValue = prototypeOnly ? macroSnapshot.protein.value : Number(nutrition?.protein) || 0
  const proteinTarget = prototypeOnly ? macroSnapshot.protein.target : Number(profile?.protein_target) || 120
  const calorieValue = prototypeOnly ? macroSnapshot.calories.value : Number(nutrition?.calories || nutrition?.kcal) || 0
  const calorieTarget = prototypeOnly ? macroSnapshot.calories.target : Number(profile?.calories_target || profile?.calorie_target) || 2118

  const handleCreated = created => {
    if (prototypeOnly && created) setSessions(previous => [created, ...previous])
    setShowBuilder(false)
    reload()
  }

  const removeDay = async day => {
    if (!window.confirm(`確定刪除 ${formatDate(day.date)} 的訓練紀錄？`)) return
    const previous = sessions
    setSessions(items => items.filter(item => item.date !== day.date))
    if (prototypeOnly) return
    const results = await Promise.all(day.sessions.map(item => deleteSession(item.id)))
    if (results.some(result => result.error)) {
      setSessions(previous)
      alert('刪除失敗，請稍後再試。')
    }
  }

  const applyPrototypeEdit = updated => {
    setSessions(previous => {
      const ids = new Set(updated.sessionIds)
      return previous.map(item => ids.has(item.id) ? {
        ...item,
        date: updated.date,
        name: updated.name,
        session_exercises: updated.exercises.filter(exercise => exercise.sessionId === item.id).map(exercise => ({
          ...exercise,
          exercise_sets: exercise.sets,
        })),
      } : item)
    })
    setEditingDay(null)
  }

  return (
    <div className="diary-home">
      <header className="diary-hero">
        <div>
          <div className="eyebrow muted">TRAINING DIARY</div>
          <h1>訓練日記</h1>
          <p>{today.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</p>
        </div>
        <button className="profile-orb" onClick={() => setShowProfile(true)} aria-label="個人設定">
          <UserIcon />
        </button>
      </header>

      <section className="activity-card">
        <ActivityRings training={weekCount / targetDays} protein={proteinValue / proteinTarget} calories={calorieValue / calorieTarget} />
        <div className="activity-legends">
          <RingLegend color="var(--pink)" label="訓練 · 本週" value={weekCount} target={`/${targetDays} 天`} />
          <RingLegend color="var(--neon)" label="蛋白質 · 今日" value={proteinValue} target={`/${proteinTarget} g`} />
          <RingLegend color="var(--cyan)" label="熱量 · 今日" value={calorieValue} target={`/${calorieTarget}`} unit="kcal" />
        </div>
      </section>

      <section className="stat-pair">
        <div className="stat-tile pink-glow"><span>本週訓練</span><strong>{weekCount}</strong><small>天</small></div>
        <div className="stat-tile cyan-glow"><span>本月訓練</span><strong>{monthCount}</strong><small>天</small></div>
      </section>

      <section className="week-section">
        <div className="section-row"><span>本週</span><strong>{weekCount}/{targetDays} 天訓練</strong></div>
        <div className="week-strip">
          {weekDates.map(day => {
            const active = trainedDates.has(day.date)
            const current = day.date === todayString
            return (
              <div className={`week-day ${current ? 'current' : ''}`} key={day.date}>
                <span>{day.weekday}</span><strong>{day.day}</strong><i className={active ? 'trained' : ''} />
              </div>
            )
          })}
        </div>
      </section>

      <section className="history-section">
        <div className="history-title">
          <h2>訓練紀錄</h2>
          <button className="new-session-button" onClick={() => setShowBuilder(true)}>＋ 新訓練</button>
        </div>
        {!months.length && <div className="empty-history">還沒有訓練紀錄。加入第一個動作，就會開始建立你的日記。</div>}
        {months.map(month => {
          const collapsed = Boolean(collapsedMonths[month.key])
          return (
            <div className="month-group" key={month.key}>
              <button className="month-heading" onClick={() => setCollapsedMonths(previous => ({ ...previous, [month.key]: !collapsed }))}>
                <span>{month.label} · {month.days.length} 次訓練</span>
                <i>{collapsed ? '⌄' : '⌃'}</i>
              </button>
              {!collapsed && month.days.map(day => (
                <DayCard
                  key={day.date}
                  day={day}
                  open={Boolean(openDays[day.date])}
                  onToggle={() => setOpenDays(previous => ({ ...previous, [day.date]: !previous[day.date] }))}
                  onEdit={() => setEditingDay(day)}
                  onDelete={() => removeDay(day)}
                />
              ))}
            </div>
          )
        })}
      </section>

      {showBuilder && <ExercisePickerSheet sessions={sessions} prototypeOnly={prototypeOnly} onClose={() => setShowBuilder(false)} onSaved={handleCreated} />}
      {editingDay && (
        <EditDaySheet
          day={editingDay}
          prototypeOnly={prototypeOnly}
          onClose={() => setEditingDay(null)}
          onPrototypeSaved={applyPrototypeEdit}
          onSaved={() => { setEditingDay(null); reload() }}
        />
      )}
      {showProfile && (
        <div className="profile-overlay">
          <div className="overlay-toolbar"><button onClick={() => setShowProfile(false)}>←</button><strong>個人設定</strong></div>
          <ProfileScreen session={session} />
        </div>
      )}
    </div>
  )
}

function ActivityRings({ training, protein, calories }) {
  const rings = [
    { radius: 66, color: 'var(--pink)', progress: training },
    { radius: 49, color: 'var(--neon)', progress: protein },
    { radius: 32, color: 'var(--cyan)', progress: calories },
  ]
  return (
    <svg className="activity-rings" viewBox="0 0 180 180" aria-label="本週與今日活動進度">
      {rings.map(ring => {
        const circumference = 2 * Math.PI * ring.radius
        const progress = Math.max(0.02, Math.min(1, ring.progress || 0))
        return <g key={ring.radius} transform="rotate(-90 90 90)">
          <circle cx="90" cy="90" r={ring.radius} fill="none" stroke={ring.color} strokeOpacity=".18" strokeWidth="12" />
          <circle cx="90" cy="90" r={ring.radius} fill="none" stroke={ring.color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </g>
      })}
    </svg>
  )
}

function RingLegend({ color, label, value, target, unit }) {
  return <div className="ring-legend"><span><i style={{ background: color }} />{label}</span><strong>{value}<small>{target}</small></strong>{unit && <em>{unit}</em>}</div>
}

function DayCard({ day, open, onToggle, onEdit, onDelete }) {
  const [translate, setTranslate] = useState(0)
  const [start, setStart] = useState(null)
  const [openExercises, setOpenExercises] = useState({})
  const date = new Date(`${day.date}T00:00:00`)
  const categories = [...new Set(day.exercises.map(exercise => CAT_META[exercise.category]?.label).filter(Boolean))]
  const title = day.name || categories.join(' + ') || '訓練'
  const move = clientX => start !== null && setTranslate(Math.max(-168, Math.min(0, clientX - start)))
  const finish = () => { setTranslate(translate < -45 ? -168 : 0); setStart(null) }
  return (
    <div className="diary-swipe-row">
      <div className="diary-swipe-actions">
        <button onClick={onEdit}><EditIcon /><span>編輯</span></button>
        <button onClick={onDelete}><TrashIcon /><span>刪除</span></button>
      </div>
      <article className="day-card" style={{ transform: `translateX(${translate}px)` }}
        onTouchStart={event => setStart(event.touches[0].clientX)} onTouchMove={event => move(event.touches[0].clientX)} onTouchEnd={finish}
        onMouseDown={event => setStart(event.clientX)} onMouseMove={event => event.buttons === 1 && move(event.clientX)} onMouseUp={finish} onMouseLeave={() => start !== null && finish()}>
        <button className="day-summary" onClick={onToggle}>
          <span className="date-block"><strong>{date.getDate()}</strong><small>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</small></span>
          <span className="day-title"><strong>{title}</strong><small>{day.exercises.length} 動作 · {day.totalSets} 組</small></span>
          <i>{open ? '⌃' : '⌄'}</i>
        </button>
        {open && <div className="day-details">
          {day.exercises.map(exercise => {
            const exerciseOpen = Boolean(openExercises[exercise.id])
            return <div className="day-exercise" key={exercise.id}>
              <button className="day-exercise-summary" onClick={() => setOpenExercises(previous => ({ ...previous, [exercise.id]: !exerciseOpen }))}>
                <span><strong>{exercise.name}</strong>{exercise.note && <small>{exercise.note}</small>}</span>
                <em>{exercise.exercise_sets?.length || 0} 組 <i>{exerciseOpen ? '⌃' : '⌄'}</i></em>
              </button>
              {exerciseOpen && <div className="day-exercise-sets">
                {(exercise.exercise_sets || []).slice().sort((a, b) => a.order_index - b.order_index).map((set, index) => (
                  <div key={set.id || index}><strong>第 {index + 1} 組</strong><span>{formatExerciseSet(set)}</span></div>
                ))}
              </div>}
            </div>
          })}
        </div>}
      </article>
    </div>
  )
}

function EditDaySheet({ day, prototypeOnly, onClose, onPrototypeSaved, onSaved }) {
  const [date, setDate] = useState(day.date)
  const [name, setName] = useState(day.name || '')
  const [exercises, setExercises] = useState(() => day.exercises.map(exercise => ({
    ...exercise,
    open: false,
    removed: false,
    sets: (exercise.exercise_sets || []).map(set => ({ ...set, duration_min: set.duration_seconds ? Math.round(set.duration_seconds / 60) : '' })),
  })))
  const [saving, setSaving] = useState(false)

  const updateExerciseSet = (exerciseId, index, field, value) => setExercises(previous => previous.map(exercise => exercise.id !== exerciseId ? exercise : {
    ...exercise,
    sets: exercise.sets.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set),
  }))
  const addExerciseSet = exerciseId => setExercises(previous => previous.map(exercise => exercise.id !== exerciseId ? exercise : {
    ...exercise,
    sets: [...exercise.sets, exercise.category === 'cardio'
      ? { id: null, duration_min: '', weight: '', order_index: exercise.sets.length }
      : { id: null, weight: '', reps: '', order_index: exercise.sets.length }],
  }))
  const removeExerciseSet = (exerciseId, index) => setExercises(previous => previous.map(exercise => exercise.id !== exerciseId ? exercise : { ...exercise, sets: exercise.sets.filter((_, setIndex) => setIndex !== index) }))

  const save = async () => {
    setSaving(true)
    const output = { sessionIds: day.sessions.map(item => item.id), date, name, exercises: exercises.filter(item => !item.removed) }
    if (prototypeOnly) { onPrototypeSaved(output); return }
    try {
      for (const workout of day.sessions) {
        const result = await updateSession(workout.id, { date, name: name || '訓練' })
        if (result.error) throw result.error
      }
      for (const exercise of exercises) {
        if (exercise.removed) {
          const result = await deleteExercise(exercise.id)
          if (result.error) throw result.error
          continue
        }
        const exerciseResult = await updateExercise(exercise.id, { note: exercise.note || null })
        if (exerciseResult.error) throw exerciseResult.error
        const originalIds = new Set((exercise.exercise_sets || []).map(set => set.id))
        const retainedIds = new Set(exercise.sets.map(set => set.id).filter(Boolean))
        for (const removed of (exercise.exercise_sets || []).filter(set => originalIds.has(set.id) && !retainedIds.has(set.id))) {
          const result = await deleteSet(removed.id)
          if (result.error) throw result.error
        }
        for (let index = 0; index < exercise.sets.length; index += 1) {
          const set = exercise.sets[index]
          const cardio = exercise.category === 'cardio'
          const payload = {
            order_index: index,
            weight: Number(set.weight) || null,
            reps: cardio ? null : Number(set.reps) || null,
            duration_seconds: cardio ? Math.round((Number(set.duration_min) || 0) * 60) : null,
          }
          const result = set.id ? await updateSet(set.id, payload) : await createSet({ ...payload, exercise_id: exercise.id })
          if (result.error) throw result.error
        }
      }
      onSaved()
    } catch (error) {
      alert(`儲存失敗：${error.message || '請稍後再試'}`)
      setSaving(false)
    }
  }

  return <div className="edit-backdrop" onClick={event => event.target === event.currentTarget && onClose()}>
    <section className="edit-sheet">
      <div className="sheet-handle" />
      <header><h2>編輯訓練紀錄</h2><button onClick={onClose}>×</button></header>
      <label><span>日期</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label><span>訓練名稱 / 部位</span><input value={name} onChange={event => setName(event.target.value)} placeholder="例如：有氧 + 下肢" /></label>
      <div className="edit-list-label">動作清單</div>
      <div className="edit-exercise-list">
        {exercises.map(exercise => !exercise.removed && <div className="edit-exercise" key={exercise.id}>
          <button className="edit-exercise-row" onClick={() => setExercises(previous => previous.map(item => item.id === exercise.id ? { ...item, open: !item.open } : item))}>
            <strong>{exercise.name}</strong><span>{exercise.sets.length} 組</span><i>›</i>
          </button>
          <button className="remove-exercise" onClick={() => setExercises(previous => previous.map(item => item.id === exercise.id ? { ...item, removed: true } : item))}>×</button>
          {exercise.open && <div className="edit-sets">
            <div className="edit-set-head"><span /><span>{exercise.category === 'cardio' ? '分鐘' : 'KG'}</span><span>{exercise.category === 'cardio' ? '負重' : '次'}</span><span /></div>
            {exercise.sets.map((set, index) => <div className="edit-set-row" key={set.id || index}>
              <span>{index + 1}</span>
              <input type="number" value={exercise.category === 'cardio' ? set.duration_min ?? '' : set.weight ?? ''} onChange={event => updateExerciseSet(exercise.id, index, exercise.category === 'cardio' ? 'duration_min' : 'weight', event.target.value)} />
              <input type="number" value={exercise.category === 'cardio' ? set.weight ?? '' : set.reps ?? ''} onChange={event => updateExerciseSet(exercise.id, index, exercise.category === 'cardio' ? 'weight' : 'reps', event.target.value)} />
              <button onClick={() => removeExerciseSet(exercise.id, index)}>×</button>
            </div>)}
            <button className="edit-add-set" onClick={() => addExerciseSet(exercise.id)}>+ 加一組</button>
            <textarea value={exercise.note || ''} onChange={event => setExercises(previous => previous.map(item => item.id === exercise.id ? { ...item, note: event.target.value } : item))} placeholder="備註（選填）" />
          </div>}
        </div>)}
      </div>
      <p className="edit-hint">點動作可修改組數細節，點 × 可移除單一動作</p>
      <button className="neon-button save-edit" onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存變更'}</button>
    </section>
  </div>
}

function UserIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.6-4 2.7-6 6.5-6s5.9 2 6.5 6" /></svg> }

function EditIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg> }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></svg> }

function formatExerciseSet(set) {
  if (set.duration_seconds) return `${Math.round(set.duration_seconds / 60)} 分鐘${set.weight ? ` · ${set.weight}kg` : ''}`
  return `${set.weight || 0}kg × ${set.reps || 0} 次`
}

function groupByDay(sessions) {
  const grouped = {}
  sessions.forEach(workout => {
    if (!grouped[workout.date]) grouped[workout.date] = { date: workout.date, sessions: [], exercises: [], names: [] }
    grouped[workout.date].sessions.push(workout)
    grouped[workout.date].names.push(workout.name)
    grouped[workout.date].exercises.push(...(workout.session_exercises || []).map(exercise => ({ ...exercise, sessionId: workout.id })))
  })
  return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)).map(day => ({
    ...day,
    name: [...new Set(day.names.filter(Boolean))].join(' + '),
    totalSets: day.exercises.reduce((total, exercise) => total + (exercise.exercise_sets?.length || 0), 0),
  }))
}

function groupByMonth(days) {
  const grouped = {}
  days.forEach(day => {
    const key = day.date.slice(0, 7)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(day)
  })
  return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([key, monthDays]) => ({
    key,
    label: `${Number(key.slice(0, 4))} 年 ${Number(key.slice(5, 7))} 月`,
    days: monthDays,
  }))
}

function getCurrentWeek(today) {
  const monday = new Date(today)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { date: isoDate(date), weekday: ['一', '二', '三', '四', '五', '六', '日'][index], day: date.getDate() }
  })
}

function readTargetDays(userId) {
  try { return Number(JSON.parse(localStorage.getItem(`fitness-goals:${userId}`))?.trainingDays) || 3 } catch { return 3 }
}

function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' }) }
