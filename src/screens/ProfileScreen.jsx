import { useEffect, useMemo, useState } from 'react'
import { getProfile, getWeightLogs, updateProfile, upsertWeightLog } from '../lib/db'
import { supabase } from '../lib/supabase'
import { calculateNutritionTargets, emptyProfileGoals, profileToGoals } from '../lib/profile'

const clampTrainingDays = (value) => Math.max(1, Math.min(7, Number(value) || 1))
const localDate = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const getWeekStart = date => {
  const monday = new Date(date)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday
}
const canLogWeeklyWeight = (now, logs) => {
  const isMondayAfterSix = now.getDay() === 1 && now.getHours() >= 6
  const weekStart = localDate(getWeekStart(now))
  return isMondayAfterSix && !logs.some(log => log.date === weekStart)
}
const goalStorageKey = userId => `fitness-goals:${userId}`
const loadGoals = (userId) => {
  try {
    const saved = window.localStorage.getItem(goalStorageKey(userId))
    if (!saved) return emptyProfileGoals
    return { ...emptyProfileGoals, ...JSON.parse(saved) }
  } catch {
    return emptyProfileGoals
  }
}
const saveGoals = (goals, userId, name) => {
  const normalized = { ...goals, trainingDays: clampTrainingDays(goals.trainingDays) }
  window.localStorage.setItem(goalStorageKey(userId), JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent('fitness-goals-updated', { detail: { ...normalized, name } }))
  return normalized
}

