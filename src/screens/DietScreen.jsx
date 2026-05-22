import { useMemo, useState } from 'react'
import { frequentFoods, mealCalendar } from '../lib/prototypeData'

const todayDay = 21

export default function DietScreen() {
  const [selectedDay, setSelectedDay] = useState(todayDay)
  const [showAdd, setShowAdd] = useState(false)
  const [calendar, setCalendar] = useState(mealCalendar)
  const day = calendar[selectedDay] || emptyDay

  const addMeal = (meal) => {
    setCalendar(prev => {
      const current = prev[selectedDay] || emptyDay
      return {
        ...prev,
        [selectedDay]: {
          ...current,
          calories: current.calories + meal.kcal,
          protein: current.protein + meal.protein,
          carbs: current.carbs + (meal.carbs || 0),
          fat: current.fat + (meal.fat || 0),
          meals: [...current.meals, { name: meal.meal, food: meal.name, protein: meal.protein, kcal: meal.kcal }],
          advice: '已加入新餐點；晚點 AI 可依整天總量再微調建議。',
        },
      }
    })
    setShowAdd(false)
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
            <div className="section-title" style={{ margin: 0 }}>5 月飲食追蹤</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>點日期查看當天紀錄</div>
          </div>
          <span className="pill" style={{ color: 'var(--orange-d)', background: 'var(--blue-soft)' }}>{selectedDay} 日</span>
        </div>
        <CalendarGrid selectedDay={selectedDay} onSelect={setSelectedDay} data={calendar} />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>{selectedDay === todayDay ? '今日熱量' : `5/${selectedDay} 熱量`}</div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {day.meals.map((meal, idx) => (
          <div key={`${meal.name}-${idx}`} className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{meal.name}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>{meal.food}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: 'var(--orange-d)', fontWeight: 900 }}>{meal.protein}g</div>
                <div style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 4 }}>{meal.kcal} kcal</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="cta-card" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 800 }}>新增到 5/{selectedDay}</div>
          <div className="display" style={{ color: '#fff', fontSize: 19, fontWeight: 900, marginTop: 2 }}>新增一餐 / 拍照辨識</div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.22)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 900 }}>+</div>
      </button>

      {showAdd && <AddMealSheet onClose={() => setShowAdd(false)} onAdd={addMeal} />}
    </div>
  )
}

function CalendarGrid({ selectedDay, onSelect, data }) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
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

function AddMealSheet({ onClose, onAdd }) {
  const [mode, setMode] = useState('quick')
  const [custom, setCustom] = useState({ meal: '午餐', name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const validCustom = custom.name && custom.kcal && custom.protein
  const manualMeal = useMemo(() => ({
    ...custom,
    kcal: Number(custom.kcal) || 0,
    protein: Number(custom.protein) || 0,
    carbs: Number(custom.carbs) || 0,
    fat: Number(custom.fat) || 0,
  }), [custom])

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
              <button key={food.name} onClick={() => onAdd(food)} className="card" style={{ padding: 13, textAlign: 'left' }}>
                <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{food.name}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 4 }}>{food.meal} · {food.kcal} kcal</div>
                <div style={{ color: 'var(--orange-d)', fontSize: 12, fontWeight: 900, marginTop: 5 }}>P {food.protein}g</div>
              </button>
            ))}
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="inp" placeholder="餐別：早餐 / 午餐 / 晚餐 / 點心" value={custom.meal} onChange={e => setCustom({ ...custom, meal: e.target.value })} />
            <input className="inp" placeholder="食物名稱" value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <input className="inp" placeholder="熱量" type="number" value={custom.kcal} onChange={e => setCustom({ ...custom, kcal: e.target.value })} />
              <input className="inp" placeholder="蛋白質" type="number" value={custom.protein} onChange={e => setCustom({ ...custom, protein: e.target.value })} />
              <input className="inp" placeholder="碳水" type="number" value={custom.carbs} onChange={e => setCustom({ ...custom, carbs: e.target.value })} />
              <input className="inp" placeholder="脂肪" type="number" value={custom.fat} onChange={e => setCustom({ ...custom, fat: e.target.value })} />
            </div>
            <button className="btn-primary" disabled={!validCustom} onClick={() => onAdd(manualMeal)}>加入這一天</button>
          </div>
        )}

        {mode === 'photo' && (
          <div className="card" style={{ marginTop: 16, textAlign: 'center', color: 'var(--ink-3)', padding: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>CAM</div>
            原型階段先保留拍照入口；正式版會串 AI 辨識食物。
          </div>
        )}
      </div>
    </div>
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
