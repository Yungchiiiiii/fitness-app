import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type FoodAnalysisRequest = {
  task: 'food-analysis'
  description?: string
  image?: { mimeType: string; data: string } | null
  images?: Array<{ mimeType: string; data: string }>
}

type CoachChatRequest = {
  task: 'coach-chat'
  prompt: string
  context?: unknown
}

type ExerciseClassificationRequest = {
  task: 'exercise-classification'
  name: string
}

const geminiKey = Deno.env.get('GEMINI_API_KEY')
const groqKey = Deno.env.get('GROQ_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client, user } = await requireUser(req)
    const body = await req.json() as FoodAnalysisRequest | CoachChatRequest | ExerciseClassificationRequest

    if (body.task === 'food-analysis') {
      const meal = await analyzeFood(body)
      const images = getFoodImages(body)
      await logAiEvent(client, user.id, 'food-analysis', {
        description: body.description?.slice(0, 1000) || '',
        imageCount: images.length,
        mimeTypes: images.map(image => image.mimeType),
      }, meal)
      return json({ meal })
    }
    if (body.task === 'coach-chat') {
      const reply = await coachReply(body)
      await logAiEvent(client, user.id, 'coach-chat', {
        prompt: body.prompt?.slice(0, 4000) || '',
        context: body.context || {},
      }, { reply: reply.slice(0, 6000) })
      return json({ reply })
    }
    if (body.task === 'exercise-classification') {
      return json({ classification: await classifyExercise(body) })
    }
    return json({ error: 'Unknown task' }, 400)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, status)
  }
})

async function requireUser(req: Request) {
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new HttpError('雲端身分尚未建立，請重新整理後再試。', 401)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!url || !key) throw new Error('Server missing Supabase function configuration')
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } })
  const { data, error } = await client.auth.getUser(authorization.slice('Bearer '.length))
  if (error || !data.user) throw new HttpError('雲端身分已失效，請重新整理後再試。', 401)
  return { client, user: data.user }
}

async function logAiEvent(client: ReturnType<typeof createClient>, userId: string, kind: string, input: unknown, output: unknown) {
  const { error } = await client.from('ai_events').insert({ user_id: userId, kind, input, output })
  if (error) console.error('Could not log AI event:', error.message)
}

class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function analyzeFood(body: FoodAnalysisRequest) {
  if (groqKey) {
    return analyzeFoodWithGroq(body)
  }
  if (!geminiKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  const parts: Array<Record<string, unknown>> = [{
    text: `你是營養分析助手。根據照片與使用者描述估算餐點營養。所有照片都屬於同一餐，可能是分批上菜；請合併估算整餐，並避免重複計算看起來相同的食物。
只回傳 JSON，不要 markdown，不要多餘文字。
格式：
{"isFood":true/false,"meal":"早餐/午餐/晚餐/點心","name":"餐點名稱","kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"note":"一句估算依據"}
如果照片或描述不是食物、飲料或餐點，isFood 必須是 false，營養數字都填 0，note 說明沒有辨識到餐點，不要猜熱量。
使用者描述：${body.description || '無'}`,
  }]

  for (const image of getFoodImages(body)) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType || 'image/jpeg',
        data: image.data,
      },
    })
  }

  const parsed = parseJson(await callGemini(parts))
  const isFood = parsed.isFood !== false
  return {
    isFood,
    meal: parsed.meal || '點心',
    name: parsed.name || (isFood ? '未命名餐點' : '無餐點'),
    kcal: isFood ? Number(parsed.kcal) || 0 : 0,
    protein: isFood ? Number(parsed.protein) || 0 : 0,
    carbs: isFood ? Number(parsed.carbs) || 0 : 0,
    fat: isFood ? Number(parsed.fat) || 0 : 0,
    note: parsed.note || (isFood ? '由 AI 依照片與描述估算。' : '沒有辨識到可記錄的餐點。'),
  }
}