export default function ProfileScreen({ session }) {
  const [name, setName] = useState(session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '')
  const [weeklyWeight, setWeeklyWeight] = useState('')
  const [logs, setLogs] = useState([])
  const [goals, setGoals] = useState(() => loadGoals(session.user.id))
  const [showGoals, setShowGoals] = useState(false)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const targetText = goals.targets?.join('、') || '尚未選擇目標'

  useEffect(() => {
    if (session?.prototype || !session?.user?.id) return undefined
    let cancelled = false
    Promise.all([
      getProfile(session.user.id),
      getWeightLogs(session.user.id),
    ]).then(([profileResult, weightResult]) => {
      if (cancelled) return
      if (profileResult.data) {
        const profile = profileResult.data
        setName(profile.display_name || '')
        setGoals(profileToGoals(profile))
        setWeeklyWeight(String(profile.weight_kg ?? ''))
      }
      if (!weightResult.error && weightResult.data?.length) {
        setLogs(weightResult.data.map(log => ({
          date: log.date,
          weight: Number(log.weight),
        })))
        setWeeklyWeight(String(weightResult.data.at(-1).weight))
      }
      if (profileResult.error && profileResult.error.code !== 'PGRST116') setError(`讀取個人資料失敗：${profileResult.error.message}`)
    })
    return () => { cancelled = true }
  }, [session?.user?.id, session?.prototype])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const trend = useMemo(() => Number(((logs.at(-1)?.weight || 0) - (logs[0]?.weight || 0)).toFixed(1)), [logs])
  const showWeeklyWeightForm = canLogWeeklyWeight(clock, logs)
  const addWeight = async () => {
    const next = parseFloat(weeklyWeight)
    if (!showWeeklyWeightForm) return
    if (!Number.isFinite(next) || next < 20 || next >= 500) {
      setError('請輸入 20 到 499.9 kg 之間的體重。')
      return
    }
    const now = new Date()
    const date = localDate(getWeekStart(now))
    if (!session?.prototype) {
      const { error: saveError } = await upsertWeightLog({ user_id: session.user.id, date, weight: next })
      if (saveError) {
        setError(`儲存體重失敗：${saveError.message}`)
        return
      }
    }
    setError('')
    setLogs(prev => [...prev.filter(log => log.date !== date), { date, weight: next }].sort((a, b) => a.date.localeCompare(b.date)))
  }

  const handleSaveGoals = async (next, nextName) => {
    const normalized = { ...next, trainingDays: clampTrainingDays(next.trainingDays) }
    const normalizedName = nextName.trim()
    setError('')
    saveGoals(normalized, session.user.id, normalizedName)
    setGoals(normalized)
    setName(normalizedName)
    setShowGoals(false)
    if (!session?.prototype) {
      const { error: saveError } = await updateProfile({
        id: session.user.id,
        display_name: normalizedName,
        height_cm: Number(normalized.height) || null,
        weight_kg: Number(normalized.weight) || null,
        targets: normalized.targets || [],
        training_days: clampTrainingDays(normalized.trainingDays),
        calories_target: Number(normalized.calories) || null,
        protein_target: Number(normalized.protein) || null,
        carbs_target: Number(normalized.carbs) || null,
        fat_target: Number(normalized.fat) || null,
      })
      if (saveError) {
        setError(`儲存目標失敗：${saveError.message}`)
        throw saveError
      }
      const { data: savedProfile, error: verifyError } = await getProfile(session.user.id)
      if (verifyError || !savedProfile) {
        const message = verifyError?.message || '雲端沒有回傳已儲存的目標'
        setError(`目標已保存在這台裝置，但雲端同步失敗：${message}`)
        throw new Error(message)
      }
      await supabase.auth.updateUser({ data: { name: normalizedName, full_name: normalizedName } })
    }
  }

  return (
    <div className="screen-fade">
      <div style={{ padding: '8px 4px 4px' }}>
        <div className="display" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink-1)' }}>我</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>目標與個人資料</div>
      </div>
      {error && <div className="card" style={{ color: '#DC2626', fontSize: 13, lineHeight: 1.5 }}>{error}</div>}

      <div className="card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 54, height: 54, borderRadius: 16,
          background: 'linear-gradient(135deg, #FF7A1E, #F43F5E)',
          display: 'grid', placeItems: 'center',
          color: '#fff', fontSize: 22, fontWeight: 900,
        }}>
          {name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink-1)' }}>{name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{`Email 雲端同步 · ${session?.user?.email || '已綁定'}`}</div>
        </div>
        <span className="pill" style={{ color: 'var(--orange-d)', background: '#FFEDD5' }}>PWA</span>
      </div>

      <div className="section-title">Email 帳號</div>
      <div className="card account-recovery-card">
        <strong>帳號已綁定，資料會自動同步</strong>
        <p>你的目標、訓練與飲食資料會依這個帳號分開儲存。換裝置時用同一個 Email 收取驗證碼即可。</p>
        <span>{session?.user?.email}</span>
        <button className="account-signout" onClick={() => supabase.auth.signOut()}>登出這個帳號</button>
      </div>

      <div className="section-title">每週體重</div>
      <div className="card">
        {showWeeklyWeightForm && <div className="weekly-weight-prompt">
          <div><strong>星期一體重紀錄</strong><span>填完後會加入趨勢圖，AI 教練也會一起參考。</span></div>
          <div className="weekly-weight-controls">
            <input className="inp" aria-label="本週體重" type="number" inputMode="decimal" min="20" max="499" step="0.1" value={weeklyWeight} onChange={e => setWeeklyWeight(e.target.value)} />
            <button className="btn-primary" onClick={addWeight}>記錄本週</button>
          </div>
        </div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
          <div>
            <div className="display" style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink-1)' }}>{logs.length ? `${logs.at(-1)?.weight}kg` : '尚無紀錄'}</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 2 }}>{logs.length > 1 ? `整段變化 ${trend > 0 ? '+' : ''}${trend}kg` : logs.length ? '下週一早上 6 點再記錄' : '每週一早上 6 點開放記錄'}</div>
          </div>
          <span className="pill" style={{ color: '#B45309', background: '#FEF3C7' }}>維持區間</span>
        </div>
        {!!logs.length && <WeightChart logs={logs} />}
      </div>

      <div className="section-title">目標設定</div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{goals.height}cm / {goals.weight}kg</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 3 }}>{targetText} · 每週 {goals.trainingDays} 天</div>
          </div>
          <button className="pill" onClick={() => setShowGoals(true)} style={{ color: '#fff', background: 'var(--orange)' }}>編輯</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
          <Goal label="熱量" value={goals.calories} unit="kcal" />
          <Goal label="蛋白質" value={goals.protein} unit="g" />
          <Goal label="碳水" value={goals.carbs} unit="g" />
          <Goal label="脂肪" value={goals.fat} unit="g" />
        </div>
        <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'var(--bg-sunk)', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5, fontWeight: 750 }}>
          AI 建議：你的目標偏維持體重並提升表現，不要把熱量壓太低。蛋白質約每公斤 1.6-2g，訓練日前後提高碳水會更有感。
        </div>
      </div>

      {showGoals && <GoalSheet name={name} goals={goals} onClose={() => setShowGoals(false)} onSave={handleSaveGoals} />}
    </div>
  )
}

