import { useEffect, useMemo, useState } from 'react'
import { classifyExerciseWithAI } from '../lib/ai'
import {
  createCustomExercise,
  createExercise,
  createSession,
  createSet,
  deleteCustomExercise,
  getCustomExercises,
  getHiddenExercises,
  hideExercise,
  updateCustomExercise,
  updateSession,
} from '../lib/db'
import { CATEGORY_META, WORLD_GYM_LIBRARY } from '../lib/exerciseLibrary'
import { supabase } from '../lib/supabase'

export const CAT_META = CATEGORY_META
export const EXERCISE_LIBRARY = Object.fromEntries(Object.entries(WORLD_GYM_LIBRARY).map(([category, rows]) => [category, rows.map(row => row.name)]))

const emptySet = inputType => inputType === 'strength'
  ? { weight: '', reps: '' }
  : { duration_min: '', weight: '' }

const customToLibraryItem = row => ({
  id: row.id,
  name: row.name,
  category: row.category || 'upper',
  inputType: row.input_type || CATEGORY_META[row.category]?.inputType || 'strength',
  target: row.target || CATEGORY_META[row.category]?.fallbackTarget || '全身肌群',
  equipment: '自訂動作',
  custom: true,
})

export function ExercisePickerSheet({ sessions, onClose, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [filter, setFilter] = useState('lower')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [customExercises, setCustomExercises] = useState([])
  const [hiddenExerciseNames, setHiddenExerciseNames] = useState([])
  const [userId, setUserId] = useState(null)
  const [editingLibrary, setEditingLibrary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState('auto')
  const [customTarget, setCustomTarget] = useState('')
  const [classifying, setClassifying] = useState(false)
  const [customError, setCustomError] = useState('')
  const [editingCustomId, setEditingCustomId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const [customResult, hiddenResult] = await Promise.all([
        getCustomExercises(data.user.id),
        getHiddenExercises(data.user.id),
      ])
      setCustomExercises((customResult.data || []).map(customToLibraryItem))
      setHiddenExerciseNames((hiddenResult.data || []).map(row => row.exercise_name))
    })
  }, [])

  const library = useMemo(() => {
    const rows = filter === 'custom'
      ? customExercises
      : [
          ...customExercises.filter(item => item.category === filter),
          ...(WORLD_GYM_LIBRARY[filter] || []).map(item => ({ ...item, category: filter })),
        ]
    const normalizedQuery = query.trim().toLowerCase()
    return rows.filter(item => !hiddenExerciseNames.includes(item.name))
      .filter(item => !normalizedQuery || `${item.name} ${item.target} ${item.equipment}`.toLowerCase().includes(normalizedQuery))
  }, [customExercises, filter, hiddenExerciseNames, query])

  const addMovement = item => {
    if (selected.some(movement => movement.name === item.name)) return
    setSelected(previous => [...previous, { ...item, sets: [emptySet(item.inputType)], note: '' }])
  }

  const removeMovement = name => setSelected(previous => previous.filter(item => item.name !== name))
  const updateSetValue = (name, index, field, value) => setSelected(previous => previous.map(item => item.name !== name ? item : {
    ...item,
    sets: item.sets.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set),
  }))
  const addSet = name => setSelected(previous => previous.map(item => item.name !== name ? item : { ...item, sets: [...item.sets, emptySet(item.inputType)] }))
  const removeSet = (name, index) => setSelected(previous => previous.map(item => item.name !== name ? item : {
    ...item,
    sets: item.sets.length === 1 ? item.sets : item.sets.filter((_, setIndex) => setIndex !== index),
  }))
  const updateNote = (name, note) => setSelected(previous => previous.map(item => item.name === name ? { ...item, note } : item))

  const analyzeCustom = async () => {
    if (!customName.trim()) {
      setCustomError('先輸入動作或器械名稱。')
      return null
    }
    setClassifying(true)
    setCustomError('')
    try {
      const result = await classifyExerciseWithAI(customName.trim())
      setCustomCategory(result.category)
      setCustomTarget(result.target)
      return result
    } catch (error) {
      setCustomError(`AI 判斷失敗：${error.message}`)
      return null
    } finally {
      setClassifying(false)
    }
  }

  const saveCustom = async () => {
    const suggestion = customCategory === 'auto' || !customTarget ? await analyzeCustom() : null
    const category = suggestion?.category || customCategory
    const target = suggestion?.target || customTarget
    if (!customName.trim() || !CATEGORY_META[category]) return
    setClassifying(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('雲端身分尚未建立')
      const inputType = CATEGORY_META[category].inputType
      const { data, error } = await createCustomExercise({
        user_id: user.id,
        name: customName.trim(),
        category,
        input_type: inputType,
        target: target || CATEGORY_META[category].fallbackTarget,
      })
      if (error) throw error
      const item = customToLibraryItem(data)
      setCustomExercises(previous => [...previous.filter(row => row.name !== item.name), item])
      addMovement(item)
      setFilter(category)
      setCustomName('')
      setCustomCategory('auto')
      setCustomTarget('')
      setCustomError('')
    } catch (error) {
      setCustomError(`新增失敗：${error.message}`)
    } finally {
      setClassifying(false)
    }
  }

  const editCustom = item => {
    setEditingCustomId(item.id)
    setCustomName(item.name)
    setCustomCategory(item.category)
    setCustomTarget(item.target)
    setCustomError('')
    window.setTimeout(() => document.querySelector('.custom-exercise-form input')?.focus(), 0)
  }

  const saveCustomEdit = async () => {
    if (!editingCustomId || !customName.trim() || !CATEGORY_META[customCategory]) return
    setClassifying(true)
    setCustomError('')
    try {
      const { data, error } = await updateCustomExercise(editingCustomId, {
        name: customName.trim(),
        category: customCategory,
        input_type: CATEGORY_META[customCategory].inputType,
        target: customTarget || CATEGORY_META[customCategory].fallbackTarget,
      })
      if (error) throw error
      const item = customToLibraryItem(data)
      setCustomExercises(previous => previous.map(row => row.id === item.id ? item : row))
      setSelected(previous => previous.map(row => row.id === item.id ? { ...row, ...item } : row))
      setEditingCustomId(null)
      setCustomName('')
      setCustomCategory('auto')
      setCustomTarget('')
    } catch (error) {
      setCustomError(`編輯失敗：${error.message}`)
    } finally {
      setClassifying(false)
    }
  }

  const removeCustom = async (item, askForConfirmation = true) => {
    if (askForConfirmation && !window.confirm(`確定刪除「${item.name}」？過去已完成的訓練紀錄不會被刪除。`)) return
    const { error } = await deleteCustomExercise(item.id)
    if (error) {
      setCustomError(`刪除失敗：${error.message}`)
      return
    }
    setCustomExercises(previous => previous.filter(row => row.id !== item.id))
    setSelected(previous => previous.filter(row => row.id !== item.id))
  }

  const removeLibraryItem = async item => {
    if (!window.confirm(`確定從你的運動清單刪除「${item.name}」？過去已完成的訓練紀錄不會被刪除。`)) return
    if (item.custom) {
      await removeCustom(item, false)
      return
    }
    if (!userId) {
      setCustomError('尚未取得帳號資料，請重新整理後再試。')
      return
    }
    const { error } = await hideExercise(userId, item.name)
    if (error && error.code !== '23505') {
      setCustomError(`刪除失敗：${error.message}`)
      return
    }
    setHiddenExerciseNames(previous => [...new Set([...previous, item.name])])
    setSelected(previous => previous.filter(row => row.name !== item.name))
  }

  const buildName = () => [...new Set(selected.map(item => CATEGORY_META[item.category].label))].join(' + ') || '今日訓練'

  const save = async () => {
    if (!selected.length || saving) return
    setSaving(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('雲端身分尚未建立，請重新整理後再試')
      const sameDay = sessions.find(item => item.date === date)
      let workout = sameDay
      if (!workout) {
        const result = await createSession({ user_id: user.id, date, name: buildName() })
        if (result.error) throw result.error
        workout = result.data
      } else {
        const mergedName = [...new Set([...String(workout.name || '').split(' + '), ...buildName().split(' + ')])].filter(Boolean).join(' + ')
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
          const setResult = await createSet({
            exercise_id: exerciseResult.data.id,
            order_index: setIndex,
            weight: Number(set.weight) || null,
            reps: item.inputType === 'strength' ? Number(set.reps) || null : null,
            duration_seconds: item.inputType === 'strength' ? null : Math.round((Number(set.duration_min) || 0) * 60),
            unit: 'kg',
          })
          if (setResult.error) throw setResult.error
        }
      }
      onSaved()
    } catch (error) {
      alert(`儲存失敗：${error.message || '請稍後再試'}`)
      setSaving(false)
    }
  }

  return <div className="session-builder" role="dialog" aria-modal="true">
    <header className="session-builder-header">
      <button className="round-close" onClick={onClose} aria-label="關閉">×</button>
      <span className="eyebrow">NEW SESSION</span>
      <button className="neon-button compact" onClick={save} disabled={!selected.length || saving}>{saving ? '儲存中' : 'SAVE'}</button>
    </header>

    <main className="session-builder-content">
      <h1>BUILD<br />SESSION</h1>
      <div className="builder-meta"><input type="date" value={date} onChange={event => setDate(event.target.value)} aria-label="訓練日期" /><span>· 加入動作後即可直接記錄</span></div>
      <div className="picked-count"><i /> {selected.length} MOVEMENTS PICKED</div>

      {selected.map((item, movementIndex) => <section className="movement-editor" key={item.name}>
        <div className="movement-editor-title"><span>{String(movementIndex + 1).padStart(2, '0')}</span><strong>{item.name}</strong><button onClick={() => removeMovement(item.name)} aria-label={`移除 ${item.name}`}>−</button></div>
        <div className="set-grid set-grid-header"><span /><span>{item.inputType === 'strength' ? 'KG' : '分鐘'}</span><span>{item.inputType === 'strength' ? '次' : '負重'}</span><span /></div>
        {item.sets.map((set, setIndex) => <div className="set-grid" key={`${item.name}-${setIndex}`}>
          <span className="set-number">{setIndex + 1}</span>
          <input type="number" inputMode="decimal" placeholder={item.inputType === 'strength' ? 'kg' : '分鐘'} value={item.inputType === 'strength' ? set.weight : set.duration_min} onChange={event => updateSetValue(item.name, setIndex, item.inputType === 'strength' ? 'weight' : 'duration_min', event.target.value)} />
          <input type="number" inputMode="decimal" placeholder={item.inputType === 'strength' ? '次' : 'kg'} value={item.inputType === 'strength' ? set.reps : set.weight} onChange={event => updateSetValue(item.name, setIndex, item.inputType === 'strength' ? 'reps' : 'weight', event.target.value)} />
          <button className="remove-set" onClick={() => removeSet(item.name, setIndex)} aria-label="移除組數">×</button>
        </div>)}
        <button className="add-set" onClick={() => addSet(item.name)}>+ 加一組</button>
        <textarea value={item.note} onChange={event => updateNote(item.name, event.target.value)} placeholder="備註（選填）" />
      </section>)}

      <section className="movement-library">
        <label className="movement-search"><span>⌕</span><input placeholder="搜尋器械或動作" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="library-filters">
          {Object.entries(CATEGORY_META).map(([key, value]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{value.label}</button>)}
          <button className={filter === 'custom' && !editingLibrary ? 'active custom-filter' : 'custom-filter'} onClick={() => { setEditingLibrary(false); setFilter('custom') }}>＋ 新增運動</button>
          <button className={editingLibrary ? 'active edit-library-filter' : 'edit-library-filter'} onClick={() => { setEditingLibrary(previous => !previous); if (filter === 'custom') setFilter('lower') }}>編輯運動</button>
        </div>

        {filter === 'custom' && !editingLibrary && <div className="custom-exercise-form">
          <strong>{editingCustomId ? '編輯自訂運動' : '新增自己的器械或動作'}</strong>
          <input value={customName} onChange={event => setCustomName(event.target.value)} placeholder="名稱，例如：臀部那台往外推" />
          <div className="custom-classify-row">
            <select value={customCategory} onChange={event => setCustomCategory(event.target.value)}>
              <option value="auto">讓 AI 自動分類</option>
              {Object.entries(CATEGORY_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
            <button onClick={analyzeCustom} disabled={classifying}>{classifying ? '判斷中…' : 'AI 判斷部位'}</button>
          </div>
          {customTarget && <div className="ai-target-result"><span>AI 建議</span><strong>{CATEGORY_META[customCategory]?.label} · {customTarget}</strong></div>}
          {customError && <div className="custom-error">{customError}</div>}
          <button className="save-custom-exercise" onClick={editingCustomId ? saveCustomEdit : saveCustom} disabled={classifying || !customName.trim()}>{editingCustomId ? '儲存修改' : 'AI 分類、儲存並加入'}</button>
          {editingCustomId && <button className="cancel-custom-edit" onClick={() => { setEditingCustomId(null); setCustomName(''); setCustomCategory('auto'); setCustomTarget('') }}>取消編輯</button>}
        </div>}

        <div className="library-list">
          {library.map(item => {
            const picked = selected.some(movement => movement.name === item.name)
            if (editingLibrary) return <div className="library-row library-edit-row" key={item.id || item.name}>
              <span><strong>{item.name}</strong><small>{item.target} · {item.equipment}</small></span>
              <button className="delete-library-item" onClick={() => removeLibraryItem(item)} aria-label={`刪除 ${item.name}`}>刪除</button>
            </div>
            return item.custom && filter === 'custom'
              ? <SwipeCustomExercise key={item.id} item={item} onEdit={() => editCustom(item)} onDelete={() => removeCustom(item)} onPick={() => picked ? removeMovement(item.name) : addMovement(item)} picked={picked} />
              : <button key={item.id || item.name} className="library-row" onClick={() => picked ? removeMovement(item.name) : addMovement(item)}>
                <span><strong>{item.name}</strong><small>{item.target} · {item.equipment}</small></span><i className={picked ? 'picked' : ''}>{picked ? '✓' : '+'}</i>
              </button>
          })}
          {!library.length && <div className="empty-custom-library">{editingLibrary ? '這個分類目前沒有可編輯的運動。' : '還沒有自訂動作，先在上方建立一個。'}</div>}
        </div>
      </section>
    </main>
  </div>
}

function SwipeCustomExercise({ item, onEdit, onDelete, onPick, picked }) {
  const [x, setX] = useState(0)
  const [start, setStart] = useState(null)
  const move = clientX => start !== null && setX(Math.max(-150, Math.min(0, clientX - start)))
  const finish = () => { setX(x < -38 ? -150 : 0); setStart(null) }
  return <div className="custom-swipe-row">
    <div className="custom-swipe-actions"><button onClick={onEdit}>編輯</button><button onClick={onDelete}>刪除</button></div>
    <button className="library-row custom-library-row" style={{ transform: `translateX(${x}px)` }} onClick={onPick}
      onTouchStart={event => setStart(event.touches[0].clientX)} onTouchMove={event => move(event.touches[0].clientX)} onTouchEnd={finish}
      onMouseDown={event => setStart(event.clientX)} onMouseMove={event => event.buttons === 1 && move(event.clientX)} onMouseUp={finish} onMouseLeave={() => start !== null && finish()}>
      <span><strong>{item.name}</strong><small>{CATEGORY_META[item.category]?.label} · {item.target}</small></span><i className={picked ? 'picked' : ''}>{picked ? '✓' : '+'}</i>
    </button>
  </div>
}

export function SetsFillerSheet() { return null }
