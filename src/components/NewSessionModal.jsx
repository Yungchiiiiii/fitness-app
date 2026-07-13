import { useMemo, useState } from 'react'
import { createExercise, createSession, createSet, updateSession } from '../lib/db'
import { supabase } from '../lib/supabase'

export const EXERCISE_LIBRARY = {
  lower: ['單側負重火箭蹲', '單側負重側向蹲', '單側臀橋', '深蹲', '史密斯深蹲', '羅馬尼亞硬拉', '保加利亞弓箭步', '硬舉', '腿推', '腿彎舉', '腿伸展', '臀推'],
  upper: ['臥推', '上斜臥推', '肩推', '引體向上', '滑輪下拉', '坐姿划船', '啞鈴划船', '二頭彎舉', '三頭下壓', '側平舉', '臉拉', '飛鳥'],
  cardio: ['跑步機', '爬樓機', '飛輪', '划船機', '橢圓機', '戶外跑步'],
  core: ['棒式', '捲腹', '懸掛抬腿', '俄羅斯轉體', '死蟲式', '側棒式', '滾輪'],
}

export const CAT_META = {
  lower: { label: '下肢', inputType: 'strength', description: '股四頭與臀大肌 / 下肢穩定' },
  upper: { label: '上肢', inputType: 'strength', description: '胸背肩與手臂 / 上肢力量' },
  cardio: { label: '有氧', inputType: 'cardio', description: '心肺耐力 / 節奏與時間' },
  core: { label: '核心', inputType: 'core', description: '核心控制 / 軀幹穩定' },
}

export const getCategory = (name) => Object.keys(EXERCISE_LIBRARY).find(key => EXERCISE_LIBRARY[key].includes(name)) || 'upper'
export const getInputType = name => CAT_META[getCategory(name)].inputType

const emptySet = inputType => inputType === 'strength'
  ? { weight: '', reps: '' }
  : { duration_min: '', weight: '' }

const newSets = inputType => inputType === 'strength'
  ? Array.from({ length: 3 }, () => emptySet(inputType))
  : [emptySet(inputType)]

