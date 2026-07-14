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
const geminiModel = 'gemini-3.5-flash'

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
  if (!geminiKey && !groqKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  const draft = groqKey
    ? await analyzeFoodWithGroq(body)
    : await analyzeFoodWithGemini(body)

  if (!draft.isFood || !draft.lookupRecommended || !draft.productQuery) return draft
  if (!geminiKey) {
    return {
      ...draft,
      note: `${draft.note}；目前未設定網路查證服務，數值以包裝照片辨識結果為準。`,
    }
  }

  try {
    return await researchPackagedFood(draft, body.description || '')
  } catch (error) {
    console.error('Packaged food lookup failed:', error)
    return {
      ...draft,
      note: `${draft.note}；網路查證暫時失敗，數值以包裝照片辨識結果為準。`,
    }
  }
}

async function analyzeFoodWithGemini(body: FoodAnalysisRequest) {
  const parts: Array<Record<string, unknown>> = [{
    text: `${foodAnalysisInstruction()}
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

  return normalizeFoodAnalysis(parseJson(await callGemini(parts)))
}

function foodAnalysisInstruction() {
  return `你是繁體中文營養分析助手。根據照片與使用者描述計算這次實際吃下的餐點營養。所有照片都屬於同一餐，可能包含食物正面、營養標示或分批上菜；請合併分析，避免重複計算。
判讀規則：
1. 使用者描述的實吃數量優先。例如包裝有兩顆、備註說吃一顆，就只能記錄一顆，所有營養數字按比例換算，名稱也標示「（一顆）」。
2. 照片若有營養標示，逐字讀取每份量、本包裝含幾份、熱量、蛋白質、碳水與脂肪。包裝標示比一般食物估算可靠。
3. 若是超商、超市、品牌食品、飲料、泡麵或包裝商品，lookupRecommended 必須為 true，productQuery 填完整品牌、商品名、口味與規格，供下一步上網查證。自製或無品牌的一般餐點則填 false。
4. labelEvidence 簡要保留照片中讀到的每份量、包裝份數與營養數字，沒有清楚標示就填空字串。不要把整包營養誤當成單份，也不要把單份誤當整包。
只回傳 JSON，不要 markdown，不要多餘文字。
格式：
{"isFood":true/false,"meal":"早餐/午餐/晚餐/點心","name":"含實吃份量的餐點名稱","kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"note":"一句估算或換算依據","lookupRecommended":true/false,"productQuery":"品牌 商品完整名稱 口味 規格","labelEvidence":"照片上可讀到的營養標示與份數","consumedAmount":"這次實際吃的數量"}
如果照片或描述不是食物、飲料或餐點，isFood 必須是 false，營養數字都填 0，note 說明沒有辨識到餐點，不要猜熱量。`
}

async function researchPackagedFood(draft: Record<string, unknown>, description: string) {
  const prompt = `你是台灣食品營養資料查證助手。請使用 Google Search 查證以下超商、超市或品牌商品的正確品名、口味、規格與營養標示，並計算使用者這次實際吃下的份量。

查詢商品：${draft.productQuery}
使用者備註：${description || '無'}
照片初步辨識：${JSON.stringify(draft)}

規則：
1. 必須核對完全相同的品牌、商品、口味與規格；例如滿漢大餐不同口味不可混用。
2. 資料優先順序是：照片中清楚可讀的實品營養標示、品牌官方頁、台灣通路商品頁、政府或可信食品資料庫。網頁若是其他規格或其他口味，不可覆蓋實品標示。
3. 使用者說的是實際吃下的數量。若一包兩顆而只吃一顆，請將整包數值除以二；若標示本來就是每顆，直接使用每顆數值。所有數字都必須是實吃份量的總和。
4. 不確定時保留照片標示或初步辨識值，note 清楚說明，不可捏造精確數字。
5. name 必須包含品牌、完整品名／口味與實吃份量。note 用一句繁體中文寫出換算式或資料依據。
只回傳 JSON，不要 markdown，不要其他文字：
{"isFood":true,"meal":"早餐/午餐/晚餐/點心","name":"商品與實吃份量","kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"note":"資料來源層級與份量換算","consumedAmount":"實吃數量"}`

  const grounded = await callGeminiGrounded([{ text: prompt }])
  if (!grounded.searched) throw new Error('Gemini did not perform the required product search')
  return normalizeFoodAnalysis({
    ...draft,
    ...parseJson(grounded.text),
    lookupRecommended: true,
    lookupUsed: grounded.searched,
    sources: grounded.sources,
  })
}

async function coachReply(body: CoachChatRequest) {
  const noteInstruction = `必須先檢查 app 資料中的 trainingNotes，以及 recentTraining 每個動作的 note。
若備註出現疼痛、不舒服、不適、緊、卡、麻、拉傷、扭傷、無力或其他異常，即使使用者這次沒有主動提到，也要在回答中指出相關日期、動作與備註內容，並把它納入訓練安排；不可忽略或建議硬撐。
備註只代表使用者當時的主觀紀錄，不可自行診斷疾病。較舊的備註要說明日期，不可假裝是今天發生。
回答飲食問題時，必須檢查 monthlyNutrition，比較本月和上個月的紀錄天數、每日平均營養、餐別分布與常見食物；先指出有數據支持的進步，再提出 1 到 3 個具體改善。若某月紀錄天數太少，要明確提醒資料可能不具代表性，不可把沒有紀錄的日子當成零攝取。`
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
      text: `${foodAnalysisInstruction()}
使用者描述：${description || '無'}`,
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
  return normalizeFoodAnalysis(parseJson(text))
}

function normalizeFoodAnalysis(parsed: Record<string, unknown>) {
  const isFood = parsed.isFood !== false
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources
      .filter(source => source && typeof source === 'object')
      .map(source => ({
        title: String((source as Record<string, unknown>).title || '查證來源').slice(0, 120),
        url: String((source as Record<string, unknown>).url || ''),
      }))
      .filter(source => /^https:\/\//.test(source.url))
      .slice(0, 3)
    : []
  return {
    isFood,
    meal: ['早餐', '午餐', '晚餐', '點心'].includes(String(parsed.meal)) ? String(parsed.meal) : '點心',
    name: String(parsed.name || (isFood ? '未命名餐點' : '無餐點')).slice(0, 160),
    kcal: isFood ? nutritionNumber(parsed.kcal) : 0,
    protein: isFood ? nutritionNumber(parsed.protein) : 0,
    carbs: isFood ? nutritionNumber(parsed.carbs) : 0,
    fat: isFood ? nutritionNumber(parsed.fat) : 0,
    note: String(parsed.note || (isFood ? '由 AI 依照片與描述估算。' : '沒有辨識到可記錄的餐點。')).slice(0, 500),
    lookupRecommended: parsed.lookupRecommended === true,
    lookupUsed: parsed.lookupUsed === true,
    productQuery: String(parsed.productQuery || '').slice(0, 200),
    labelEvidence: String(parsed.labelEvidence || '').slice(0, 500),
    consumedAmount: String(parsed.consumedAmount || '').slice(0, 100),
    sources,
  }
}

function nutritionNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 10) / 10 : 0
}

function getFoodImages(body: FoodAnalysisRequest) {
  const supplied = Array.isArray(body.images) ? body.images : body.image ? [body.image] : []
  return supplied.filter(image => image?.data).slice(0, 4)
}

async function callGemini(parts: Array<Record<string, unknown>>) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 900,
        thinkingConfig: { thinkingLevel: 'low' },
      },
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

async function callGeminiGrounded(parts: Array<Record<string, unknown>>) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingLevel: 'low' },
      },
      tools: [{ google_search: {} }],
      contents: [{ role: 'user', parts }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Gemini grounded request failed: ${res.status} ${detail.slice(0, 180)}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const groundingMetadata = candidate?.groundingMetadata || {}
  const chunks = groundingMetadata.groundingChunks || []
  return {
    text: candidate?.content?.parts?.map((part: { text?: string }) => part.text || '').join('\n') || '',
    searched: Array.isArray(groundingMetadata.webSearchQueries) && groundingMetadata.webSearchQueries.length > 0,
    sources: chunks
      .map((chunk: { web?: { title?: string; uri?: string } }) => ({
        title: chunk.web?.title || 'Google Search 查證來源',
        url: chunk.web?.uri || '',
      }))
      .filter((source: { url: string }) => /^https:\/\//.test(source.url))
      .filter((source: { url: string }, index: number, all: Array<{ url: string }>) => all.findIndex(item => item.url === source.url) === index)
      .slice(0, 3),
  }
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
