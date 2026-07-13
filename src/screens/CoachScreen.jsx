import { useEffect, useState } from 'react'
import { askCoachWithAI } from '../lib/ai'
import { getDailyNutrition, getFoodLogs, getProfile, getRecoveryLogs, getSessions, getWeightLogs } from '../lib/db'
import { aiSuggestions, demoSessions, macroSnapshot, mealCalendar, painLogs, weightLogs } from '../lib/prototypeData'

const quickPrompts = ['今天肩膀不舒服，怎麼練胸？', '最近力量有點掉，飲食要調嗎？', '幫我排明天 45 分鐘訓練']

export default function CoachScreen({ session }) {
  const prototypeOnly = !!session?.prototype
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([
    { role: 'coach', text: '我看了你的訓練、飲食和恢復狀態。今天可以保留訓練節奏，但肩部推舉先降壓力。' },
  ])
  const [thinking, setThinking] = useState(false)
  const [contextData, setContextData] = useState(() => buildCoachContext())

  useEffect(() => {
    if (prototypeOnly || !session?.user?.id) return undefined
    const today = new Date().toISOString().split('T')[0]
    let cancelled = false
    Promise.all([
      getSessions(session.user.id),
      getDailyNutrition(session.user.id, today, today),
      getFoodLogs(session.user.id, today),
      getWeightLogs(session.user.id),
      getRecoveryLogs(session.user.id),
      getProfile(session.user.id),
    ]).then(([sessionsResult, nutritionResult, mealsResult, weightsResult, recoveryResult, profileResult]) => {
      if (cancelled) return
      setContextData(buildBackendCoachContext({
        sessions: sessionsResult.data || [],
        nutrition: nutritionResult.data?.[0],
        meals: mealsResult.data || [],
        weights: weightsResult.data || [],
        recovery: recoveryResult.data || [],
        profile: profileResult.data || {},
      }))
    })
    return () => { cancelled = true }
  }, [prototypeOnly, session?.user?.id])

  const context = contextData || buildCoachContext()

  const ask = async (prompt = text) => {
    const clean = prompt.trim()
    if (!clean || thinking) return
    setMessages(prev => [...prev, { role: 'user', text: clean }])
    setText('')
    setThinking(true)
    try {
      const reply = await askCoachWithAI({ prompt: clean, context })
      setMessages(prev => [...prev, { role: 'coach', text: reply }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'coach', text: buildReply(clean, error.message) }])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="screen-fade" style={{ paddingBottom: 116 }}>
      <div style={{ padding: '8px 4px 4px' }}>
        <div className="display" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink-1)' }}>AI 教練</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>會參考訓練、飲食、恢復與體重資料回答</div>
      </div>

      <div className="card" style={{ marginTop: 14, background: 'linear-gradient(135deg, #FF7A1E, #F43F5E)', color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.84 }}>今日判讀</div>
        <div className="display" style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>肩膀保守，碳水靠近訓練</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.88, marginTop: 8 }}>
          左肩 4/10，今天推的動作先保守；蛋白質接近達標，訓練後補一點碳水。
        </div>
      </div>

      <div className="section-title">教練建議</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {aiSuggestions.map(item => (
          <div key={item.title} className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{item.title}</div>
              <span className="pill" style={{ color: 'var(--orange-d)', background: 'var(--blue-soft)' }}>AI</span>
            </div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>{item.body}</div>
          </div>
        ))}
      </div>

      <div className="section-title">{prototypeOnly ? '讀取中的模擬資料' : '讀取中的雲端資料'}</div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ContextChip label="不適標記" value={context.painLogs[0] ? `${context.painLogs[0].bodyPart || context.painLogs[0].body_part} ${context.painLogs[0].intensity}/10` : '目前沒有'} tone="red" />
        <ContextChip label="蛋白質" value={`${context.macroSnapshot.protein.value}/${context.macroSnapshot.protein.target}g`} tone="orange" />
        <ContextChip label="體重趨勢" value={context.weightTrend.start ? `${context.weightTrend.start.weight} -> ${context.weightTrend.latest.weight}kg` : '尚無紀錄'} tone="green" />
        <ContextChip label="訓練策略" value={context.painLogs.length ? '依不適調整' : '維持漸進'} tone="amber" />
      </div>

      <div className="section-title">對話</div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, minHeight: 210 }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '88%',
            padding: '11px 13px',
            borderRadius: m.role === 'user' ? '16px 16px 5px 16px' : '16px 16px 16px 5px',
            background: m.role === 'user' ? 'linear-gradient(135deg, #FF7A1E, #F43F5E)' : 'var(--bg-sunk)',
            color: m.role === 'user' ? '#fff' : 'var(--ink-2)',
            fontSize: 13,
            lineHeight: 1.45,
            fontWeight: 750,
          }}>
            {m.text}
          </div>
        ))}
        {thinking && (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '88%',
            padding: '11px 13px',
            borderRadius: '16px 16px 16px 5px',
            background: 'var(--bg-sunk)',
            color: 'var(--ink-3)',
            fontSize: 13,
            lineHeight: 1.45,
            fontWeight: 750,
          }}>
            AI 正在整理你的資料...
          </div>
        )}
      </div>

      <div className="coach-quick-prompts">
        {quickPrompts.map(prompt => (
          <button key={prompt} onClick={() => ask(prompt)} className="pill coach-quick-prompt">
            {prompt}
          </button>
        ))}
      </div>

      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(var(--tab-h) + var(--safe-bottom) + 8px)',
        zIndex: 120,
        padding: '0 16px',
        maxWidth: 520,
        margin: '0 auto',
      }}>
        <div className="card" style={{ padding: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderRadius: 18 }}>
          <input className="inp" placeholder="直接問 AI：訓練、飲食、恢復..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} />
          <button className="btn-primary" style={{ width: 52, padding: 0 }} disabled={thinking} onClick={() => ask()}>{thinking ? '...' : '送出'}</button>
        </div>
      </div>
    </div>
  )
}

