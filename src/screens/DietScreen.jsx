import { useEffect, useMemo, useState } from 'react'
import { analyzeFoodWithGemini } from '../lib/ai'
import {
  createFoodLog,
  createFrequentFood,
  deleteFoodLog,
  deleteFrequentFood,
  getFoodLogsRange,
  getFrequentFoods,
  getFrequentFoodsInitialized,
  initializeFrequentFoods,
  updateFrequentFood,
} from '../lib/db'
import { frequentFoods as defaultFrequentFoods, mealCalendar } from '../lib/prototypeData'

const today = new Date()
const todayDay = today.getDate()
const currentYear = today.getFullYear()
const currentMonth = today.getMonth()
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
const dateForDay = day => `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export default function DietScreen({ session }) {
  const prototypeOnly = !!session?.prototype
  const [selectedDay, setSelectedDay] = useState(todayDay)
  const [showAdd, setShowAdd] = useState(false)
  const [calendar, setCalendar] = useState(prototypeOnly ? mealCalendar : {})
  const [frequentFoods, setFrequentFoods] = useState(() => defaultFrequentFoods.map((food, index) => ({ ...food, id: `prototype-default-${index}` })))
  const [loading, setLoading] = useState(!prototypeOnly)
  const [error, setError] = useState('')
  const day = calendar[selectedDay] || emptyDay

  const reload = async () => {
    if (prototypeOnly || !session?.user?.id) return
    setLoading(true)
    setError('')
    const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${daysInMonth}`
    const { data, error: loadError } = await getFoodLogsRange(session.user.id, from, to)
    if (loadError) setError(`讀取飲食紀錄失敗：${loadError.message}`)
    else setCalendar(groupFoodLogs(data || []))
    setLoading(false)
  }

  const reloadFrequentFoods = async () => {
    if (prototypeOnly || !session?.user?.id) return
    const initializedResult = await getFrequentFoodsInitialized(session.user.id)
    if (initializedResult.error) {
      setError(`讀取常吃食物失敗：${initializedResult.error.message}`)
      return
    }
    if (!initializedResult.data?.frequent_foods_initialized) {
      const initializeResult = await initializeFrequentFoods(session.user.id, defaultFrequentFoods)
      if (initializeResult.error) {
        setError(`建立常吃食物失敗：${initializeResult.error.message}`)
        return
      }
    }
    const { data, error: frequentError } = await getFrequentFoods(session.user.id)
    if (frequentError) setError(`讀取常吃食物失敗：${frequentError.message}`)
    else setFrequentFoods(data || [])
  }

  useEffect(() => { reload(); reloadFrequentFoods() }, [session?.user?.id, prototypeOnly])

  const addMeal = async (meal) => {
    const normalized = normalizeMeal(meal)
    if (!prototypeOnly) {
      const { error: saveError } = await createFoodLog({
        user_id: session.user.id,
        date: dateForDay(selectedDay),
        meal: normalized.name,
        name: normalized.food,
        kcal: normalized.kcal,
        protein: normalized.protein,
        carbs: normalized.carbs,
        fat: normalized.fat,
        note: normalized.note || null,
        source: meal.source || 'manual',
      })
      if (saveError) {
        setError(`儲存餐點失敗：${saveError.message}`)
        return
      }
      await reload()
      setShowAdd(false)
      return
    }

    setCalendar(prev => {
      const current = prev[selectedDay] || emptyDay
      return {
        ...prev,
        [selectedDay]: {
          ...current,
          calories: current.calories + normalized.kcal,
          protein: current.protein + normalized.protein,
          carbs: current.carbs + normalized.carbs,
          fat: current.fat + normalized.fat,
          meals: [...current.meals, normalized],
          advice: '已加入新餐點；晚點 AI 可依整天總量再微調建議。',
        },
      }
    })
    setShowAdd(false)
  }
  const deleteMeal = async (idx) => {
    const current = calendar[selectedDay] || emptyDay
    const meal = current.meals[idx]
    if (!meal) return
    if (!prototypeOnly && meal.id) {
      const { error: deleteError } = await deleteFoodLog(meal.id)
      if (deleteError) {
        setError(`刪除餐點失敗：${deleteError.message}`)
        return
      }
      await reload()
      return
    }
    setCalendar(prev => {
      const currentDay = prev[selectedDay] || emptyDay
      return {
        ...prev,
        [selectedDay]: {
          ...currentDay,
          calories: Math.max(0, currentDay.calories - (meal.kcal || 0)),
          protein: Math.max(0, currentDay.protein - (meal.protein || 0)),
          carbs: Math.max(0, currentDay.carbs - (meal.carbs || 0)),
          fat: Math.max(0, currentDay.fat - (meal.fat || 0)),
          meals: currentDay.meals.filter((_, i) => i !== idx),
          advice: '已更新餐點紀錄；AI 建議會依新的總量重新判讀。',
        },
      }
    })
  }

  const saveFrequentFood = async food => {
    const normalized = normalizeFrequentFood(food)
    if (prototypeOnly) {
      setFrequentFoods(current => food.id
        ? current.map(item => item.id === food.id ? { ...item, ...normalized, id: food.id } : item)
        : [...current, { ...normalized, id: `prototype-${Date.now()}` }])
      return { ok: true }
    }
    const payload = { ...normalized, user_id: session.user.id }
    const result = food.id
      ? await updateFrequentFood(food.id, normalized)
      : await createFrequentFood(payload)
    if (result.error) {
      setError(`儲存常吃食物失敗：${result.error.message}`)
      return { ok: false }
    }
    await reloadFrequentFoods()
    return { ok: true }
  }

  const removeFrequentFood = async food => {
    if (prototypeOnly) {
      setFrequentFoods(current => current.filter(item => item !== food && item.id !== food.id))
      return
    }
    const { error: removeError } = await deleteFrequentFood(food.id)
    if (removeError) setError(`刪除常吃食物失敗：${removeError.message}`)
    else await reloadFrequentFoods()
  }
  return (
    <div className="screen-fade">
      <div style={{ padding: '8px 4px 4px' }}>
        <div className="display" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink-1)' }}>飲食</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>月曆回顧、餐點與 AI 建議</div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>{currentMonth + 1} 月飲食追蹤</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>點日期查看當天紀錄</div>
          </div>
          <span className="pill" style={{ color: 'var(--orange-d)', background: 'var(--blue-soft)' }}>{selectedDay} 日</span>
        </div>
        <CalendarGrid selectedDay={selectedDay} onSelect={setSelectedDay} data={calendar} daysInMonth={daysInMonth} />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>{selectedDay === todayDay ? '今日熱量' : `${currentMonth + 1}/${selectedDay} 熱量`}</div>
            <div className="display" style={{ fontSize: 34, fontWeight: 900, color: 'var(--ink-1)', marginTop: 6 }}>{day.calories}</div>
          </div>
          <span className="pill" style={{ color: 'var(--orange-d)', background: 'var(--blue-soft)' }}>/ 2450 kcal</span>
        </div>
        <MacroBar label="蛋白質" value={day.protein} target={180} color="#FF7A1E" />
        <MacroBar label="碳水" value={day.carbs} target={260} color="#F43F5E" />
        <MacroBar label="脂肪" value={day.fat} target={70} color="#F59E0B" />
      </div>

      <div className="section-title">當日 AI 建議</div>
      <div className="card" style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.55, fontWeight: 750 }}>
        {day.advice}
      </div>

      <div className="section-title">當日飲食</div>
      {loading && <div className="card" style={{ color: 'var(--ink-3)', fontSize: 13 }}>正在讀取雲端紀錄...</div>}
      {error && <div className="card" style={{ color: '#DC2626', fontSize: 13, lineHeight: 1.5 }}>{error}</div>}
      <div className="meal-group-list">
        {groupMealsByType(day.meals).map(group => <MealGroupCard key={group.type} group={group} onDelete={deleteMeal} />)}
        {!day.meals.length && !loading && <div className="card meal-empty">這一天還沒有餐點紀錄。</div>}
      </div>

      <button className="cta-card" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 800 }}>新增到 {currentMonth + 1}/{selectedDay}</div>
          <div className="display" style={{ color: '#fff', fontSize: 19, fontWeight: 900, marginTop: 2 }}>新增一餐 / 拍照辨識</div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.22)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 900 }}>+</div>
      </button>

      {showAdd && <AddMealSheet frequentFoods={frequentFoods} onSaveFrequentFood={saveFrequentFood} onDeleteFrequentFood={removeFrequentFood} onClose={() => setShowAdd(false)} onAdd={addMeal} />}
    </div>
  )
}

