import { useEffect, useMemo, useState } from 'react'
import { createSession, createExercise, createSet } from '../lib/db'
import { supabase } from '../lib/supabase'

export const EXERCISE_LIBRARY = {
  lower:  ['深蹲', '硬舉', '腿推', '腿彎舉', '腿伸展', '分腿蹲', '臀推', '小腿推', '單腿硬舉', '羅馬尼亞硬舉', '保加利亞分腿蹲'],
  upper:  ['臥推', '上斜臥推', '下斜臥推', '肩推', '引體向上', '滑輪下拉', '坐姿划船', '啞鈴划船', '二頭彎舉', '三頭下壓', '側平舉', '臉拉', '飛鳥', '繩索飛鳥'],
  core:   ['棒式', '捲腹', '懸掛抬腿', '俄羅斯轉體', '死蟲式', '側棒式', '滾輪'],
  cardio: ['跑步機', '爬梯機', '飛輪', '划船機', '橢圓機'],
  other:  ['籃球', '羽球', '網球', '足球', '排球', '高爾夫', '滑雪', '拳擊', '游泳', '瑜珈', '登山', '健行', '戶外跑步', '走路', '騎車'],
}

export const CAT_META = {
  lower:  { label: '下肢', color: '#EF4444', inputType: 'strength' },
  upper:  { label: '上肢', color: '#F97316', inputType: 'strength' },
  core:   { label: '核心', color: '#F59E0B', inputType: 'core' },
  cardio: { label: '有氧', color: '#22C55E', inputType: 'cardio'   },
  other:  { label: '其他', color: '#7C3AED', inputType: 'sport'    },
}

export const estimateOneRepMax = (weight, reps) => {
  const w = parseFloat(weight)
  const r = parseInt(reps)
  if (!w || !r || r < 1) return null
  if (r === 1) return Math.round(w)
  return Math.round(w * (36 / (37 - Math.min(r, 36))))
}

export const getInputType = (exName) => {
  for (const [cat, names] of Object.entries(EXERCISE_LIBRARY))
    if (names.includes(exName)) return CAT_META[cat].inputType
  return 'strength'
}

export const getCategory = (exName) => {
  for (const [cat, names] of Object.entries(EXERCISE_LIBRARY))
    if (names.includes(exName)) return cat
  return 'upper'
}

export const getLastSets = (sessions, exName, inputType) => {
  for (const s of sessions) {
    const ex = s.session_exercises?.find(e => e.name === exName)
    if (ex?.exercise_sets?.length) {
      const sorted = [...ex.exercise_sets].sort((a, b) => a.order_index - b.order_index)
      if (inputType === 'strength')
        return sorted.map(s => ({ weight: s.weight?.toString() ?? '', reps: s.reps?.toString() ?? '' }))
      if (inputType === 'cardio')
        return sorted.map(s => ({
          duration_min: s.duration_seconds ? String(Math.round(s.duration_seconds / 60)) : '',
          speed: s.weight?.toString() ?? '',
        }))
      if (inputType === 'core')
        return sorted.map(s => ({
          duration_min: s.duration_seconds ? String(Math.round(s.duration_seconds / 60)) : '',
          load: s.weight?.toString() ?? '',
        }))
      return sorted.map(s => ({ duration_min: s.duration_seconds ? String(Math.round(s.duration_seconds / 60)) : '' }))
    }
  }
  return null
}

const defaultSet = (inputType) => {
  if (inputType === 'cardio') return { duration_min: '', speed: '' }
  if (inputType === 'core') return { duration_min: '', load: '' }
  if (inputType === 'sport')  return { duration_min: '' }
  return { weight: '', reps: '' }
}

