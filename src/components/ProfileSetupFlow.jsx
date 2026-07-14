import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calculateNutritionTargets, emptyProfileGoals, profilePayload, profileToGoals } from '../lib/profile'
import { upsertProfile } from '../lib/db'

const TARGETS = [
  { id: '增肌', copy: '增加肌肉與力量' },
  { id: '減脂', copy: '穩定降低體脂' },
  { id: '維持體重', copy: '維持目前狀態' },
  { id: '提升運動表現', copy: '支援訓練與恢復' },
]

export default function ProfileSetupFlow({ session, initialProfile, onComplete }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initialProfile?.display_name || '')
  const [goals, setGoals] = useState(() => initialProfile ? profileToGoals(initialProfile) : emptyProfileGoals)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const email = session.user.email || '你的 Email'

  const canContinue = useMemo(() => {
    if (step === 0) return name.trim().length >= 1
    if (step === 1) {
      const height = Number(goals.height)
      const weight = Number(goals.weight)
      return height >= 100 && height <= 250 && weight >= 30 && weight <= 300 && goals.targets.length > 0
    }
    return true
  }, [goals, name, step])

  const next = () => {
    if (!canContinue) return
    setError('')
    if (step === 1) setGoals(current => calculateNutritionTargets(current))
    setStep(current => Math.min(2, current + 1))
  }

  const toggleTarget = target => setGoals(current => ({
    ...current,
    targets: current.targets.includes(target)
      ? current.targets.filter(item => item !== target)
      : [...current.targets, target],
  }))

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    const calculated = calculateNutritionTargets(goals)
    const payload = profilePayload(session.user.id, name, calculated)
    const { data, error: saveError } = await upsertProfile(payload)
    if (saveError) {
      setError(`儲存失敗：${saveError.message}`)
      setSaving(false)
      return
    }
    await supabase.auth.updateUser({ data: { name: name.trim(), full_name: name.trim() } })
    window.localStorage.setItem(`fitness-goals:${session.user.id}`, JSON.stringify(calculated))
    window.dispatchEvent(new CustomEvent('fitness-goals-updated', { detail: { ...calculated, name: name.trim() } }))
    onComplete(data)
  }

  return (
    <main className="profile-setup-shell">
      <div className="setup-ambient setup-ambient-one" />
      <div className="setup-ambient setup-ambient-two" />
      <section className="profile-setup-card">
        <header className="setup-header">
          <img src={`${import.meta.env.BASE_URL}fitness-logo.png`} alt="訓練日記" />
          <div className="setup-progress" aria-label={`設定進度 ${step + 1} / 3`}>
            {[0, 1, 2].map(index => <i key={index} className={index <= step ? 'active' : ''} />)}
          </div>
          <span>{step + 1} / 3</span>
        </header>

        <div className="setup-stage" key={step}>
          {step === 0 && <>
            <p className="setup-kicker">帳號已綁定</p>
            <h1>先告訴我<br />怎麼稱呼你</h1>
            <p className="setup-lead">這個名字會跟著 <b>{email}</b>，每個帳號都有自己的個人資料。</p>
            <label className="setup-primary-field">
              <span>你的名字</span>
              <input autoFocus maxLength="30" autoComplete="name" placeholder="例如：小明" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === 'Enter' && next()} />
            </label>
          </>}

          {step === 1 && <>
            <p className="setup-kicker">嗨，{name.trim()}</p>
            <h1>建立你的<br />身體與訓練目標</h1>
            <p className="setup-lead">資料只會存進你的帳號，用來估算每日熱量與營養目標。</p>
            <div className="setup-number-grid">
              <label><span>身高</span><div><input autoFocus type="number" inputMode="decimal" min="100" max="250" placeholder="170" value={goals.height} onChange={event => setGoals({ ...goals, height: event.target.value })} /><b>cm</b></div></label>
              <label><span>目前體重</span><div><input type="number" inputMode="decimal" min="30" max="300" step="0.1" placeholder="65" value={goals.weight} onChange={event => setGoals({ ...goals, weight: event.target.value })} /><b>kg</b></div></label>
            </div>
            <div className="setup-subtitle">你目前的目標（可複選）</div>
            <div className="setup-targets">
              {TARGETS.map(target => <button key={target.id} className={goals.targets.includes(target.id) ? 'active' : ''} onClick={() => toggleTarget(target.id)}><span>{target.id}</span><small>{target.copy}</small><i>✓</i></button>)}
            </div>
            <label className="setup-days"><span>每週預計訓練</span><select value={goals.trainingDays} onChange={event => setGoals({ ...goals, trainingDays: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(day => <option key={day} value={day}>{day} 天</option>)}</select></label>
          </>}

          {step === 2 && <>
            <p className="setup-kicker">專屬建議已完成</p>
            <h1>{name.trim()}，這是你的<br />每日起點</h1>
            <p className="setup-lead">依 {goals.height}cm、{goals.weight}kg、每週 {goals.trainingDays} 天與你的目標估算，之後可在首頁右上角隨時修改。</p>
            <div className="setup-calorie-hero"><span>建議每日熱量</span><strong>{goals.calories}</strong><b>kcal</b></div>
            <div className="setup-macros">
              <div><span>蛋白質</span><strong>{goals.protein}<small>g</small></strong></div>
              <div><span>碳水</span><strong>{goals.carbs}<small>g</small></strong></div>
              <div><span>脂肪</span><strong>{goals.fat}<small>g</small></strong></div>
            </div>
            <div className="setup-note">這是起始估算，不是醫療建議。你可以依實際體重與訓練表現再調整。</div>
          </>}
        </div>

        {error && <p className="setup-error">{error}</p>}
        <footer className="setup-actions">
          {step > 0 && <button className="setup-back" disabled={saving} onClick={() => setStep(current => current - 1)}>上一步</button>}
          <button className="setup-next" disabled={!canContinue || saving} onClick={step === 2 ? save : next}>{saving ? '正在建立你的空間…' : step === 2 ? '開始使用' : '繼續'}</button>
        </footer>
      </section>
    </main>
  )
}
