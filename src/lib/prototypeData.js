export const macroSnapshot = {
  calories: { value: 1820, target: 2450 },
  protein: { value: 148, target: 180 },
  carbs: { value: 186, target: 260 },
  fat: { value: 52, target: 70 },
}

export const demoSessions = [
  {
    id: 'demo-0521',
    date: '2026-05-21',
    name: '深蹲 + 臥推',
    session_exercises: [
      {
        id: 'demo-squat-0521',
        name: '深蹲',
        category: 'lower',
        note: '最後一組速度變慢，下次先維持 85kg。',
        exercise_sets: [
          { id: 's1', weight: 80, reps: 8, order_index: 0 },
          { id: 's2', weight: 85, reps: 6, order_index: 1 },
          { id: 's3', weight: 85, reps: 5, order_index: 2 },
        ],
      },
      {
        id: 'demo-bench-0521',
        name: '臥推',
        category: 'upper',
        note: '左肩微緊，握距縮一點比較舒服。',
        exercise_sets: [
          { id: 'b1', weight: 60, reps: 10, order_index: 0 },
          { id: 'b2', weight: 65, reps: 8, order_index: 1 },
        ],
      },
    ],
  },
  {
    id: 'demo-0520',
    date: '2026-05-20',
    name: '下肢力量',
    session_exercises: [
      {
        id: 'demo-squat-0520',
        name: '深蹲',
        category: 'lower',
        note: '動作穩，下一次可以加一組。',
        exercise_sets: [
          { id: 's4', weight: 77.5, reps: 8, order_index: 0 },
          { id: 's5', weight: 82.5, reps: 6, order_index: 1 },
        ],
      },
      {
        id: 'demo-deadlift-0520',
        name: '硬舉',
        category: 'lower',
        note: '髖發力可以再乾淨一點。',
        exercise_sets: [
          { id: 'd1', weight: 105, reps: 4, order_index: 0 },
        ],
      },
    ],
  },
]

export const exerciseProgress = {
  深蹲: [
    { date: '5/07', best: 78, oneRm: 99, sets: '75x8 / 78x6', note: '節奏穩，深度足夠。' },
    { date: '5/12', best: 80, oneRm: 101, sets: '77.5x8 / 80x6', note: '最後兩下有點前傾。' },
    { date: '5/16', best: 82.5, oneRm: 105, sets: '80x7 / 82.5x6', note: '腰背狀態好。' },
    { date: '5/20', best: 82.5, oneRm: 106, sets: '77.5x8 / 82.5x6', note: '可加一組容量。' },
    { date: '5/21', best: 85, oneRm: 103, sets: '80x8 / 85x6 / 85x5', note: '先維持 85kg，把速度做漂亮。' },
  ],
  臥推: [
    { date: '5/05', best: 62.5, oneRm: 78, sets: '60x8 / 62.5x7', note: '肩膀無痛。' },
    { date: '5/13', best: 65, oneRm: 82, sets: '62.5x8 / 65x7', note: '胸椎伸展好。' },
    { date: '5/21', best: 65, oneRm: 80, sets: '60x10 / 65x8', note: '左肩微緊，降一點量。' },
  ],
  硬舉: [
    { date: '5/06', best: 100, oneRm: 113, sets: '95x5 / 100x4', note: '抓地穩。' },
    { date: '5/20', best: 105, oneRm: 119, sets: '105x4', note: '髖發力再乾淨。' },
  ],
  划船: [
    { date: '5/04', best: 45, oneRm: 58, sets: '40x10 / 45x8', note: '肩胛收得穩，腰背保持中立。' },
    { date: '5/11', best: 47.5, oneRm: 61, sets: '45x9 / 47.5x8', note: '最後一組速度稍慢。' },
    { date: '5/19', best: 50, oneRm: 64, sets: '47.5x8 / 50x7', note: '先維持重量，把背部感受做滿。' },
  ],
  肩推: [
    { date: '5/03', best: 30, oneRm: 38, sets: '27.5x8 / 30x7', note: '左肩狀態可接受。' },
    { date: '5/10', best: 32.5, oneRm: 40, sets: '30x8 / 32.5x6', note: '核心要再收緊。' },
    { date: '5/17', best: 32.5, oneRm: 41, sets: '30x9 / 32.5x7', note: '不要急著加重，先穩住路徑。' },
  ],
  腿推: [
    { date: '5/08', best: 140, oneRm: 183, sets: '130x10 / 140x9', note: '膝蓋軌跡穩。' },
    { date: '5/15', best: 150, oneRm: 195, sets: '140x10 / 150x8', note: '下次可加一組中等重量。' },
    { date: '5/22', best: 155, oneRm: 202, sets: '145x10 / 155x8', note: '腿後側疲勞，收操拉伸。' },
  ],
  跑步: [
    { date: '5/06', best: 24, oneRm: 0, sets: '24 分鐘 / 3.8km', note: '以輕鬆配速完成。' },
    { date: '5/13', best: 27, oneRm: 0, sets: '27 分鐘 / 4.2km', note: '呼吸穩定，最後 5 分鐘加速。' },
    { date: '5/21', best: 30, oneRm: 0, sets: '30 分鐘 / 4.6km', note: '有氧耐受度提升。' },
  ],
  平板支撐: [
    { date: '5/05', best: 45, oneRm: 0, sets: '45秒 / 40秒 / 35秒', note: '骨盆位置保持得不錯。' },
    { date: '5/12', best: 55, oneRm: 0, sets: '55秒 / 45秒 / 40秒', note: '第二組開始抖動。' },
    { date: '5/19', best: 60, oneRm: 0, sets: '60秒 / 50秒 / 45秒', note: '核心控制穩定。' },
  ],
}

