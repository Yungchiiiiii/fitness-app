import { supabase } from './supabase'

const fileToImage = file => new Promise((resolve, reject) => {
  const image = new Image()
  const url = URL.createObjectURL(file)
  image.onload = () => {
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    resolve({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.82).split(',')[1] })
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error(`無法讀取照片：${file.name}`))
  }
  image.src = url
})

export async function analyzeFoodWithGemini({ files = [], description }) {
  if (!files.length && !String(description || '').trim()) throw new Error('請提供照片或文字描述')
  const images = await Promise.all(files.slice(0, 4).map(fileToImage))
  const { data, error } = await invokeFitnessAi({ task: 'food-analysis', description, images })
  if (error) throw new Error(await functionErrorMessage(error, 'AI 分析失敗'))
  const parsed = data?.meal
  if (!parsed) throw new Error('AI 沒有回傳餐點分析')
  if (parsed.isFood === false) throw new Error(parsed.note || 'AI 沒有在照片中辨識到餐點，請換一張食物照片或補充描述。')
  return {
    meal: parsed.meal || '點心',
    name: parsed.name || '未命名餐點',
    kcal: Number(parsed.kcal) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fat: Number(parsed.fat) || 0,
    kcalRange: Array.isArray(parsed.kcalRange) ? parsed.kcalRange.slice(0, 2).map(Number) : [],
    wholeDishKcal: Number(parsed.wholeDishKcal) || 0,
    shareCount: Number(parsed.shareCount) || 0,
    servingFraction: Number(parsed.servingFraction) || 0,
    note: parsed.note || '由 AI 依照片與描述估算。',
    lookupUsed: parsed.lookupUsed === true,
    sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 3) : [],
    estimated: parsed.estimated === true,
    needsNutritionLabel: parsed.needsNutritionLabel === true,
  }
}

export async function askCoachWithAI({ prompt, context }) {
  const { data, error } = await invokeFitnessAi({ task: 'coach-chat', prompt, context })
  if (error) throw new Error(await functionErrorMessage(error, 'AI 教練回覆失敗'))
  return data?.reply?.trim() || '我暫時沒有取得有效回覆，請再問一次。'
}

export async function getDailyNutritionAdvice(date) {
  const { data, error } = await invokeFitnessAi({ task: 'daily-nutrition-advice', date })
  if (error) throw new Error(await functionErrorMessage(error, '無法取得當日 AI 建議'))
  return data?.advice?.trim() || '目前沒有足夠的飲食紀錄可以整理建議。'
}

export async function classifyExerciseWithAI(name) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('請先輸入動作或器械名稱')
  const { data, error } = await invokeFitnessAi({ task: 'exercise-classification', name: cleanName })
  if (error) throw new Error(await functionErrorMessage(error, 'AI 分類失敗'))
  const classification = data?.classification
  if (!classification?.category || !classification?.target) throw new Error('AI 沒有回傳有效分類')
  const durationSport = /(羽球|網球|桌球|壁球|籃球|排球|足球|棒球|壘球|游泳|跑步|慢跑|健走|單車|自行車|跳繩|有氧舞蹈|拳擊|登山|爬山)/.test(cleanName)
  if (durationSport) return { ...classification, category: 'cardio', inputType: 'cardio' }
  return classification
}

export async function analyzeExercisePhotoWithAI({ files = [], description = '' }) {
  const cleanDescription = String(description || '').trim()
  if (!files.length && !cleanDescription) throw new Error('請拍攝器械、上傳動作照片，或輸入簡短描述')
  const images = await Promise.all(files.slice(0, 2).map(fileToImage))
  const { data, error } = await invokeFitnessAi({ task: 'exercise-image-analysis', description: cleanDescription, images })
  if (error) throw new Error(await functionErrorMessage(error, 'AI 辨識失敗'))
  const exercise = data?.exercise
  if (!exercise?.detected) throw new Error(exercise?.note || '照片中沒有辨識到器械或運動動作，請換一張較清楚的照片。')
  if (!exercise.name || !exercise.category || !exercise.target) throw new Error('AI 沒有回傳完整的運動分類')
  return exercise
}

const retryableFunctionStatuses = new Set([408, 429, 500, 502, 503, 504])

async function invokeFitnessAi(body) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.functions.invoke('fitness-ai', { body, timeout: 60_000 })
    if (!error) return { data, error: null }
    lastError = error

    const status = Number(error?.context?.status) || 0
    if (attempt === 0 && status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (!refreshError) continue
    }

    const transientNetworkError = ['FunctionsFetchError', 'FunctionsRelayError'].includes(error?.name)
    if (attempt === 0 && (transientNetworkError || retryableFunctionStatuses.has(status))) {
      await new Promise(resolve => setTimeout(resolve, 700))
      continue
    }
    break
  }
  return { data: null, error: lastError }
}

async function functionErrorMessage(error, fallback) {
  try {
    const payload = await error?.context?.clone?.().json()
    if (payload?.error) return payload.error
  } catch {
    // Supabase does not always expose a JSON response body (for example, a
    // network error). Fall back to its own message below.
  }
  return error?.message || fallback
}
