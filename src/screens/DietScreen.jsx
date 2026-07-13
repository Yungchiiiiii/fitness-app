import { useEffect, useMemo, useState } from 'react'
import { analyzeFoodWithGemini } from '../lib/ai'
import { createFoodLog, deleteFoodLog, getFoodLogsRange } from '../lib/db'
import { frequentFoods, mealCalendar } from '../lib/prototypeData'

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

  useEffect(() => { reload() }, [session?.user?.id, prototypeOnly])

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {day.meals.map((meal, idx) => (
          <SwipeMealCard
            key={`${meal.name}-${idx}`}
            meal={meal}
            onDelete={() => deleteMeal(idx)}
          />
        ))}
      </div>

      <button className="cta-card" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 800 }}>新增到 {currentMonth + 1}/{selectedDay}</div>
          <div className="display" style={{ color: '#fff', fontSize: 19, fontWeight: 900, marginTop: 2 }}>新增一餐 / 拍照辨識</div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.22)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 900 }}>+</div>
      </button>

      {showAdd && <AddMealSheet onClose={() => setShowAdd(false)} onAdd={addMeal} />}
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

function AddMealSheet({ onClose, onAdd }) {
  const [mode, setMode] = useState('quick')
  const [custom, setCustom] = useState({ meal: '午餐', name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoDescription, setPhotoDescription] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisError, setAnalysisError] = useState('')
  const validCustom = custom.name && custom.kcal && custom.protein
  const manualMeal = useMemo(() => ({
    ...custom,
    kcal: Number(custom.kcal) || 0,
    protein: Number(custom.protein) || 0,
    carbs: Number(custom.carbs) || 0,
    fat: Number(custom.fat) || 0,
  }), [custom])
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return undefined
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])
  const analyzePhoto = async () => {
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const result = await analyzeFoodWithGemini({ file: photoFile, description: photoDescription })
      setAnalysis(result)
    } catch (error) {
      setAnalysisError(error.message || 'AI 分析失敗')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet-panel">
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
              color: mode === key ? '#fff' : 'var(--ink-3)',
              background: mode === key ? 'var(--orange)' : '#fff',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {key === 'quick' ? '常吃' : key === 'manual' ? '手動' : '拍照'}
            </button>
          ))}
        </div>

        {mode === 'quick' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 16 }}>
            {frequentFoods.map(food => (
              <button key={food.name} onClick={() => onAdd({ ...food, source: 'quick' })} className="card" style={{ padding: 13, textAlign: 'left' }}>
                <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{food.name}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 4 }}>{food.meal} · {food.kcal} kcal</div>
                <div style={{ color: 'var(--orange-d)', fontSize: 12, fontWeight: 900, marginTop: 5 }}>P {food.protein}g</div>
              </button>
            ))}
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MealField label="餐別">
              <input className="inp" placeholder="早餐 / 午餐 / 晚餐 / 點心" value={custom.meal} onChange={e => setCustom({ ...custom, meal: e.target.value })} />
            </MealField>
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
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="card photo-picker" style={{
              textAlign: 'center',
              color: 'var(--ink-3)',
              padding: photoPreview ? 0 : 24,
              cursor: 'pointer',
              minHeight: 168,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: photoPreview ? `center / cover no-repeat url(${photoPreview})` : '#fff',
            }}>
              {photoPreview ? (
                <div style={{ alignSelf: 'end', width: '100%', padding: '44px 16px 14px', color: '#fff', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.58))' }}>
                  <div style={{ fontWeight: 900 }}>{photoFile?.name}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 900, color: 'var(--ink-1)', fontSize: 18 }}>加入照片</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>AI 會依照片辨識食物與估算營養</div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => {
                  setPhotoFile(e.target.files?.[0] || null)
                  setAnalysis(null)
                  setAnalysisError('')
                }}
              />
            </label>
            <textarea
              className="inp"
              placeholder="補充描述：例如半碗飯、雞胸、醬比較多、飲料無糖..."
              value={photoDescription}
              onChange={e => setPhotoDescription(e.target.value)}
              style={{ minHeight: 86, resize: 'none', lineHeight: 1.5 }}
            />
            <button className="btn-primary" disabled={analyzing || (!photoFile && !photoDescription.trim())} onClick={analyzePhoto}>
              {analyzing ? 'AI 分析中...' : '用AI分析餐點'}
            </button>
            {analysisError && (
              <div className="card" style={{ color: '#DC2626', fontSize: 13, lineHeight: 1.5 }}>{analysisError}</div>
            )}
            {analysis && (
              <div className="card" style={{ padding: 15 }}>
                <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{analysis.meal} · {analysis.name}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 6 }}>
                  {analysis.kcal} kcal · P {analysis.protein}g · C {analysis.carbs}g · F {analysis.fat}g
                </div>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{analysis.note}</div>
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => onAdd({ ...analysis, source: 'ai' })}>加入這一天</button>
              </div>
            )}
          </div>
        )}
    </div>
    </div>
  )
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