// ── Sheet 1: Exercise Picker ───────────────────────────────────────────────────
export function ExercisePickerSheet({ sessions, onDone, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [catFilter, setCatFilter] = useState('lower')
  const [selected, setSelected] = useState([])

  const toggle = (exName) => {
    const inputType = CAT_META[catFilter].inputType
    const category  = catFilter
    if (selected.find(e => e.name === exName)) {
      setSelected(prev => prev.filter(e => e.name !== exName))
    } else {
      setSelected(prev => [...prev, { name: exName, inputType, category }])
    }
  }

  const removeSelected = (exName) => setSelected(prev => prev.filter(e => e.name !== exName))

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="display" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-1)' }}>選擇訓練動作</div>
        <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 22, padding: 4 }}>✕</button>
      </div>

      <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ marginBottom: 16, fontSize: 14 }} />

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {Object.entries(CAT_META).map(([cat, m]) => (
          <button key={cat} onClick={() => setCatFilter(cat)} style={{
            padding: '8px 18px', borderRadius: 99, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            background: catFilter === cat ? m.color : 'var(--bg-sunk)',
            color: catFilter === cat ? '#fff' : 'var(--ink-3)',
          }}>{m.label}</button>
        ))}
      </div>

      {/* Exercise list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
        {EXERCISE_LIBRARY[catFilter].map(ex => {
          const isSelected = !!selected.find(e => e.name === ex)
          const color = CAT_META[catFilter].color
          return (
            <button key={ex} onClick={() => toggle(ex)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 16px', borderRadius: 14, textAlign: 'left',
              background: isSelected ? color + '18' : 'var(--bg-sunk)',
              border: `2px solid ${isSelected ? color : 'transparent'}`,
              color: isSelected ? color : 'var(--ink-2)',
              fontWeight: isSelected ? 700 : 500, fontSize: 15,
            }}>
              {ex}
              {isSelected && <span style={{ fontSize: 16 }}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {selected.map(e => (
            <div key={e.name} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, padding: '5px 6px 5px 12px', borderRadius: 99, fontWeight: 700,
              background: CAT_META[e.category].color + '22',
              color: CAT_META[e.category].color,
            }}>
              {e.name}
              <button onClick={() => removeSelected(e.name)} style={{
                width: 20, height: 20, borderRadius: 99,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: CAT_META[e.category].color + '33',
                color: CAT_META[e.category].color, fontSize: 13, fontWeight: 900,
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button className="btn-primary" style={{ marginTop: 16 }}
        disabled={selected.length === 0}
        onClick={() => onDone(selected, date)}>
        開始記錄 ({selected.length} 項) →
      </button>
    </Sheet>
  )
}

// ── Sheet 2: Sets Filler ───────────────────────────────────────────────────────
export function SetsFillerSheet({ selected, date, sessions, prototypeOnly = false, onClose, onSaved }) {
  const [sets, setSets] = useState(() => {
    const init = {}
    selected.forEach(({ name, inputType }) => {
      const last = getLastSets(sessions, name, inputType)
      init[name] = last || [defaultSet(inputType)]
    })
    return init
  })
  const [notes, setNotes] = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [painMarks, setPainMarks] = useState({})
  const [restSeconds, setRestSeconds] = useState(0)
  const [lastPr, setLastPr] = useState(null)

  useEffect(() => {
    if (!restSeconds) return undefined
    const id = window.setInterval(() => setRestSeconds(s => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [restSeconds])

  const triggerRest = (exName, oneRm) => {
    setRestSeconds(90)
    if (oneRm && oneRm >= 90) setLastPr({ exercise: exName, oneRm })
  }

  const addSet = (exName, inputType) => {
    const prevSets = sets[exName] || []
    const last = prevSets[prevSets.length - 1]
    triggerRest(exName, inputType === 'strength' ? estimateOneRepMax(last?.weight, last?.reps) : null)
    setSets(prev => ({ ...prev, [exName]: [...(prev[exName] || []), defaultSet(inputType)] }))
  }

  const updateSet = (exName, idx, field, val) =>
    setSets(prev => {
      const arr = [...(prev[exName] || [])]
      arr[idx] = { ...arr[idx], [field]: val }
      return { ...prev, [exName]: arr }
    })

  const removeSet = (exName, idx) =>
    setSets(prev => {
      const arr = [...(prev[exName] || [])]
      if (arr.length === 1) return prev
      arr.splice(idx, 1)
      return { ...prev, [exName]: arr }
    })

  const buildName = () => {
    const names = selected.map(e => e.name)
    if (names.length <= 2) return names.join(' + ')
    return names.slice(0, 2).join(' + ') + ` 等 ${names.length} 項`
  }

  const save = async () => {
    setSaving(true)
    try {
      if (prototypeOnly) {
        const created = buildPrototypeSessionPayload()
        window.setTimeout(() => onSaved(created), 350)
        return
      }

      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('請重新登入後再試')

      const { data: sess, error: e1 } = await createSession({ user_id: user.id, date, name: buildName() })
      if (e1) throw new Error(`建立訓練失敗: ${e1.message || JSON.stringify(e1)}`)

      for (let i = 0; i < selected.length; i++) {
        const { name: exName, inputType, category } = selected[i]
        const { data: ex, error: e2 } = await createExercise({
          session_id: sess.id, name: exName, category, order_index: i,
          note: notes[exName] || null,
        })
        if (e2) throw new Error(`新增動作失敗: ${e2.message}`)

        for (let j = 0; j < (sets[exName] || []).length; j++) {
          const s = sets[exName][j]
          const payload = { exercise_id: ex.id, order_index: j }
          if (inputType === 'strength') {
            payload.weight = parseFloat(s.weight) || null
            payload.reps   = parseInt(s.reps)    || null
          } else if (inputType === 'cardio') {
            payload.duration_seconds = s.duration_min ? Math.round(parseFloat(s.duration_min) * 60) : null
            payload.weight = parseFloat(s.speed) || null
            payload.unit   = 'kmh'
          } else if (inputType === 'core') {
            payload.duration_seconds = s.duration_min ? Math.round(parseFloat(s.duration_min) * 60) : null
            payload.weight = parseFloat(s.load) || null
            payload.unit = s.load ? 'kg' : 'bodyweight'
          } else {
            payload.duration_seconds = s.duration_min ? Math.round(parseFloat(s.duration_min) * 60) : null
          }
          const { error: e3 } = await createSet(payload)
          if (e3) throw new Error(`新增組數失敗: ${e3.message}`)
        }
      }
      onSaved()
    } catch (e) {
      console.error('Save error:', e)
      alert('儲存失敗：' + e.message)
      setSaving(false)
    }
  }

  const cur = selected[currentIdx]
  const hasLast = getLastSets(sessions, cur?.name, cur?.inputType)
  const curSets = sets[cur?.name] || []
  const bestOneRm = useMemo(() => {
    if (cur?.inputType !== 'strength') return null
    return curSets.reduce((best, s) => Math.max(best, estimateOneRepMax(s.weight, s.reps) || 0), 0)
  }, [cur?.inputType, curSets])
  const painOn = !!painMarks[cur?.name]
  const buildPrototypeSessionPayload = () => ({
    id: `proto-${Date.now()}`,
    date,
    name: buildName(),
    session_exercises: selected.map((item, i) => ({
      id: `proto-ex-${Date.now()}-${i}`,
      name: item.name,
      category: item.category,
      note: notes[item.name] || '',
      exercise_sets: (sets[item.name] || []).map((s, j) => ({
        id: `proto-set-${Date.now()}-${i}-${j}`,
        order_index: j,
        weight: parseFloat(s.weight || s.speed || s.load) || null,
        reps: parseInt(s.reps) || null,
        duration_seconds: s.duration_min ? Math.round(parseFloat(s.duration_min) * 60) : null,
        unit: item.inputType === 'cardio' ? 'kmh' : item.inputType === 'core' && !s.load ? 'bodyweight' : 'kg',
      })),
    })),
  })

  return (
    <Sheet onClose={onClose}>
      {restSeconds > 0 && (
        <div className="rest-timer">
          <div className="timer-ring" style={{ '--timer-progress': `${(restSeconds / 90) * 100}%` }}>
            {restSeconds}s
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, color: 'var(--ink-1)' }}>組間休息中</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>建議維持 90 秒，讓下一組品質更穩。</div>
          </div>
          <button onClick={() => setRestSeconds(0)} style={{ color: 'var(--blue)', fontWeight: 900, fontSize: 13 }}>跳過</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 22 }}>←</button>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>{currentIdx + 1} / {selected.length}</div>
          <div className="display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-1)' }}>{cur?.name}</div>
        </div>
        <button
          aria-label="標記不適"
          onClick={() => setPainMarks(prev => ({ ...prev, [cur.name]: !prev[cur.name] }))}
          style={{
            width: 34, height: 34, borderRadius: 12,
            background: painOn ? '#FEE2E2' : 'var(--bg-sunk)',
            color: painOn ? '#DC2626' : 'var(--ink-4)',
            fontWeight: 900,
          }}>
          !
        </button>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
          background: CAT_META[cur?.category]?.color + '22',
          color: CAT_META[cur?.category]?.color,
        }}>{CAT_META[cur?.category]?.label}</span>
      </div>

      {(painOn || lastPr || bestOneRm) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {bestOneRm ? <span className="pill" style={{ color: 'var(--blue)', background: 'var(--blue-soft)' }}>best est. 1RM {bestOneRm}kg</span> : null}
          {painOn ? <span className="pill" style={{ color: '#DC2626', background: '#FEE2E2' }}>今日不適</span> : null}
          {lastPr?.exercise === cur?.name ? <span className="pill pr-badge">PR est. {lastPr.oneRm}kg</span> : null}
        </div>
      )}

      {painOn && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 14, background: '#FFF7ED', color: '#9A3412', fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>
          原型提示：如果肩膀或關節不舒服，AI 教練會建議改成機械式或滑輪動作，並降低強度。
        </div>
      )}

      {hasLast && (
        <div style={{ fontSize: 12, color: '#FF7A1E', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          📋 已自動帶入上次記錄
        </div>
      )}

      {cur?.inputType === 'strength' && (
        <>
          <div style={{ display: 'flex', gap: 8, paddingLeft: 36, marginBottom: 8 }}>
            <div style={colLabel}>重量 (kg)</div>
            <div style={colLabel}>次數</div>
            <div style={{ width: 28 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(sets[cur.name] || []).map((s, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Num n={idx + 1} color="var(--orange)" />
                  <input className="inp" style={{ flex: 1, textAlign: 'center' }} type="number" inputMode="decimal" placeholder="0" value={s.weight}
                    onChange={e => updateSet(cur.name, idx, 'weight', e.target.value)} />
                  <input className="inp" style={{ flex: 1, textAlign: 'center' }} type="number" inputMode="numeric" placeholder="0" value={s.reps}
                    onChange={e => updateSet(cur.name, idx, 'reps', e.target.value)} />
                  <button style={{ width: 28, color: '#EF4444', fontSize: 20, flexShrink: 0 }} onClick={() => removeSet(cur.name, idx)}>×</button>
                </div>
                <div style={{ marginLeft: 36, marginTop: 5, fontSize: 11, color: 'var(--ink-4)', fontWeight: 800 }}>
                  {estimateOneRepMax(s.weight, s.reps) ? `est. 1RM: ${estimateOneRepMax(s.weight, s.reps)}kg` : '輸入重量與次數後即時估算 1RM'}
                </div>
              </div>
            ))}
          </div>
          <button style={addBtn('var(--orange)')} onClick={() => addSet(cur.name, 'strength')}>+ 儲存本組並新增一組</button>
        </>
      )}

      {cur?.inputType === 'cardio' && (
        <>
          <div style={{ display: 'flex', gap: 8, paddingLeft: 36, marginBottom: 8 }}>
            <div style={colLabel}>時間 (分鐘)</div>
            <div style={colLabel}>速度 / 等級</div>
            <div style={{ width: 28 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(sets[cur.name] || []).map((s, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Num n={idx + 1} color="#22C55E" />
                <input className="inp" style={{ flex: 1, textAlign: 'center' }} type="number" inputMode="decimal" placeholder="30" value={s.duration_min}
                  onChange={e => updateSet(cur.name, idx, 'duration_min', e.target.value)} />
                <input className="inp" style={{ flex: 1, textAlign: 'center' }} type="number" inputMode="decimal" placeholder="8.0" value={s.speed}
                  onChange={e => updateSet(cur.name, idx, 'speed', e.target.value)} />
                <button style={{ width: 28, color: '#EF4444', fontSize: 20, flexShrink: 0 }} onClick={() => removeSet(cur.name, idx)}>×</button>
              </div>
            ))}
          </div>
          <button style={addBtn('#22C55E')} onClick={() => addSet(cur.name, 'cardio')}>+ 儲存本段並新增紀錄</button>
        </>
      )}

      {cur?.inputType === 'core' && (
        <>
          <div style={{ display: 'flex', gap: 8, paddingLeft: 36, marginBottom: 8 }}>
            <div style={colLabel}>時間 (分鐘)</div>
            <div style={colLabel}>負重</div>
            <div style={{ width: 28 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(sets[cur.name] || []).map((s, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Num n={idx + 1} color="#F59E0B" />
                  <input className="inp" style={{ flex: 1, textAlign: 'center' }} type="number" inputMode="decimal" placeholder="1.5" value={s.duration_min}
                    onChange={e => updateSet(cur.name, idx, 'duration_min', e.target.value)} />
                  <input className="inp" style={{ flex: 1, textAlign: 'center' }} type="number" inputMode="decimal" placeholder="自重" value={s.load}
                    onChange={e => updateSet(cur.name, idx, 'load', e.target.value)} />
                  <button style={{ width: 28, color: '#EF4444', fontSize: 20, flexShrink: 0 }} onClick={() => removeSet(cur.name, idx)}>×</button>
                </div>
                <div style={{ marginLeft: 36, marginTop: 5, fontSize: 11, color: 'var(--ink-4)', fontWeight: 800 }}>
                  留空負重會記為自重；核心訓練不估 1RM
                </div>
              </div>
            ))}
          </div>
          <button style={addBtn('var(--orange)')} onClick={() => addSet(cur.name, 'core')}>+ 儲存本段並新增一段</button>
        </>
      )}

      {cur?.inputType === 'sport' && (
        <>
          <div style={{ display: 'flex', gap: 8, paddingLeft: 36, marginBottom: 8 }}>
            <div style={{ ...colLabel, flex: 2 }}>時間 (分鐘)</div>
            <div style={{ width: 28 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(sets[cur.name] || []).map((s, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Num n={idx + 1} color="#7C3AED" />
                <input className="inp" style={{ flex: 2, textAlign: 'center' }} type="number" inputMode="decimal" placeholder="60" value={s.duration_min}
                  onChange={e => updateSet(cur.name, idx, 'duration_min', e.target.value)} />
                <button style={{ width: 28, color: '#EF4444', fontSize: 20, flexShrink: 0 }} onClick={() => removeSet(cur.name, idx)}>×</button>
              </div>
            ))}
          </div>
          <button style={addBtn('#7C3AED')} onClick={() => addSet(cur.name, 'sport')}>+ 儲存本段並新增紀錄</button>
        </>
      )}

      <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: 0.4 }}>📝 備註 / 下次目標</div>
        <textarea className="inp" placeholder="例：下次可以試試 80kg、握距再寬一點..."
          value={notes[cur?.name] || ''}
          onChange={e => setNotes(prev => ({ ...prev, [cur.name]: e.target.value }))}
          style={{ resize: 'none', height: 72, lineHeight: 1.5, fontSize: 14 }} />
      </div>

      <div style={{ marginTop: 16 }}>
        {currentIdx < selected.length - 1 ? (
          <button className="btn-primary" onClick={() => setCurrentIdx(i => i + 1)}>
            下一個：{selected[currentIdx + 1]?.name} →
          </button>
        ) : (
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? '儲存中...' : '完成儲存 ✓'}
          </button>
        )}
      </div>
    </Sheet>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function Sheet({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,20,16,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-app)', borderRadius: '24px 24px 0 0', padding: '16px 20px 48px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line-strong)', margin: '0 auto 20px' }} />
        {children}
      </div>
    </div>
  )
}

const Num = ({ n, color }) => (
  <div style={{ width: 28, height: 28, borderRadius: 99, background: color, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
)

const colLabel = { flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textAlign: 'center' }

const addBtn = (color) => ({
  color, fontWeight: 700, fontSize: 14, padding: '12px 0', width: '100%', textAlign: 'center',
})
