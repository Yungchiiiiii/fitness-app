import { useState } from 'react'
import { exerciseCategories, exerciseProgress } from '../lib/prototypeData'

const defaultCategory = exerciseCategories[1]

export default function TrainingScreen() {
  const [selected, setSelected] = useState('深蹲')
  const [showPicker, setShowPicker] = useState(false)
  const [category, setCategory] = useState(defaultCategory.id)
  const history = exerciseProgress[selected]
  const isCardioOrCore = selected === '跑步' || selected === '平板支撐'

  return (
    <div className="screen-fade">
      <div style={{ padding: '8px 4px 4px' }}>
        <div className="display" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink-1)' }}>訓練進步</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>選一個動作，看重量與備註的變化</div>
      </div>

      <div className="exercise-query">
        <button className="exercise-query-main" onClick={() => setShowPicker(true)}>
          <span>
            <span className="exercise-query-label">查詢動作</span>
            <strong>{selected}</strong>
          </span>
          <span className="exercise-query-icon">⌄</span>
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>{selected} {isCardioOrCore ? '表現趨勢' : '重量趨勢'}</div>
            <div className="display" style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink-1)', marginTop: 6 }}>
              {history.at(-1).best}{isCardioOrCore ? (selected === '跑步' ? '分' : '秒') : 'kg'}
            </div>
          </div>
          {!isCardioOrCore && (
            <span className="pill" style={{ color: 'var(--orange-d)', background: 'var(--blue-soft)' }}>
              est. 1RM {history.at(-1).oneRm}kg
            </span>
          )}
        </div>
        <ProgressLine data={history} unit={isCardioOrCore ? (selected === '跑步' ? '分' : '秒') : 'kg'} />
      </div>

      <div className="section-title">每次紀錄</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.slice().reverse().map(entry => (
          <RecordCard key={entry.date} entry={entry} unit={isCardioOrCore ? (selected === '跑步' ? '分' : '秒') : 'kg'} />
        ))}
      </div>

      {showPicker && (
        <ExercisePicker
          category={category}
          selected={selected}
          onCategory={setCategory}
          onClose={() => setShowPicker(false)}
          onSelect={(name) => {
            setSelected(name)
            setShowPicker(false)
          }}
        />
      )}
    </div>
  )
}

function ProgressLine({ data, unit }) {
  const values = data.map(d => d.best)
  const min = Math.min(...values) - 4
  const max = Math.max(...values) + 4
  const pointList = data.map((d, i) => {
    const x = 14 + i * (172 / Math.max(1, data.length - 1))
    const y = 92 - ((d.best - min) / (max - min)) * 60
    return { x, y, value: d.best, date: d.date }
  })
  const points = pointList.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox="0 0 200 132" style={{ width: '100%', marginTop: 12 }}>
      <path d="M14 96H186" stroke="#FED7AA" />
      <path d="M14 64H186" stroke="#FED7AA" />
      <path d="M14 32H186" stroke="#FED7AA" />
      <polyline points={points} fill="none" stroke="url(#orangeLine)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="orangeLine" x1="0" x2="1">
          <stop offset="0%" stopColor="#FF7A1E" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>
      </defs>
      {pointList.map((point, i) => {
        const labelY = Math.max(11, point.y - 12)
        return (
          <g key={`${point.date}-${i}`}>
            <text x={point.x} y={labelY} textAnchor="middle" fontSize="8" fill="#4E3424" fontWeight="900">{point.value}{unit}</text>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#FF7A1E" strokeWidth="4" />
            <text x={point.x} y="124" textAnchor="middle" fontSize="9" fill="#84634C" fontWeight="800">{point.date}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ExercisePicker({ category, selected, onCategory, onClose, onSelect }) {
  const active = exerciseCategories.find(c => c.id === category) || defaultCategory

  return (
    <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet-panel">
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="display" style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink-1)' }}>選擇動作</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 3 }}>先選分類，再選要查看的動作</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 22 }}>×</button>
        </div>

        <div className="picker-category-grid">
          {exerciseCategories.map(item => (
            <button
              key={item.id}
              className={`picker-choice ${category === item.id ? 'active' : ''}`}
              onClick={() => onCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="picker-exercise-list">
          {active.exercises.map(name => (
            <button
              key={name}
              className={`picker-exercise ${selected === name ? 'active' : ''}`}
              onClick={() => onSelect(name)}
            >
              <span>{name}</span>
              <span>{selected === name ? '目前顯示' : '查看紀錄'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecordCard({ entry, unit }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding: 15 }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}>
        <div>
          <div style={{ color: 'var(--orange-d)', fontWeight: 900 }}>{entry.date}</div>
          <div style={{ color: 'var(--ink-1)', fontSize: 18, fontWeight: 900, marginTop: 5 }}>{entry.best}{unit}</div>
          {entry.oneRm ? <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 3 }}>est. 1RM {entry.oneRm}kg</div> : null}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="pill" style={{ color: '#fff', background: 'var(--orange)' }}>{open ? '收合' : '展開'}</span>
          <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 10 }}>{entry.sets}</div>
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'var(--bg-sunk)', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5, fontWeight: 700 }}>
          備註：{entry.note}
        </div>
      )}
    </div>
  )
}