function CalendarGrid({ selectedDay, onSelect, data, daysInMonth: monthDays }) {
  const days = Array.from({ length: monthDays }, (_, i) => i + 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {days.map(day => {
        const hasData = !!data[day]
        const active = selectedDay === day
        return (
          <button key={day} onClick={() => onSelect(day)} style={{
            aspectRatio: '1 / 1',
            borderRadius: 14,
            background: active ? 'linear-gradient(135deg, #FF7A1E, #F43F5E)' : hasData ? '#FFF0DC' : '#fff',
            color: active ? '#fff' : hasData ? 'var(--orange-d)' : 'var(--ink-4)',
            fontWeight: 900,
            boxShadow: active ? '0 10px 20px rgba(249,115,22,0.22)' : 'inset 0 0 0 1px var(--line)',
            position: 'relative',
          }}>
            {day}
            {hasData && <span style={{ position: 'absolute', width: 5, height: 5, borderRadius: 99, background: active ? '#fff' : '#F43F5E', bottom: 6, left: '50%', transform: 'translateX(-50%)' }} />}
          </button>
        )
      })}
    </div>
  )
}

function normalizeMeal(meal) {
  return {
    id: meal.id,
    name: meal.meal || '點心',
    food: meal.name || '未命名餐點',
    protein: Number(meal.protein) || 0,
    kcal: Number(meal.kcal) || 0,
    carbs: Number(meal.carbs) || 0,
    fat: Number(meal.fat) || 0,
    note: meal.note || '',
  }
}