async function coachReply(body: CoachChatRequest) {
  const noteInstruction = `必須先檢查 app 資料中的 trainingNotes，以及 recentTraining 每個動作的 note。
若備註出現疼痛、不舒服、不適、緊、卡、麻、拉傷、扭傷、無力或其他異常，即使使用者這次沒有主動提到，也要在回答中指出相關日期、動作與備註內容，並把它納入訓練安排；不可忽略或建議硬撐。
備註只代表使用者當時的主觀紀錄，不可自行診斷疾病。較舊的備註要說明日期，不可假裝是今天發生。`
  if (groqKey) {
    return callGroq([
      {
        role: 'system',
        content: `你是繁體中文健身、營養與恢復教練。請回答得具體、可執行、保守安全。
${noteInstruction}
不能診斷疾病；如果使用者描述受傷、劇痛、腫脹、無法負重、麻木或症狀惡化，要建議就醫或找物理治療師。
回答 3 到 6 點，避免空泛。每一點必須獨立換行，使用「1.」「2.」「3.」編號；不同主題之間空一行，不要把多個編號擠在同一行。請參考 app 內資料：${JSON.stringify(body.context || {})}`,
      },
      { role: 'user', content: body.prompt },
    ])
  }
  if (!geminiKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  return (await callGemini([{
    text: `你是繁體中文健身、營養與恢復教練。
請回答得具體、可執行、保守安全，並參考 app 內資料。
${noteInstruction}
不能診斷疾病；如果使用者描述受傷、劇痛、腫脹、無法負重、麻木或症狀惡化，要建議就醫或找物理治療師。
回答 3 到 6 點，避免空泛。每一點必須獨立換行，使用「1.」「2.」「3.」編號；不同主題之間空一行，不要把多個編號擠在同一行。

App 內資料：
${JSON.stringify(body.context || {})}

使用者問題：
${body.prompt}`,
  }])).trim()
}

async function classifyExercise(body: ExerciseClassificationRequest) {
  const name = body.name?.trim()
  if (!name) throw new HttpError('請先輸入動作或器械名稱。', 400)
  const instruction = `你是健身房動作分類助手。請判斷使用者輸入的動作或器械主要訓練分類與部位。
只回傳 JSON，不要 markdown 或多餘文字。
category 只能是 lower、upper、cardio、core 其中一個。
inputType 只能是 strength、cardio、core 其中一個；lower/upper 使用 strength，有氧使用 cardio，核心使用 core。
羽球、網球、桌球、游泳、跑步、單車、球類與其他以持續時間記錄的運動，優先分類為 cardio，讓使用者記錄分鐘與選填負重；不要因為主要使用手臂或腿就分到 upper/lower。
target 請用簡短繁體中文列出主要肌群，例如「股四頭肌、臀大肌」。
格式：{"category":"lower","target":"股四頭肌、臀大肌","inputType":"strength"}
使用者輸入：${name}`
  const text = groqKey
    ? await callGroq([{ role: 'system', content: '你是精確的健身動作分類助手。' }, { role: 'user', content: instruction }])
    : await callGemini([{ text: instruction }])
  const parsed = parseJson(text)
  const category = ['lower', 'upper', 'cardio', 'core'].includes(parsed.category) ? parsed.category : 'upper'
  const inputType = category === 'cardio' ? 'cardio' : category === 'core' ? 'core' : 'strength'
  return {
    category,
    target: String(parsed.target || '全身肌群').slice(0, 80),
    inputType,
  }
}

async function analyzeFoodWithGroq(body: FoodAnalysisRequest) {
  const description = body.description?.trim()
  const images = getFoodImages(body)
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `請把所有照片視為同一餐的不同食物或不同上菜時間，合併分析整餐，避免重複計算相同食物。使用者補充描述：${description || '無'}。
只回傳 JSON，不要 markdown，不要多餘文字。
格式：
{"isFood":true/false,"meal":"早餐/午餐/晚餐/點心","name":"餐點名稱","kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"note":"一句估算依據"}
如果照片或描述不是食物、飲料或餐點，isFood 必須是 false，營養數字都填 0，note 說明沒有辨識到餐點，不要猜熱量。`,
    },
  ]

  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}`,
      },
    })
  }

  const text = await callGroq([
    {
      role: 'system',
      content: '你是營養分析助手。你可以根據餐點照片與文字描述估算營養。',
    },
    { role: 'user', content },
  ], images.length ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant')
  const parsed = parseJson(text)
  const isFood = parsed.isFood !== false
  return {
    isFood,
    meal: parsed.meal || '點心',
    name: parsed.name || (isFood ? '未命名餐點' : '無餐點'),
    kcal: isFood ? Number(parsed.kcal) || 0 : 0,
    protein: isFood ? Number(parsed.protein) || 0 : 0,
    carbs: isFood ? Number(parsed.carbs) || 0 : 0,
    fat: isFood ? Number(parsed.fat) || 0 : 0,
    note: parsed.note || (isFood ? '由 AI 依文字描述估算。' : '沒有辨識到可記錄的餐點。'),
  }
}

function getFoodImages(body: FoodAnalysisRequest) {
  const supplied = Array.isArray(body.images) ? body.images : body.image ? [body.image] : []
  return supplied.filter(image => image?.data).slice(0, 4)
}

async function callGemini(parts: Array<Record<string, unknown>>) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0.45, maxOutputTokens: 900 },
      contents: [{ role: 'user', parts }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Gemini request failed: ${res.status} ${detail.slice(0, 180)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('\n') || ''
}

async function callGroq(messages: Array<{ role: string; content: unknown }>, model = 'llama-3.1-8b-instant') {
  if (!groqKey) throw new Error('Server missing GROQ_API_KEY')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      max_tokens: 900,
      messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Groq request failed: ${res.status} ${detail.slice(0, 180)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini did not return JSON')
  return JSON.parse(match[0])
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
