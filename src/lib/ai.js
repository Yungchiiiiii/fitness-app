import { supabase } from './supabase'

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export async function analyzeFoodWithGemini({ file, description }) {
  if (!file && !description.trim()) throw new Error('請提供照片或文字描述')
  const image = file ? {
    mimeType: file.type || 'image/jpeg',
    data: await fileToBase64(file),
  } : null
  const { data, error } = await supabase.functions.invoke('fitness-ai', {
    body: { task: 'food-analysis', description, image },
  })
  if (error) throw new Error(error.message || 'Gemini 分析失敗')
  const parsed = data?.meal
  if (!parsed) throw new Error('AI 沒有回傳餐點分析')
  return {
    meal: parsed.meal || '餐點',
    name: parsed.name || 'AI 辨識餐點',
    kcal: Number(parsed.kcal) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fat: Number(parsed.fat) || 0,
    note: parsed.note || '由 AI 依照片與描述估算。',
  }
}

export async function askCoachWithAI({ prompt, context }) {
  const { data, error } = await supabase.functions.invoke('fitness-ai', {
    body: { task: 'coach-chat', prompt, context },
  })
  if (error) throw new Error(error.message || 'AI 教練回覆失敗')
  return data?.reply?.trim() || '我暫時沒有取得有效回覆，請再問一次。'
}