function groupFoodLogs(logs) {
  return logs.reduce((result, log) => {
    const day = Number(String(log.date).slice(-2))
    const current = result[day] || { ...emptyDay, meals: [] }
    const meal = normalizeMeal(log)
    result[day] = {
      ...current,
      calories: current.calories + meal.kcal,
      protein: current.protein + meal.protein,
      carbs: current.carbs + meal.carbs,
      fat: current.fat + meal.fat,
      meals: [...current.meals, meal],
      advice: '已整理雲端餐點紀錄；AI 可依當天總量再提供建議。',
    }
    return result
  }, {})
}

function normalizeFrequentFood(food) {
  return {
    meal: mealTypes.includes(food.meal) ? food.meal : '點心',
    name: String(food.name || '').trim(),
    kcal: Number(food.kcal) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
  }
}

function groupMealsByType(meals) {
  return mealTypes.map(type => ({
    type,
    items: meals.map((meal, index) => ({ meal, index })).filter(item => item.meal.name === type),
  })).filter(group => group.items.length)
}

function MealGroupCard({ group, onDelete }) {
  const [open, setOpen] = useState(false)
  const protein = group.items.reduce((sum, item) => sum + item.meal.protein, 0)
  const kcal = group.items.reduce((sum, item) => sum + item.meal.kcal, 0)
  return <section className={`meal-group-card ${open ? 'open' : ''}`}>
    <button className="meal-group-summary" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span><strong>{group.type}</strong><small>{group.items.length} 項餐點</small></span>
      <span><strong>P {protein}g</strong><small>{kcal} kcal</small><i>{open ? '⌃' : '⌄'}</i></span>
    </button>
    {open && <div className="meal-group-details">
      {group.items.map(({ meal, index }) => <div className="meal-detail-row" key={meal.id || `${meal.food}-${index}`}>
        <span><strong>{meal.food}</strong><small>P {meal.protein}g · {meal.kcal} kcal{meal.note ? ` · ${meal.note}` : ''}</small></span>
        <button onClick={() => onDelete(index)} aria-label={`刪除 ${meal.food}`}>刪除</button>
      </div>)}
    </div>}
  </section>
}

