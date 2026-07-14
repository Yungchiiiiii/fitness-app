import { useEffect, useMemo, useState } from 'react'
import { getCustomExercises, getExerciseProgress, getHiddenExercises, getSessions } from '../lib/db'
import { CATEGORY_META, WORLD_GYM_LIBRARY, getExerciseByName } from '../lib/exerciseLibrary'

const categoryKeys = Object.keys(CATEGORY_META)
const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

export default function TrainingScreen({ session }) {
  const [selected, setSelected] = useState('槓鈴深蹲')
  const [showPicker, setShowPicker] = useState(false)
  const [category, setCategory] = useState('lower')
  const [progress, setProgress] = useState([])
  const [sessions, setSessions] = useState([])
  const [customExercises, setCustomExercises] = useState([])
  const [hiddenExerciseNames, setHiddenExerciseNames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) return undefined
    let cancelled = false
    setLoading(true)
    Promise.all([
      getExerciseProgress(session.user.id, selected),
      getSessions(session.user.id),
      getCustomExercises(session.user.id),
      getHiddenExercises(session.user.id),
    ]).then(([progressResult, sessionResult, customResult, hiddenResult]) => {
      if (cancelled) return
      const hiddenNames = (hiddenResult.data || []).map(row => row.exercise_name)
      const visibleNames = [
        ...(customResult.data || []).map(item => item.name),
        ...Object.values(WORLD_GYM_LIBRARY).flatMap(items => items.map(item => item.name)),
      ].filter(name => !hiddenNames.includes(name))
      setProgress(progressResult.data || [])
      setSessions(sessionResult.data || [])
      setCustomExercises(customResult.data || [])
      setHiddenExerciseNames(hiddenNames)
      if (!visibleNames.includes(selected) && visibleNames.length) setSelected(visibleNames[0])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [selected, session?.user?.id])

  const selectedMeta = getExerciseByName(selected) || customExercises.find(item => item.name === selected)
  const inputType = selectedMeta?.inputType || selectedMeta?.input_type || (selectedMeta?.category === 'cardio' ? 'cardio' : selectedMeta?.category === 'core' ? 'core' : 'strength')
  const unit = inputType === 'strength' ? 'kg' : inputType === 'cardio' ? '分' : '秒'
  const history = useMemo(() => progress.map(row => {
    const matchingExercise = sessions
      .find(workout => workout.date === row.date)
      ?.session_exercises?.find(exercise => exercise.name === selected)
    const exactSets = (matchingExercise?.exercise_sets || []).slice().sort((a, b) => a.order_index - b.order_index)
    const best = inputType === 'strength'
      ? Number(row.best_weight) || 0
      : Math.round((Number(row.total_duration_seconds) || 0) / (inputType === 'cardio' ? 60 : 1))
    return {
      key: `${row.date}-${matchingExercise?.id || selected}`,
      date: formatDate(row.date),
      best,
      oneRm: Number(row.best_estimated_1rm) || null,
      sets: exactSets,
      setCount: Number(row.total_sets) || exactSets.length,
      reps: Number(row.total_reps) || 0,
      note: matchingExercise?.note || '',
      volume: Number(row.total_volume) || 0,
    }
  }), [inputType, progress, selected, sessions])
  const exerciseSetCounts = useMemo(() => sessions.reduce((counts, workout) => {
    for (const exercise of workout.session_exercises || []) {
      counts[exercise.name] = (counts[exercise.name] || 0) + (exercise.exercise_sets?.length || 0)
    }
    return counts
  }, {}), [sessions])
  const latest = history.at(-1)

  return <div className="screen-fade training-history">
    <header className="training-heading">
      <h1>歷史紀錄</h1>
      <p>選一個動作，看重量、組數與備註的變化</p>
    </header>

    <button className="exercise-query-main" onClick={() => setShowPicker(true)}>
      <span><small>查詢動作</small><strong>{selected}</strong></span>
      <span className="query-arrow" aria-hidden="true">⌄</span>
    </button>

    <section className="card progress-card">
      <div className="progress-card-head">
        <div><span>{selected} {inputType === 'strength' ? '重量趨勢' : '表現趨勢'}</span><strong>{latest?.best || 0}{unit}</strong></div>
        {inputType === 'strength' && <em>est. 1RM {latest?.oneRm || 0}kg</em>}
      </div>
      {loading && <p className="training-empty">正在讀取雲端紀錄…</p>}
      {!loading && !history.length && <p className="training-empty">還沒有這個動作的紀錄，完成一次訓練後就會出現在這裡。</p>}
      {!!history.length && <ProgressLine data={history} unit={unit} />}
    </section>

    <h2 className="history-record-title">每次紀錄</h2>
    <div className="training-record-list">
      {history.slice().reverse().map(entry => <RecordCard key={entry.key} entry={entry} unit={unit} inputType={inputType} />)}
    </div>

    {showPicker && <ExercisePicker category={category} selected={selected} setCounts={exerciseSetCounts} customExercises={customExercises} hiddenExerciseNames={hiddenExerciseNames} onCategory={setCategory} onClose={() => setShowPicker(false)} onSelect={name => { setSelected(name); setShowPicker(false) }} />}
  </div>
}

function ProgressLine({ data, unit }) {
  const display = data.slice(-6)
  const values = display.map(item => item.best)
  const min = Math.min(...values) - Math.max(1, (Math.max(...values) - Math.min(...values)) * .2)
  const max = Math.max(...values) + Math.max(1, (Math.max(...values) - Math.min(...values)) * .2)
  const points = display.map((item, index) => ({
    x: 14 + index * (172 / Math.max(1, display.length - 1)),
    y: 92 - ((item.best - min) / Math.max(1, max - min)) * 58,
    ...item,
  }))
  return <svg className="progress-chart" viewBox="0 0 200 132" aria-label={`${unit}變化圖`}>
    {[32, 64, 96].map(y => <path key={y} d={`M14 ${y}H186`} stroke="rgba(255,255,255,.12)" />)}
    <polyline className="chart-draw-line" pathLength="1" points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="var(--neon)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    {points.map((point, index) => <g className="chart-point" style={{ '--point-delay': `${.45 + index * .08}s` }} key={`${point.date}-${index}`}>
      <text x={point.x} y={Math.max(10, point.y - 10)} textAnchor="middle" fontSize="8" fill="#D8FFAB" fontWeight="900">{point.best}{unit}</text>
      <circle cx={point.x} cy={point.y} r="5" fill="#0c0c0d" stroke="var(--neon)" strokeWidth="3" />
      <text x={point.x} y="124" textAnchor="middle" fontSize="9" fill="#A1A1A6" fontWeight="800">{point.date}</text>
    </g>)}
  </svg>
}