function buildCoachContext() {
  return {
    macroSnapshot,
    painLogs,
    weightTrend: {
      start: weightLogs[0],
      latest: weightLogs.at(-1),
    },
    recentTraining: demoSessions.map(s => ({
      date: s.date,
      name: s.name,
      exercises: s.session_exercises.map(ex => ({ name: ex.name, note: ex.note, sets: ex.exercise_sets.length })),
    })),
    todayMeals: mealCalendar[21],
  }
}

function buildBackendCoachContext({ sessions, nutrition, meals, weights, recovery, profile }) {
  const value = (key) => Number(nutrition?.[key]) || 0
  const target = (key, fallback) => Number(profile?.[key]) || fallback
  return {
    macroSnapshot: {
      calories: { value: value('calories'), target: target('calories_target', 2200) },
      protein: { value: value('protein'), target: target('protein_target', 110) },
      carbs: { value: value('carbs'), target: target('carbs_target', 285) },
      fat: { value: value('fat'), target: target('fat_target', 65) },
    },
    painLogs: recovery,
    weightTrend: { start: weights[0] || null, latest: weights.at(-1) || null },
    recentTraining: sessions.slice(0, 6).map(s => ({
      date: s.date,
      name: s.name,
      exercises: (s.session_exercises || []).map(ex => ({
        name: ex.name,
        note: ex.note,
        sets: ex.exercise_sets?.length || 0,
      })),
    })),
    todayMeals: meals.map(meal => ({
      meal: meal.meal,
      name: meal.name,
      kcal: meal.kcal,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    })),
  }
}

function buildReply(prompt, reason = '') {
  if (prompt.includes('腳') || prompt.includes('翻船') || prompt.includes('扭')) {
    return `目前 AI API ${reason ? `暫時不可用（${reason}）` : '暫時不可用'}，先給你保守建議：如果右腳踝剛翻船，前 24-48 小時先減少跑跳與下肢負重，冰敷 10-15 分鐘、一天 2-4 次，抬高休息。若明顯腫脹、瘀青、無法承重或疼痛加劇，請看醫師或物理治療師。疼痛下降後再做腳踝畫圈、彈力帶外翻/內翻、單腳平衡，循序回到訓練。`
  }
  if (prompt.includes('肩')) return '今天胸部訓練建議用滑輪夾胸 3 組、機械胸推 2 組，RPE 控制在 6-7。只要痛感超過 5/10 就停止，別硬推重量。'
  if (prompt.includes('飲食') || prompt.includes('力量')) return '力量掉一點但體重也在下降，先不要再減熱量。訓練日前後加 20-30g 碳水，蛋白質維持每公斤 1.6-2g。'
  if (prompt.includes('明天')) return '明天做 45 分鐘下肢與核心：深蹲 3 組、腿推 3 組、腿彎舉 2 組、棒式 3 段。組間休息 90 秒。'
  return '我會先看你的目標、最近重量變化和飲食紀錄。以現在狀態來說，建議維持熱量，不急著減脂，把訓練品質和恢復拉穩。'
}

function ContextChip({ label, value, tone }) {
  const styles = {
    red: ['#FEE2E2', '#DC2626'],
    orange: ['#FFEDD5', '#EA580C'],
    green: ['#DCFCE7', '#15803D'],
    amber: ['#FEF3C7', '#B45309'],
  }
  const [bg, color] = styles[tone]
  return (
    <div style={{ background: bg, color, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  )
}