function GoalSheet({ name, goals, onClose, onSave }) {
  const [draftName, setDraftName] = useState(name)
  const [draft, setDraft] = useState(goals)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const recalc = () => {
    setDraft(calculateNutritionTargets(draft))
  }
  const toggleTarget = (target) => {
    const current = new Set(draft.targets || [])
    if (current.has(target)) current.delete(target)
    else current.add(target)
    setDraft({ ...draft, targets: Array.from(current) })
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      if (!draftName.trim()) throw new Error('請先輸入名字')
      await onSave(draft, draftName)
    } catch (error) {
      setSaveError(error.message || '請稍後再試')
      setSaving(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet-panel">
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink-1)' }}>編輯目標</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 22 }}>×</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="名字">
            <input className="inp" maxLength="30" placeholder="你的名字" value={draftName} onChange={e => setDraftName(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          <Field label="身高" suffix="cm">
            <input className="inp" type="number" placeholder="例如 166" value={draft.height} onChange={e => setDraft({ ...draft, height: e.target.value })} />
          </Field>
          <Field label="目前體重" suffix="kg">
            <input className="inp" type="number" placeholder="例如 60" value={draft.weight} onChange={e => setDraft({ ...draft, weight: e.target.value })} />
          </Field>
        </div>

        <div className="field-label" style={{ marginTop: 14 }}>目標，可複選</div>
        <div className="goal-toggle-grid">
          {['增肌', '減脂', '維持體重', '提升運動表現'].map(target => (
            <button
              key={target}
              className={`goal-toggle ${draft.targets?.includes(target) ? 'active' : ''}`}
              onClick={() => toggleTarget(target)}
            >
              {target}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="每週訓練天數" suffix="天">
            <input
              className="inp"
              type="number"
              min="1"
              max="7"
              placeholder="最多 7"
              value={draft.trainingDays}
              onChange={e => {
                const value = e.target.value
                setDraft({ ...draft, trainingDays: value === '' ? '' : clampTrainingDays(value) })
              }}
              onBlur={() => setDraft({ ...draft, trainingDays: clampTrainingDays(draft.trainingDays) })}
            />
          </Field>
        </div>

        <div className="macro-recalc">
          <div>
            <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>AI 建議營養目標</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>依身高、體重、目標與訓練天數重新估算</div>
          </div>
          <button onClick={recalc}>重新計算</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
          <Field label="每日熱量" suffix="kcal">
            <input className="inp" type="number" placeholder="例如 2200" value={draft.calories} onChange={e => setDraft({ ...draft, calories: e.target.value })} />
          </Field>
          <Field label="蛋白質" suffix="g">
            <input className="inp" type="number" placeholder="例如 110" value={draft.protein} onChange={e => setDraft({ ...draft, protein: e.target.value })} />
          </Field>
          <Field label="碳水" suffix="g">
            <input className="inp" type="number" placeholder="例如 285" value={draft.carbs} onChange={e => setDraft({ ...draft, carbs: e.target.value })} />
          </Field>
          <Field label="脂肪" suffix="g">
            <input className="inp" type="number" placeholder="例如 65" value={draft.fat} onChange={e => setDraft({ ...draft, fat: e.target.value })} />
          </Field>
        </div>
        {saveError && <div className="goal-save-error">儲存失敗：{saveError}</div>}
        <button className="btn-primary" style={{ marginTop: 10 }} disabled={saving} onClick={save}>{saving ? '儲存中…' : '儲存目標'}</button>
      </div>
    </div>
  )
}

function Field({ label, suffix, children }) {
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

function WeightChart({ logs }) {
  const displayLogs = logs.slice(-7)
  const values = displayLogs.map(l => l.weight)
  const min = Math.min(...values) - 0.4
  const max = Math.max(...values) + 0.4
  const pointList = displayLogs.map((log, i) => {
    const x = 12 + i * (176 / Math.max(1, displayLogs.length - 1))
    const y = 88 - ((log.weight - min) / (max - min)) * 56
    return { x, y, weight: log.weight, date: new Date(`${log.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) }
  })
  const points = pointList.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg className="weight-chart animated-line-chart" viewBox="0 0 200 128">
      <path d="M12 92H188" stroke="#FED7AA" />
      <path d="M12 60H188" stroke="#FED7AA" />
      <polyline className="chart-draw-line" pathLength="1" points={points} fill="none" stroke="url(#weightGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="weightGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#FF7A1E" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>
      </defs>
      {pointList.map((point, i) => {
        const labelY = Math.max(12, point.y - 10)
        return (
          <g className="chart-point" style={{ '--point-delay': `${.45 + i * .08}s` }} key={`${point.date}-${i}`}>
            <text x={point.x} y={labelY} textAnchor="middle" fontSize="7.5" fill="#4E3424" fontWeight="900">{point.weight.toFixed(1)}</text>
            <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#FF7A1E" strokeWidth="3" />
            <text x={point.x} y="122" textAnchor="middle" fontSize="7" fill="#8E8E93" fontWeight="800">{point.date}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Goal({ label, value, unit }) {
  return (
    <div style={{ background: 'var(--bg-sunk)', borderRadius: 14, padding: 10 }}>
      <div style={{ color: 'var(--ink-3)', fontSize: 10, fontWeight: 900 }}>{label}</div>
      <div style={{ color: 'var(--ink-1)', fontSize: 18, fontWeight: 900, marginTop: 4 }}>{value}</div>
      <div style={{ color: 'var(--orange-d)', fontSize: 10, fontWeight: 900 }}>{unit}</div>
    </div>
  )
}