function AddMealSheet({ frequentFoods, onSaveFrequentFood, onDeleteFrequentFood, onClose, onAdd }) {
  const [mode, setMode] = useState('quick')
  const [mealType, setMealType] = useState(getSuggestedMealType)
  const [editingQuick, setEditingQuick] = useState(false)
  const [quickForm, setQuickForm] = useState(null)
  const [savingQuick, setSavingQuick] = useState(false)
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoDescription, setPhotoDescription] = useState('')
  const [photoPreviews, setPhotoPreviews] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisError, setAnalysisError] = useState('')
  const validCustom = custom.name && custom.kcal && custom.protein
  const mealFrequentFoods = frequentFoods.filter(food => food.meal === mealType)
  const manualMeal = useMemo(() => ({
    ...custom,
    meal: mealType,
    kcal: Number(custom.kcal) || 0,
    protein: Number(custom.protein) || 0,
    carbs: Number(custom.carbs) || 0,
    fat: Number(custom.fat) || 0,
  }), [custom, mealType])
  useEffect(() => {
    const urls = photoFiles.map(file => URL.createObjectURL(file))
    setPhotoPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [photoFiles])
  const analyzePhoto = async () => {
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const result = await analyzeFoodWithGemini({ files: photoFiles, description: photoDescription })
      setAnalysis(result)
    } catch (error) {
      setAnalysisError(error.message || 'AI 分析失敗')
    } finally {
      setAnalyzing(false)
    }
  }
  const beginNewFrequentFood = () => setQuickForm({ meal: mealType, name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const beginEditFrequentFood = food => setQuickForm({ ...food })
  const submitFrequentFood = async () => {
    if (!quickForm?.name?.trim() || savingQuick) return
    setSavingQuick(true)
    const result = await onSaveFrequentFood({ ...quickForm, meal: mealType })
    if (result?.ok) setQuickForm(null)
    setSavingQuick(false)
  }

  return (
    <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet-panel meal-sheet">
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="display" style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink-1)' }}>新增餐點</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 3 }}>拍照、手動，或點常吃食物</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 22 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
          {['quick', 'manual', 'photo'].map(key => (
            <button key={key} onClick={() => setMode(key)} className="pill" style={{
              padding: '10px 8px',
              color: mode === key ? '#050505' : '#F7F7F8',
              background: mode === key ? 'var(--neon)' : '#2C2C2E',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {key === 'quick' ? '常吃' : key === 'manual' ? '手動' : '拍照'}
            </button>
          ))}
        </div>

        <MealTypePicker value={mealType} onChange={type => { setMealType(type); setQuickForm(null) }} />

        {mode === 'quick' && (
          <div className="meal-mode-panel" key={`quick-${mealType}`}>
            <div className="frequent-food-toolbar">
              <span>{mealType}常吃</span>
              <button className={editingQuick ? 'active' : ''} onClick={() => { setEditingQuick(value => !value); setQuickForm(null) }}>{editingQuick ? '完成' : '編輯'}</button>
            </div>
            <div className="frequent-food-grid">
              {mealFrequentFoods.map((food, index) => editingQuick ? (
                <div key={food.id || `${food.meal}-${food.name}`} className="card meal-quick-card frequent-edit-card is-wiggling" style={{ '--wiggle-delay': `${index * -24}ms` }}>
                  <button className="frequent-remove" onClick={() => onDeleteFrequentFood(food)} aria-label={`刪除 ${food.name}`}>−</button>
                  <button className="frequent-edit-content" onClick={() => beginEditFrequentFood(food)}>
                    <strong>{food.name}</strong><small>{food.kcal} kcal · P {food.protein}g</small>
                  </button>
                </div>
              ) : (
                <button key={food.id || `${food.meal}-${food.name}`} onClick={() => onAdd({ ...food, meal: mealType, source: 'quick' })} className="card meal-quick-card">
                  <div>{food.name}</div><small>{food.kcal} kcal</small><strong>P {food.protein}g</strong>
                </button>
              ))}
            </div>
            {!mealFrequentFoods.length && <div className="frequent-food-empty">{mealType}還沒有常吃食物，可以從下方新增。</div>}
            {editingQuick && !quickForm && <button className="frequent-add" onClick={beginNewFrequentFood}>＋ 新增{mealType}常吃</button>}
            {quickForm && <FrequentFoodForm value={quickForm} onChange={setQuickForm} onCancel={() => setQuickForm(null)} onSave={submitFrequentFood} saving={savingQuick} />}
          </div>
        )}

        {mode === 'manual' && (
          <div className="meal-mode-panel" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MealField label="食物名稱">
              <input className="inp" placeholder="例如 雞胸飯" value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} />
            </MealField>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <MealField label="熱量" suffix="kcal">
                <input className="inp" placeholder="例如 650" type="number" value={custom.kcal} onChange={e => setCustom({ ...custom, kcal: e.target.value })} />
              </MealField>
              <MealField label="蛋白質" suffix="g">
                <input className="inp" placeholder="例如 45" type="number" value={custom.protein} onChange={e => setCustom({ ...custom, protein: e.target.value })} />
              </MealField>
              <MealField label="碳水" suffix="g">
                <input className="inp" placeholder="例如 70" type="number" value={custom.carbs} onChange={e => setCustom({ ...custom, carbs: e.target.value })} />
              </MealField>
              <MealField label="脂肪" suffix="g">
                <input className="inp" placeholder="例如 18" type="number" value={custom.fat} onChange={e => setCustom({ ...custom, fat: e.target.value })} />
              </MealField>
            </div>
            <button className="btn-primary" disabled={!validCustom} onClick={() => onAdd({ ...manualMeal, source: 'manual' })}>加入這一天</button>
          </div>
        )}

        {mode === 'photo' && (
          <div className="meal-mode-panel" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {photoPreviews.length ? <>
              <div className="photo-preview-grid">
                {photoPreviews.map((url, index) => <div className="photo-preview-item" key={`${photoFiles[index]?.name}-${index}`}>
                  <img src={url} alt={`餐點照片 ${index + 1}`} />
                  <button onClick={() => { setPhotoFiles(files => files.filter((_, fileIndex) => fileIndex !== index)); setAnalysis(null) }} aria-label={`移除第 ${index + 1} 張照片`}>×</button>
                </div>)}
              </div>
              <div className="photo-count">已加入 {photoFiles.length} / 4 張，會合併分析為同一餐</div>
            </> : <div className="card photo-picker" style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24, minHeight: 148, display: 'grid', placeItems: 'center', background: '#2C2C2E' }}>
              <div><div style={{ fontWeight: 900, color: 'var(--ink-1)', fontSize: 18 }}>加入餐點照片</div><div style={{ fontSize: 13, marginTop: 6 }}>最多 4 張，AI 會視為同一餐估算</div></div>
            </div>}
            <div className="photo-source-grid">
              <label>
                <span>{photoFiles.length ? '繼續加照片' : '從相片選擇'}</span>
                <small>可一次選取多張</small>
                <input type="file" accept="image/*" multiple disabled={photoFiles.length >= 4} onChange={e => selectPhotos(e, setPhotoFiles, setAnalysis, setAnalysisError)} />
              </label>
              <label>
                <span>現在拍照</span>
                <small>每次拍一張再追加</small>
                <input type="file" accept="image/*" capture="environment" disabled={photoFiles.length >= 4} onChange={e => selectPhotos(e, setPhotoFiles, setAnalysis, setAnalysisError)} />
              </label>
            </div>
            <textarea
              className="inp"
              placeholder="補充描述：例如半碗飯、雞胸、醬比較多、飲料無糖..."
              value={photoDescription}
              onChange={e => setPhotoDescription(e.target.value)}
              style={{ minHeight: 86, resize: 'none', lineHeight: 1.5 }}
            />
            <button className="btn-primary" disabled={analyzing || (!photoFiles.length && !photoDescription.trim())} onClick={analyzePhoto}>
              {analyzing ? 'AI 分析中...' : '用AI分析餐點'}
            </button>
            {analysisError && (
              <div className="card" style={{ color: '#DC2626', fontSize: 13, lineHeight: 1.5 }}>{analysisError}</div>
            )}
            {analysis && (
              <div className="card" style={{ padding: 15 }}>
                <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{mealType} · {analysis.name}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 6 }}>
                  {analysis.kcal} kcal · P {analysis.protein}g · C {analysis.carbs}g · F {analysis.fat}g
                </div>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{analysis.note}</div>
                {analysis.lookupUsed && <div style={{ color: '#16A34A', fontSize: 12, marginTop: 8, fontWeight: 800 }}>已用網路資料查證商品與份量</div>}
                {!!analysis.sources?.length && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {analysis.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--neon)', fontSize: 12 }}>查看 {source.title}</a>)}
                </div>}
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => onAdd({ ...analysis, meal: mealType, source: 'ai' })}>加入這一天</button>
              </div>
            )}
          </div>
        )}
    </div>
    </div>
  )
}

