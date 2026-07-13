import { useEffect, useMemo, useState } from 'react'
import { getProfile, getRecoveryLogs, getWeightLogs, upsertProfile, upsertWeightLog } from '../lib/db'
import { painLogs, weightLogs as seedWeightLogs } from '../lib/prototypeData'
import { supabase } from '../lib/supabase'

const initialGoals = {
  height: 166,
  weight: 60,
  targets: ['增肌', '維持體重', '提升運動表現'],
  trainingDays: 5,
  calories: 2200,
  protein: 110,
  carbs: 285,
  fat: 65,
}

const clampTrainingDays = (value) => Math.max(1, Math.min(7, Number(value) || 1))
const goalStorageKey = userId => `fitness-goals:${userId}`
const loadGoals = (userId) => {
  try {
    const saved = window.localStorage.getItem(goalStorageKey(userId))
    if (!saved) return initialGoals
    return { ...initialGoals, ...JSON.parse(saved) }
  } catch {
    return initialGoals
  }
}
const saveGoals = (goals, userId) => {
  const normalized = { ...goals, trainingDays: clampTrainingDays(goals.trainingDays) }
  window.localStorage.setItem(goalStorageKey(userId), JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent('fitness-goals-updated', { detail: normalized }))
  return normalized
}

export default function ProfileScreen({ session }) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '使用者'
  const [weeklyWeight, setWeeklyWeight] = useState('60.0')
  const [logs, setLogs] = useState(seedWeightLogs.map((l, i) => ({ ...l, weight: [60.8, 60.6, 60.4, 60.3, 60.2, 60.1, 60.0][i] })))
  const [recovery, setRecovery] = useState(painLogs)
  const [goals, setGoals] = useState(() => loadGoals(session.user.id))
  const [showGoals, setShowGoals] = useState(false)
  const [error, setError] = useState('')
  const targetText = goals.targets?.join('、') || '尚未選擇目標'

  useEffect(() => {
    if (session?.prototype || !session?.user?.id) return undefined
    let cancelled = false
    Promise.all([
      getProfile(session.user.id),
      getWeightLogs(session.user.id),
      getRecoveryLogs(session.user.id),
    ]).then(([profileResult, weightResult, recoveryResult]) => {
      if (cancelled) return
      if (profileResult.data) {
        const profile = profileResult.data
        setGoals(prev => ({
          ...prev,
          height: profile.height_cm ?? prev.height,
          weight: profile.weight_kg ?? prev.weight,
          targets: profile.targets?.length ? profile.targets : prev.targets,
          trainingDays: profile.training_days ?? prev.trainingDays,
          calories: profile.calories_target ?? prev.calories,
          protein: profile.protein_target ?? prev.protein,
          carbs: profile.carbs_target ?? prev.carbs,
          fat: profile.fat_target ?? prev.fat,
        }))
      }
      if (!weightResult.error && weightResult.data?.length) {
        setLogs(weightResult.data.map(log => ({
          date: new Date(`${log.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
          weight: Number(log.weight),
        })))
        setWeeklyWeight(String(weightResult.data.at(-1).weight))
      }
      if (!recoveryResult.error && recoveryResult.data?.length) setRecovery(recoveryResult.data)
      if (profileResult.error && profileResult.error.code !== 'PGRST116') setError(`讀取個人資料失敗：${profileResult.error.message}`)
    })
    return () => { cancelled = true }
  }, [session?.user?.id, session?.prototype])

  const trend = useMemo(() => Number(((logs.at(-1)?.weight || 0) - (logs[0]?.weight || 0)).toFixed(1)), [logs])
  const addWeight = async () => {
    const next = parseFloat(weeklyWeight)
    if (!next) return
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const label = now.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
    setLogs(prev => [...prev.slice(-6), { date: label, weight: next }])
    if (!session?.prototype) {
      const { error: saveError } = await upsertWeightLog({ user_id: session.user.id, date, weight: next })
      if (saveError) setError(`儲存體重失敗：${saveError.message}`)
    }
  }

  const handleSaveGoals = async (next) => {
    const normalized = { ...next, trainingDays: clampTrainingDays(next.trainingDays) }
    setError('')
    if (!session?.prototype) {
      const { error: saveError } = await upsertProfile({
        id: session.user.id,
        display_name: name,
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
    }
    saveGoals(normalized, session.user.id)
    setGoals(normalized)
    setShowGoals(false)
  }

  return (
    <div className="screen-fade">
      <div style={{ padding: '8px 4px 4px' }}>
        <div className="display" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink-1)' }}>我</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>目標、恢復與個人資料</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <input className="inp" type="number" inputMode="decimal" value={weeklyWeight} onChange={e => setWeeklyWeight(e.target.value)} />
          <button className="btn-primary" style={{ width: 'auto', padding: '0 18px' }} onClick={addWeight}>記錄本週</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
          <div>
            <div className="display" style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink-1)' }}>{logs.at(-1)?.weight}kg</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 2 }}>最近 7 週 {trend > 0 ? '+' : ''}{trend}kg</div>
          </div>
          <span className="pill" style={{ color: '#B45309', background: '#FEF3C7' }}>維持區間</span>
        </div>
        <WeightChart logs={logs} />
      </div>

      <div className="section-title">恢復狀態</div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recovery.map(log => (
          <div key={log.id || log.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: '#FEE2E2', color: '#DC2626', display: 'grid', placeItems: 'center', fontWeight: 900 }}>!</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>{log.bodyPart || log.body_part} 不適</div>
              <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>{log.note}</div>
            </div>
            <span className="pill" style={{ color: '#DC2626', background: '#FEE2E2' }}>{log.intensity}/10</span>
          </div>
        ))}
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

      {showGoals && <GoalSheet goals={goals} onClose={() => setShowGoals(false)} onSave={handleSaveGoals} />}
    </div>
  )
}

function GoalSheet({ goals, onClose, onSave }) {
  const [draft, setDraft] = useState(goals)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const recalc = () => {
    const weight = Number(draft.weight) || 60
    const targetSet = new Set(draft.targets || [])
    const performanceBoost = targetSet.has('提升運動表現') ? 180 : 0
    const deficit = targetSet.has('減脂') ? -220 : 0
    const surplus = targetSet.has('增肌') ? 160 : 0
    const calories = Math.round(weight * 33 + performanceBoost)
    const adjustedCalories = calories + deficit + surplus
    setDraft({
      ...draft,
      calories: adjustedCalories,
      protein: Math.round(weight * 1.8),
      carbs: Math.round((adjustedCalories * 0.52) / 4),
      fat: Math.round((adjustedCalories * 0.26) / 9),
    })
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
      await onSave(draft)
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
  const values = logs.map(l => l.weight)
  const min = Math.min(...values) - 0.4
  const max = Math.max(...values) + 0.4
  const pointList = logs.map((log, i) => {
    const x = 12 + i * (176 / Math.max(1, logs.length - 1))
    const y = 88 - ((log.weight - min) / (max - min)) * 56
    return { x, y, weight: log.weight, date: log.date }
  })
  const points = pointList.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox="0 0 200 118" style={{ width: '100%', marginTop: 12 }}>
      <path d="M12 92H188" stroke="#FED7AA" />
      <path d="M12 60H188" stroke="#FED7AA" />
      <polyline points={points} fill="none" stroke="url(#weightGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="weightGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#FF7A1E" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>
      </defs>
      {pointList.map((point, i) => {
        const labelY = Math.max(12, point.y - 10)
        return (
          <g key={`${point.date}-${i}`}>
            <text x={point.x} y={labelY} textAnchor="middle" fontSize="7.5" fill="#4E3424" fontWeight="900">{point.weight.toFixed(1)}</text>
            <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#FF7A1E" strokeWidth="3" />
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
