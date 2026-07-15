export const CATEGORY_META = {
  lower: { label: '下肢', inputType: 'strength', fallbackTarget: '臀腿與下肢穩定' },
  upper: { label: '上肢', inputType: 'strength', fallbackTarget: '胸、背、肩與手臂' },
  cardio: { label: '有氧', inputType: 'cardio', fallbackTarget: '心肺耐力與全身協調' },
  core: { label: '核心', inputType: 'core', fallbackTarget: '核心控制與軀幹穩定' },
}

const strength = (name, target, equipment) => ({ name, target, equipment, inputType: 'strength' })
const timed = (name, target, equipment, inputType) => ({ name, target, equipment, inputType })

// World Gym 三峽官方公開 Hoist、Hammer Strength、Matrix、美式蹲舉架、
// Booty Zone、草皮、拳擊、跑步機與戰繩區；品牌未公開逐台型號，因此此清單
// 以官方確認的區域／品牌搭配常見商用器械動作整理。
export const WORLD_GYM_LIBRARY = {
  lower: [
    strength('槓鈴深蹲', '股四頭、臀大肌、核心', '美式蹲舉架'),
    strength('史密斯深蹲', '股四頭、臀大肌', '史密斯機'),
    strength('哈克深蹲', '股四頭、臀大肌', 'Hack Squat'),
    strength('V 型深蹲', '股四頭、臀大肌', 'V-Squat'),
    strength('45 度腿推', '股四頭、臀大肌', 'Leg Press'),
    strength('水平腿推', '股四頭、臀大肌', 'Seated Leg Press'),
    strength('單腿腿推', '股四頭、臀中肌', 'Leg Press'),
    strength('腿伸展', '股四頭肌', 'Leg Extension'),
    strength('坐姿腿彎舉', '腿後腱肌群', 'Seated Leg Curl'),
    strength('臥姿腿彎舉', '腿後腱肌群', 'Lying Leg Curl'),
    strength('站姿單腿彎舉', '腿後腱肌群', 'Standing Leg Curl'),
    strength('臀推機', '臀大肌、腿後側', 'Booty Zone / Glute Drive'),
    strength('槓鈴臀推', '臀大肌、腿後側', '美式蹲舉架'),
    strength('髖外展', '臀中肌、臀小肌', 'Hip Abductor'),
    strength('髖內收', '大腿內收肌群', 'Hip Adductor'),
    strength('後踢腿機', '臀大肌', 'Glute Kickback'),
    strength('滑輪後踢腿', '臀大肌', 'Cable'),
    strength('羅馬椅背伸展', '臀大肌、腿後側、下背', 'Back Extension'),
    strength('羅馬尼亞硬舉', '腿後腱、臀大肌、下背', '槓鈴／啞鈴'),
    strength('傳統硬舉', '臀腿、背部、握力', '美式蹲舉架'),
    strength('相撲硬舉', '臀腿、大腿內側', '美式蹲舉架'),
    strength('保加利亞分腿蹲', '股四頭、臀大肌、平衡', '啞鈴／史密斯機'),
    strength('壺鈴弓箭步', '股四頭、臀大肌、腿後側、平衡', '雙壺鈴'),
    strength('行走弓箭步', '股四頭、臀大肌、平衡', '多功能草皮'),
    strength('單側負重火箭蹲', '股四頭、臀大肌、下肢穩定', '啞鈴／壺鈴'),
    strength('單側負重側向蹲', '臀腿、內收肌、側向穩定', '啞鈴／壺鈴'),
    strength('單側臀橋', '臀大肌、腿後側、骨盆穩定', '地墊'),
    strength('站姿小腿提踵', '腓腸肌、比目魚肌', 'Calf Raise'),
    strength('坐姿小腿提踵', '比目魚肌', 'Seated Calf Raise'),
  ],
  upper: [
    strength('槓鈴臥推', '胸大肌、前三角、肱三頭', '臥推架'),
    strength('啞鈴臥推', '胸大肌、前三角、肱三頭', '啞鈴'),
    strength('上斜槓鈴臥推', '上胸、前三角、肱三頭', '上斜臥推架'),
    strength('上斜啞鈴臥推', '上胸、前三角、肱三頭', '啞鈴'),
    strength('坐姿胸推', '胸大肌、肱三頭', 'Matrix / Hoist Chest Press'),
    strength('Hammer Strength 胸推', '胸大肌、肱三頭', 'Hammer Strength'),
    strength('Hammer Strength 上斜胸推', '上胸、前三角', 'Hammer Strength'),
    strength('蝴蝶機夾胸', '胸大肌', 'Pec Fly'),
    strength('滑輪夾胸', '胸大肌', 'Cable Crossover'),
    strength('肩推機', '三角肌、肱三頭', 'Matrix / Hoist Shoulder Press'),
    strength('啞鈴肩推', '三角肌、肱三頭', '啞鈴'),
    strength('阿諾肩推', '三角肌', '啞鈴'),
    strength('側平舉', '中三角肌', '啞鈴'),
    strength('滑輪側平舉', '中三角肌', 'Cable'),
    strength('反向蝴蝶機', '後三角、菱形肌', 'Rear Delt Fly'),
    strength('臉拉', '後三角、旋轉肌群、上背', 'Cable'),
    strength('引體向上', '背闊肌、肱二頭', '單槓'),
    strength('輔助引體向上', '背闊肌、肱二頭', 'Assisted Pull-up'),
    strength('寬握滑輪下拉', '背闊肌、肱二頭', 'Lat Pulldown'),
    strength('窄握滑輪下拉', '背闊肌、肱二頭', 'Lat Pulldown'),
    strength('坐姿划船', '中背、背闊肌、肱二頭', 'Seated Row'),
    strength('高位划船', '上背、背闊肌', 'High Row'),
    strength('Hammer Strength 單臂划船', '背闊肌、中背', 'Hammer Strength'),
    strength('胸靠划船', '中背、後三角', 'Chest Supported Row'),
    strength('啞鈴單臂划船', '背闊肌、中背', '啞鈴'),
    strength('槓鈴划船', '背闊肌、中背、下背', '槓鈴'),
    strength('直臂下拉', '背闊肌', 'Cable'),
    strength('二頭彎舉機', '肱二頭肌', 'Biceps Curl'),
    strength('牧師椅彎舉', '肱二頭肌', 'Preacher Curl'),
    strength('啞鈴二頭彎舉', '肱二頭肌', '啞鈴'),
    strength('槌式彎舉', '肱肌、肱橈肌', '啞鈴'),
    strength('三頭下壓', '肱三頭肌', 'Cable'),
    strength('過頭三頭伸展', '肱三頭肌長頭', 'Cable／啞鈴'),
    strength('輔助雙槓撐體', '肱三頭、下胸', 'Assisted Dip'),
  ],
  cardio: [
    timed('跑步機', '心肺耐力、下肢', 'Matrix Treadmill', 'cardio'),
    timed('爬樓機', '心肺耐力、臀腿', 'Stair Climber', 'cardio'),
    timed('橢圓機', '心肺耐力、全身低衝擊', 'Elliptical', 'cardio'),
    timed('飛輪', '心肺耐力、股四頭', 'Indoor Cycle', 'cardio'),
    timed('直立式腳踏車', '心肺耐力、下肢', 'Upright Bike', 'cardio'),
    timed('臥式腳踏車', '心肺耐力、下肢低衝擊', 'Recumbent Bike', 'cardio'),
    timed('划船機', '心肺耐力、背部、臀腿', 'Rower', 'cardio'),
    timed('戰繩', '心肺耐力、肩臂、核心', '戰繩區', 'cardio'),
    timed('雪橇推', '心肺、臀腿與全身力量', '多功能草皮', 'cardio'),
    timed('拳擊沙袋', '心肺、肩臂、核心協調', '拳擊袋訓練區', 'cardio'),
    timed('戶外跑步', '心肺耐力、下肢', '戶外', 'cardio'),
  ],
  core: [
    timed('棒式', '腹橫肌、腹直肌、肩胛穩定', '地墊', 'core'),
    timed('側棒式', '腹斜肌、臀中肌', '地墊', 'core'),
    strength('腹肌訓練機', '腹直肌', 'Abdominal Crunch'),
    strength('旋轉訓練機', '腹內外斜肌', 'Rotary Torso'),
    strength('滑輪伐木', '腹斜肌、抗旋轉控制', 'Cable'),
    strength('Pallof Press', '抗旋轉核心、腹橫肌', 'Cable'),
    timed('懸掛抬腿', '下腹、髖屈肌、握力', 'Captain Chair／單槓', 'core'),
    timed('捲腹', '腹直肌', '地墊', 'core'),
    timed('俄羅斯轉體', '腹斜肌、旋轉控制', '地墊／藥球', 'core'),
    timed('死蟲式', '深層核心、骨盆穩定', '地墊', 'core'),
    timed('鳥狗式', '核心、下背、髖部穩定', '地墊', 'core'),
    timed('滾輪', '腹直肌、背闊肌、肩胛穩定', '健腹輪', 'core'),
  ],
}

export const getAllLibraryExercises = () => Object.entries(WORLD_GYM_LIBRARY).flatMap(([category, exercises]) =>
  exercises.map(exercise => ({ ...exercise, category })),
)

export const getHistoricalExercises = sessions => {
  const builtInByName = new Map(getAllLibraryExercises().map(exercise => [exercise.name, exercise]))
  const historicalByName = new Map()

  for (const workout of sessions || []) {
    for (const exercise of workout.session_exercises || []) {
      const name = String(exercise.name || '').trim()
      if (!name || historicalByName.has(name)) continue
      const builtIn = builtInByName.get(name)
      const category = builtIn?.category || (CATEGORY_META[exercise.category] ? exercise.category : 'upper')
      historicalByName.set(name, builtIn || {
        name,
        category,
        inputType: CATEGORY_META[category].inputType,
        target: CATEGORY_META[category].fallbackTarget,
        equipment: '過去訓練紀錄',
        historical: true,
      })
    }
  }

  return [...historicalByName.values()]
}

export const getCategoryForExercise = name => {
  const match = getAllLibraryExercises().find(exercise => exercise.name === name)
  return match?.category || 'upper'
}

export const getExerciseByName = name => getAllLibraryExercises().find(exercise => exercise.name === name)