function ExercisePicker({ category, selected, setCounts, customExercises, hiddenExerciseNames, onCategory, onClose, onSelect }) {
  const builtIn = (WORLD_GYM_LIBRARY[category] || []).map(item => item.name)
  const custom = customExercises.filter(item => item.category === category).map(item => item.name)
  const names = [...new Set([...custom, ...builtIn])]
    .filter(name => !hiddenExerciseNames.includes(name))
    .sort((a, b) => (setCounts[b] || 0) - (setCounts[a] || 0) || a.localeCompare(b, 'zh-Hant'))
  return <div className="sheet-backdrop training-picker-backdrop" onClick={event => event.target === event.currentTarget && onClose()}>
    <section className="sheet-panel training-picker">
      <div className="sheet-handle" />
      <header><div><h2>選擇動作</h2><p>先選分類，再選要查看的動作</p></div><button onClick={onClose} aria-label="關閉">×</button></header>
      <div className="picker-category-grid">
        {categoryKeys.map(key => <button key={key} className={`picker-choice ${category === key ? 'active' : ''}`} onClick={() => onCategory(key)}>{CATEGORY_META[key].label}</button>)}
      </div>
      <div className="picker-exercise-list motion-panel" key={category}>
        {names.map(name => {
          const count = setCounts[name] || 0
          return <button key={name} className={`picker-exercise ${selected === name ? 'active' : ''}`} onClick={() => onSelect(name)}>
            <span>{name}</span>
            <span className="exercise-record-meta"><b className={count ? 'has-records' : ''}>{count} 組</b><i>{selected === name ? '目前顯示' : '›'}</i></span>
          </button>
        })}
      </div>
    </section>
  </div>
}

function RecordCard({ entry, unit, inputType }) {
  const [open, setOpen] = useState(false)
  return <article className={`training-record card ${open ? 'open' : ''}`}>
    <button className="training-record-summary" onClick={() => setOpen(value => !value)}>
      <span><small>{entry.date}</small><strong>{entry.best}{unit}</strong>{entry.oneRm ? <em>est. 1RM {entry.oneRm}kg</em> : null}</span>
      <span><b>{entry.setCount} 組{entry.reps ? ` · ${entry.reps} 次` : ''}</b><i>{open ? '⌃' : '⌄'}</i></span>
    </button>
    {open && <div className="training-record-detail">
      {!!entry.sets.length && entry.sets.map((set, index) => <div key={set.id || index}><strong>第 {index + 1} 組</strong><span>{inputType === 'strength' ? `${Number(set.weight) || 0} kg × ${Number(set.reps) || 0} 次` : `${Math.round((Number(set.duration_seconds) || 0) / (inputType === 'cardio' ? 60 : 1))} ${unit}`}</span></div>)}
      {!entry.sets.length && <div><strong>組數</strong><span>{entry.setCount} 組</span></div>}
      {entry.note && <p>備註：{entry.note}</p>}
      {!entry.note && entry.volume > 0 && <p>總訓練量：{entry.volume} kg</p>}
    </div>}
  </article>
}