function selectPhotos(event, setPhotoFiles, setAnalysis, setAnalysisError) {
  const selected = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'))
  setPhotoFiles(current => [...current, ...selected].slice(0, 4))
  setAnalysis(null)
  setAnalysisError('')
  event.target.value = ''
}

const mealTypes = ['早餐', '午餐', '晚餐', '點心']

function getSuggestedMealType() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '早餐'
  if (hour >= 12 && hour < 14) return '午餐'
  if (hour >= 14 && hour < 18) return '點心'
  if (hour >= 18) return '晚餐'
  return '點心'
}

function MealTypePicker({ value, onChange }) {
  return <div>
    <div className="meal-type-picker" role="group" aria-label="餐別">
      {mealTypes.map(type => <button key={type} className={value === type ? 'active' : ''} onClick={() => onChange(type)}>{type}</button>)}
    </div>
    <div className="meal-type-hint">已依現在時間預選；你可以隨時修改，手動選擇會優先於 AI 判斷。</div>
  </div>
}

function FrequentFoodForm({ value, onChange, onCancel, onSave, saving }) {
  const field = (key, nextValue) => onChange({ ...value, [key]: nextValue })
  return <div className="frequent-food-form">
    <strong>{value.id ? '修改常吃食物' : `新增${value.meal}常吃`}</strong>
    <MealField label="食物名稱"><input className="inp" value={value.name} onChange={event => field('name', event.target.value)} placeholder="例如：太陽餅" /></MealField>
    <div className="frequent-food-form-grid">
      <MealField label="熱量" suffix="kcal"><input className="inp" type="number" inputMode="decimal" value={value.kcal} onChange={event => field('kcal', event.target.value)} /></MealField>
      <MealField label="蛋白質" suffix="g"><input className="inp" type="number" inputMode="decimal" value={value.protein} onChange={event => field('protein', event.target.value)} /></MealField>
      <MealField label="碳水" suffix="g"><input className="inp" type="number" inputMode="decimal" value={value.carbs} onChange={event => field('carbs', event.target.value)} /></MealField>
      <MealField label="脂肪" suffix="g"><input className="inp" type="number" inputMode="decimal" value={value.fat} onChange={event => field('fat', event.target.value)} /></MealField>
    </div>
    <div className="frequent-food-form-actions"><button onClick={onCancel}>取消</button><button disabled={saving || !value.name?.trim()} onClick={onSave}>{saving ? '儲存中…' : '儲存'}</button></div>
  </div>
}