export function ExercisePickerSheet({ sessions, prototypeOnly = false, onClose, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  const library = useMemo(() => Object.entries(EXERCISE_LIBRARY)
    .flatMap(([category, names]) => names.map(name => ({ name, category, ...CAT_META[category] })))
    .filter(item => filter === 'all' || item.category === filter)
    .filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())), [filter, query])

  const addMovement = item => {
    if (selected.some(movement => movement.name === item.name)) return
    setSelected(previous => [...previous, {
      name: item.name,
      category: item.category,
      inputType: item.inputType,
      sets: newSets(item.inputType),
      note: '',
    }])
  }

  const removeMovement = name => setSelected(previous => previous.filter(item => item.name !== name))

  const updateSetValue = (name, index, field, value) => setSelected(previous => previous.map(item => item.name !== name ? item : {
    ...item,
    sets: item.sets.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set),
  }))

  const addSet = name => setSelected(previous => previous.map(item => item.name !== name ? item : {
    ...item,
    sets: [...item.sets, emptySet(item.inputType)],
  }))

  const removeSet = (name, index) => setSelected(previous => previous.map(item => item.name !== name ? item : {
    ...item,
    sets: item.sets.length === 1 ? item.sets : item.sets.filter((_, setIndex) => setIndex !== index),
  }))

  const updateNote = (name, note) => setSelected(previous => previous.map(item => item.name === name ? { ...item, note } : item))

  const buildName = () => {
    const categories = [...new Set(selected.map(item => CAT_META[item.category].label))]
    return categories.join(' + ') || '今日訓練'
  }

  const save = async () => {
    if (!selected.length || saving) return
    setSaving(true)
    try {
      if (prototypeOnly) {
        const stamp = Date.now()
        const created = {
          id: `proto-${stamp}`,
          date,
          name: buildName(),
          session_exercises: selected.map((item, index) => ({
            id: `proto-ex-${stamp}-${index}`,
            name: item.name,
            category: item.category,
            note: item.note,
            order_index: index,
            exercise_sets: item.sets.map((set, setIndex) => ({
              id: `proto-set-${stamp}-${index}-${setIndex}`,
              order_index: setIndex,
              weight: Number(set.weight) || null,
              reps: item.inputType === 'strength' ? Number(set.reps) || null : null,
              duration_seconds: item.inputType === 'strength' ? null : Math.round((Number(set.duration_min) || 0) * 60),
              unit: 'kg',
            })),
          })),
        }
        onSaved(created)
        return
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('請重新登入後再試')
      const sameDay = sessions.find(item => item.date === date)
      let workout = sameDay
      if (!workout) {
        const result = await createSession({ user_id: user.id, date, name: buildName() })
        if (result.error) throw result.error
        workout = result.data
      } else {
        const existingLabels = String(workout.name || '').split(' + ')
        const mergedName = [...new Set([...existingLabels, ...buildName().split(' + ')])].filter(Boolean).join(' + ')
        const result = await updateSession(workout.id, { name: mergedName })
        if (result.error) throw result.error
      }

      const initialCount = sameDay?.session_exercises?.length || 0
      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index]
        const exerciseResult = await createExercise({
          session_id: workout.id,
          name: item.name,
          category: item.category,
          note: item.note || null,
          order_index: initialCount + index,
        })
        if (exerciseResult.error) throw exerciseResult.error
        for (let setIndex = 0; setIndex < item.sets.length; setIndex += 1) {
          const set = item.sets[setIndex]
          const payload = {
            exercise_id: exerciseResult.data.id,
            order_index: setIndex,
            weight: Number(set.weight) || null,
            reps: item.inputType === 'strength' ? Number(set.reps) || null : null,
            duration_seconds: item.inputType === 'strength' ? null : Math.round((Number(set.duration_min) || 0) * 60),
            unit: 'kg',
          }
          const setResult = await createSet(payload)
          if (setResult.error) throw setResult.error
        }
      }
      onSaved()
    } catch (error) {
      alert(`儲存失敗：${error.message || '請稍後再試'}`)
      setSaving(false)
    }
  }

  return (
    <div className="session-builder" role="dialog" aria-modal="true">
      <header className="session-builder-header">
        <button className="round-close" onClick={onClose} aria-label="關閉">×</button>
        <span className="eyebrow">NEW SESSION</span>
        <button className="neon-button compact" onClick={save} disabled={!selected.length || saving}>
          {saving ? '儲存中' : 'SAVE'}
        </button>
      </header>

      <main className="session-builder-content">
        <h1>BUILD<br />SESSION</h1>
        <div className="builder-meta">
          <input type="date" value={date} onChange={event => setDate(event.target.value)} aria-label="訓練日期" />
          <span>· 點擊動作 [+] 加入 · [−] 移除</span>
        </div>
        <div className="picked-count"><i /> {selected.length} MOVEMENTS PICKED</div>

        {selected.map((item, movementIndex) => (
          <section className="movement-editor" key={item.name}>
            <div className="movement-editor-title">
              <span>{String(movementIndex + 1).padStart(2, '0')}</span>
              <strong>{item.name}</strong>
              <button onClick={() => removeMovement(item.name)} aria-label={`移除 ${item.name}`}>−</button>
            </div>
            <div className="set-grid set-grid-header">
              <span />
              <span>{item.inputType === 'strength' ? 'KG' : '分鐘'}</span>
              <span>{item.inputType === 'strength' ? '次' : '負重'}</span>
              <span />
            </div>
            {item.sets.map((set, setIndex) => (
              <div className="set-grid" key={`${item.name}-${setIndex}`}>
                <span className="set-number">{setIndex + 1}</span>
                <input type="number" inputMode="decimal" placeholder={item.inputType === 'strength' ? 'kg' : '分鐘'} value={item.inputType === 'strength' ? set.weight : set.duration_min} onChange={event => updateSetValue(item.name, setIndex, item.inputType === 'strength' ? 'weight' : 'duration_min', event.target.value)} />
                <input type="number" inputMode="decimal" placeholder={item.inputType === 'strength' ? '次' : 'kg'} value={item.inputType === 'strength' ? set.reps : set.weight} onChange={event => updateSetValue(item.name, setIndex, item.inputType === 'strength' ? 'reps' : 'weight', event.target.value)} />
                <button className="remove-set" onClick={() => removeSet(item.name, setIndex)} aria-label="移除組數">×</button>
              </div>
            ))}
            <button className="add-set" onClick={() => addSet(item.name)}>+ 加一組</button>
            <textarea value={item.note} onChange={event => updateNote(item.name, event.target.value)} placeholder="備註（選填）" />
          </section>
        ))}

        <section className="movement-library">
          <div className="eyebrow muted">LIBRARY</div>
          <label className="movement-search">
            <span>⌕</span>
            <input placeholder="SEARCH MOVEMENTS" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <div className="library-filters">
            {[['all', '全部'], ...Object.entries(CAT_META).map(([key, value]) => [key, value.label])].map(([key, label]) => (
              <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="library-list">
            {library.map(item => {
              const picked = selected.some(movement => movement.name === item.name)
              return (
                <button key={item.name} className="library-row" onClick={() => picked ? removeMovement(item.name) : addMovement(item)}>
                  <span><strong>{item.name}</strong><small>{item.description}</small></span>
                  <i className={picked ? 'picked' : ''}>{picked ? '✓' : '+'}</i>
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

// Kept as a compatibility export for older callers.
export function SetsFillerSheet() { return null }