export const exerciseCategories = [
  { id: 'upper', label: '上肢', exercises: ['臥推', '划船', '肩推'] },
  { id: 'lower', label: '下肢', exercises: ['深蹲', '硬舉', '腿推'] },
  { id: 'cardio', label: '有氧', exercises: ['跑步'] },
  { id: 'core', label: '核心', exercises: ['平板支撐'] },
]

export const mealCalendar = {
  8: {
    calories: 2210, protein: 132, carbs: 255, fat: 66,
    advice: '蛋白質略低，晚餐可以補一份魚或豆腐。',
    meals: [
      { name: '早餐', food: '蛋餅、豆漿', protein: 28, kcal: 520 },
      { name: '午餐', food: '牛肉飯、青菜', protein: 48, kcal: 820 },
      { name: '晚餐', food: '鮭魚、地瓜、沙拉', protein: 56, kcal: 740 },
    ],
  },
  14: {
    calories: 2500, protein: 166, carbs: 292, fat: 70,
    advice: '訓練日碳水安排不錯，睡前避免再加高脂點心。',
    meals: [
      { name: '早餐', food: '燕麥、乳清、香蕉', protein: 42, kcal: 610 },
      { name: '午餐', food: '雞腿便當', protein: 62, kcal: 890 },
      { name: '晚餐', food: '義大利麵、牛肉', protein: 62, kcal: 870 },
    ],
  },
  21: {
    calories: 1820, protein: 148, carbs: 186, fat: 52,
    advice: '蛋白質接近達標，訓練後可再補 20g 碳水讓恢復更好。',
    meals: [
      { name: '早餐', food: '希臘優格、香蕉、燕麥', protein: 34, kcal: 520 },
      { name: '午餐', food: '雞胸飯、青菜、味噌湯', protein: 58, kcal: 760 },
      { name: '點心', food: '乳清、堅果', protein: 32, kcal: 310 },
    ],
  },
}

export const frequentFoods = [
  { name: '乳清', meal: '點心', kcal: 130, protein: 24, carbs: 3, fat: 2 },
  { name: '雞胸飯', meal: '午餐', kcal: 680, protein: 55, carbs: 82, fat: 12 },
  { name: '希臘優格', meal: '早餐', kcal: 160, protein: 18, carbs: 12, fat: 4 },
  { name: '香蕉', meal: '點心', kcal: 105, protein: 1, carbs: 27, fat: 0 },
  { name: '燕麥', meal: '早餐', kcal: 190, protein: 6, carbs: 33, fat: 4 },
  { name: '堅果', meal: '點心', kcal: 180, protein: 5, carbs: 6, fat: 16 },
]

export const muscleLoad = [
  { label: '胸', value: 78, sets: 12 },
  { label: '背', value: 86, sets: 14 },
  { label: '腿', value: 58, sets: 9 },
  { label: '肩', value: 44, sets: 7 },
  { label: '核心', value: 66, sets: 10 },
]

export const weightLogs = [
  { date: '5/08', weight: 73.6 },
  { date: '5/10', weight: 73.4 },
  { date: '5/12', weight: 73.2 },
  { date: '5/14', weight: 72.9 },
  { date: '5/16', weight: 72.7 },
  { date: '5/18', weight: 72.5 },
  { date: '5/21', weight: 72.4 },
]

export const painLogs = [
  { bodyPart: '左肩', key: 'shoulder_l', intensity: 4, note: '推的動作先降重量' },
]

export const prHighlights = [
  { exercise: '臥推', value: '82.5kg x 5', estimate: '96kg' },
  { exercise: '深蹲', value: '110kg x 3', estimate: '121kg' },
]

export const aiSuggestions = [
  {
    title: '替代動作',
    body: '偵測到左肩不適，今天臥推改成滑輪夾胸或機械胸推，重量控制在 RPE 6-7。',
  },
  {
    title: '營養微調',
    body: '最近兩週體重緩慢下降，可以先維持熱量，訓練日把碳水提高 20-30g 觀察力量表現。',
  },
]