function SwipeMealCard({ meal, onDelete }) {
  const [x, setX] = useState(0)
  const [start, setStart] = useState(null)
  const onMove = (clientX) => {
    if (start === null) return
    setX(Math.max(-78, Math.min(0, clientX - start)))
  }
  const end = () => {
    setX(x < -36 ? -78 : 0)
    setStart(null)
  }
  return (
    <div className="swipe-row">
      <div className="swipe-actions meal-swipe-actions">
        <button className="swipe-delete" onClick={onDelete}>刪除</button>
      </div>
      <div
        className="card swipe-card"
        style={{ transform: `translateX(${x}px)` }}
        onTouchStart={e => setStart(e.touches[0].clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onTouchEnd={end}
        onMouseDown={e => setStart(e.clientX)}
        onMouseMove={e => e.buttons === 1 && onMove(e.clientX)}
        onMouseUp={end}
        onMouseLeave={() => start !== null && end()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{meal.name}</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>{meal.food}</div>
            {meal.note && <div style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 5 }}>備註：{meal.note}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: 'var(--orange-d)', fontWeight: 900 }}>{meal.protein}g</div>
            <div style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 4 }}>{meal.kcal} kcal</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MealField({ label, suffix, children }) {
  return (
    <label className="field-wrap">
      <span className="field-label">{label}</span>
      <span className="field-control">
        {children}
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
    </label>
  )
}

function MacroBar({ label, value, target, color }) {
  const pct = Math.min(100, Math.round(value / target * 100))
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)', fontSize: 13, fontWeight: 900 }}>
        <span>{label}</span>
        <span>{value}/{target}g</span>
      </div>
      <div className="progress-track" style={{ marginTop: 7 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color }} />
      </div>
    </div>
  )
}

const emptyDay = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  advice: '這一天還沒有紀錄。可以先新增常吃食物，之後 AI 會給你當天建議。',
  meals: [],
}
