import { useEffect, useRef, useState } from 'react'
import { askCoachWithAI } from '../lib/ai'
import { getDailyNutrition, getFoodLogs, getProfile, getRecoveryLogs, getSessions, getWeightLogs } from '../lib/db'
import { demoSessions, macroSnapshot, mealCalendar, painLogs, weightLogs } from '../lib/prototypeData'

const quickPrompts = ['今天肩膀不舒服，怎麼練胸？', '最近力量有點掉，飲食要調嗎？', '幫我排明天 45 分鐘訓練']

export default function CoachScreen({ session }) {
  const prototypeOnly = !!session?.prototype
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([
    { role: 'coach', text: '我看了你的訓練、飲食和恢復狀態。今天可以保留訓練節奏，但肩部推舉先降壓力。' },
  ])
  const [composerKey, setComposerKey] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [contextData, setContextData] = useState(() => buildCoachContext())
  const messageEndRef = useRef(null)

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

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const context = contextData || buildCoachContext()

  const ask = async (prompt = text) => {
    const clean = prompt.trim()
    if (!clean || thinking) return
    setMessages(prev => [...prev, { role: 'user', text: clean }])
    setText('')
    setComposerKey(prev => prev + 1)
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
    <div className="coach-screen screen-fade">
      <header className="coach-header">
        <div className="display">AI 教練</div>
        <span>會參考你的訓練、飲食、恢復與體重資料</span>
      </header>

      <div className="coach-conversation">
        {messages.map((m, idx) => (
          <div key={idx} className={`coach-message ${m.role}`}>
            {m.role === 'coach' ? <FormattedCoachReply text={m.text} /> : m.text}
          </div>
        ))}
        {thinking && (
          <div className="coach-message coach thinking">
            AI 正在整理你的資料...
          </div>
        )}
        <div ref={messageEndRef} />

        {messages.length === 1 && (
          <div className="coach-quick-prompts">
            {quickPrompts.map(prompt => (
              <button key={prompt} onClick={() => ask(prompt)} className="coach-quick-prompt">
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="coach-composer">
        <textarea key={composerKey} rows="1" placeholder="直接問 AI：訓練、飲食、恢復..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            ask()
          }
        }} />
        <button disabled={thinking || !text.trim()} onClick={() => ask()}>{thinking ? '…' : '送出'}</button>
      </div>
    </div>
  )
}

function formatCoachReply(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*\*\s+/gm, '• ')
    .replace(/[ \t]+([1-9][.、）)])/g, '\n$1')
    .replace(/[ \t]+([•●▪︎-])\s+/g, '\n$1 ')
    .replace(/([^\n])\s*(總結|提醒|注意|建議)[:：]/g, '$1\n\n$2：')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function FormattedCoachReply({ text }) {
  const blocks = formatCoachReply(text).split(/\n{2,}/)
  return blocks.map((block, blockIndex) => (
    <div className="coach-reply-block" key={`${blockIndex}-${block.slice(0, 12)}`}>
      {block.split('\n').filter(Boolean).map((line, lineIndex) => (
        <div className={/^(?:[1-9][.、）)]|[•●▪︎-])/.test(line.trim()) ? 'coach-reply-item' : ''} key={`${lineIndex}-${line.slice(0, 12)}`}>
          {line.trim()}
        </div>
      ))}
    </div>
  ))
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
    return `目前 AI API ${reason ? `暫時不可用（${reason}）` : '暫時不可用'}，先給你保守建議：\n\n1. 前 24–48 小時先減少跑跳與下肢負重。\n2. 冰敷 10–15 分鐘，一天 2–4 次，並把腳抬高休息。\n3. 若明顯腫脹、瘀青、無法承重或疼痛加劇，請看醫師或物理治療師。\n4. 疼痛下降後，再循序做腳踝畫圈、彈力帶外翻／內翻與單腳平衡。`
  }
  if (prompt.includes('肩')) return '1. 滑輪夾胸 3 組。\n2. 機械胸推 2 組，RPE 控制在 6–7。\n3. 痛感超過 5/10 就停止，不要硬推重量。'
  if (prompt.includes('飲食') || prompt.includes('力量')) return '1. 先不要再降低熱量。\n2. 訓練日前後增加 20–30g 碳水。\n3. 蛋白質維持每公斤體重 1.6–2g。'
  if (prompt.includes('明天')) return '1. 深蹲 3 組。\n2. 腿推 3 組。\n3. 腿彎舉 2 組。\n4. 棒式 3 段。\n\n組間休息約 90 秒，總時間控制在 45 分鐘。'
  return '我會先看你的目標、最近重量變化和飲食紀錄。以現在狀態來說，建議維持熱量，不急著減脂，把訓練品質和恢復拉穩。'
}
