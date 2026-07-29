import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  applySharedServing,
  auditNutrition,
  parseSharedServing,
  shouldUseCorrectedNutrition,
  stabilizeNutrition,
  type NutritionAudit,
} from './nutrition.ts'

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

type ExerciseImageAnalysisRequest = {
  task: 'exercise-image-analysis'
  description?: string
  images?: Array<{ mimeType: string; data: string }>
}

type DailyNutritionAdviceRequest = {
  task: 'daily-nutrition-advice'
  date: string
}

const geminiKey = Deno.env.get('GEMINI_API_KEY')
const groqKey = Deno.env.get('GROQ_API_KEY')
const geminiModel = 'gemini-3.5-flash'
const enableProductLookup = Deno.env.get('ENABLE_PRODUCT_LOOKUP') === 'true'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client, user } = await requireUser(req)
    const body = await req.json() as FoodAnalysisRequest | CoachChatRequest | ExerciseClassificationRequest | ExerciseImageAnalysisRequest | DailyNutritionAdviceRequest

    if (body.task === 'food-analysis') {
      const images = getFoodImages(body)
      const eventInput = {
        description: body.description?.slice(0, 1000) || '',
        imageCount: images.length,
        mimeTypes: images.map(image => image.mimeType),
      }
      try {
        const meal = await analyzeFood(body, client, user.id)
        await logAiEvent(client, user.id, 'food-analysis', eventInput, { ...meal, status: 'success' })
        return json({ meal })
      } catch (error) {
        const diagnostic = foodAnalysisDiagnostic(error)
        console.error('Food analysis failed:', diagnostic)
        await logAiEvent(client, user.id, 'food-analysis', eventInput, {
          status: 'error',
          diagnostic,
        })
        throw error
      }
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
      const classification = await classifyExercise(body)
      await logAiEvent(client, user.id, 'exercise-classification', { name: body.name.slice(0, 200) }, classification)
      return json({ classification })
    }
    if (body.task === 'exercise-image-analysis') {
      const exercise = await analyzeExerciseImage(body)
      await logAiEvent(client, user.id, 'exercise-image-analysis', {
        description: body.description?.slice(0, 500) || '',
        imageCount: getExerciseImages(body).length,
      }, exercise)
      return json({ exercise })
    }
    if (body.task === 'daily-nutrition-advice') {
      return json(await dailyNutritionAdvice(client, user.id, body))
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

async function dailyNutritionAdvice(client: ReturnType<typeof createClient>, userId: string, body: DailyNutritionAdviceRequest) {
  const date = String(body.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError('日期格式不正確。', 400)

  const [{ data: meals, error: mealError }, { data: profile, error: profileError }] = await Promise.all([
    client.from('food_logs')
      .select('id, meal, name, kcal, protein, carbs, fat, note, updated_at')
      .eq('user_id', userId)
      .eq('date', date)
      .order('logged_at', { ascending: true }),
    client.from('profiles')
      .select('calories_target, protein_target, carbs_target, fat_target, goal')
      .eq('id', userId)
      .maybeSingle(),
  ])
  if (mealError) throw new HttpError(`讀取飲食紀錄失敗：${mealError.message}`, 500)
  if (profileError) throw new HttpError(`讀取營養目標失敗：${profileError.message}`, 500)

  const foodFingerprint = (meals || []).map(meal => [
    meal.id, meal.meal, meal.name, meal.kcal, meal.protein, meal.carbs, meal.fat, meal.note, meal.updated_at,
  ].join('|')).join('~')

  const { data: cached } = await client.from('ai_events')
    .select('input, output')
    .eq('user_id', userId)
    .eq('kind', 'daily-nutrition-advice')
    .order('created_at', { ascending: false })
    .limit(12)

  const match = (cached || []).find(event => event.input?.date === date && event.input?.foodFingerprint === foodFingerprint)
  if (typeof match?.output?.advice === 'string' && match.output.advice.trim()) {
    return { advice: match.output.advice.trim(), cached: true }
  }

  if (!meals?.length) return { advice: '這一天還沒有飲食紀錄，先記下餐點後我才能整理建議。', cached: false }

  const totals = meals.reduce((sum, meal) => ({
    calories: sum.calories + (Number(meal.kcal) || 0),
    protein: sum.protein + (Number(meal.protein) || 0),
    carbs: sum.carbs + (Number(meal.carbs) || 0),
    fat: sum.fat + (Number(meal.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const prompt = `你是繁體中文的每日飲食教練。請根據以下單日飲食紀錄與個人目標，寫一段溫和、具體、可執行的建議。
日期：${date}
個人目標：${JSON.stringify(profile || {})}
當日總量：${JSON.stringify(totals)}
餐點：${JSON.stringify(meals)}

規則：
1. 只能根據紀錄提出意見，不可假裝知道未記錄的內容。
2. 先用一句話說做得好的地方，再給 1 到 2 個最重要的調整。
3. 若總量明顯不足，提醒可能是尚未記完整，不要直接斷言吃太少。
4. 不做疾病診斷，不使用恐嚇語氣。
5. 全文 70 到 140 個繁體中文字，直接輸出建議，不要標題、markdown 或 JSON。`

  let advice: string
  try {
    advice = groqKey
      ? await callGroq([
        { role: 'system', content: '你是溫和、務實的繁體中文每日飲食教練。' },
        { role: 'user', content: prompt },
      ])
      : await callGemini([{ text: prompt }])
  } catch (error) {
    throw friendlyAiError(error)
  }
  advice = advice.trim().slice(0, 700)
  if (!advice) throw new HttpError('AI 暫時沒有產生有效建議，請稍後再試。', 503)

  await logAiEvent(client, userId, 'daily-nutrition-advice', { date, foodFingerprint, totals }, { advice })
  return { advice, cached: false }
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

type FoodProvider = 'gemini' | 'groq'

async function analyzeFood(
  body: FoodAnalysisRequest,
  client: ReturnType<typeof createClient>,
  userId: string,
) {
  if (!geminiKey && !groqKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  const sharedServing = parseSharedServing(body.description || '')
  const analysisBody = body
  let draft: Record<string, unknown>
  let primaryProvider: FoodProvider
  try {
    primaryProvider = geminiKey ? 'gemini' : 'groq'
    draft = await analyzeFoodWithProvider(analysisBody, primaryProvider)
  } catch (primaryError) {
    if (!groqKey || !geminiKey) throw friendlyAiError(primaryError)
    primaryProvider = 'groq'
    try {
      draft = await analyzeFoodWithProvider(analysisBody, primaryProvider)
    } catch (fallbackError) {
      console.error('Both food analysis providers failed:', primaryError, fallbackError)
      throw friendlyAiError(primaryError)
    }
  }

  if (!draft.isFood) return draft

  const recent = await getRecentFoodAnalyses(client, userId)
  let result: Record<string, unknown> | null = null
  const hasLabel = String(draft.labelEvidence || '').trim().length > 0
  if (hasLabel && hasUsableNutrition(draft)) result = finalizeFoodAnalysis(draft)

  // Product lookup remains opt-in because Gemini's free tier does not include
  // grounded Google Search. If it is disabled or fails, estimate a normal
  // serving from the identified food and the user's consumed amount.
  if (!result && enableProductLookup && geminiKey && draft.lookupRecommended && draft.productQuery) {
    try {
      const researched = await researchPackagedFood(draft, analysisBody.description || '')
      if (hasUsableNutrition(researched)) result = researched
    } catch (error) {
      console.error('Packaged food lookup failed:', error)
    }
  }

  if (!result && hasUsableNutrition(draft)) {
    result = finalizeFoodAnalysis({
      ...draft,
      estimated: true,
      sources: nutritionReferenceSources,
    })
  }

  if (!result) result = needsNutritionLabel(draft)

  let fullDishResult = stabilizeNutrition(result)
  let audit = auditFoodResult(
    fullDishResult,
    sharedServing,
    recent,
    !String(fullDishResult.labelEvidence || '').trim() && fullDishResult.lookupUsed !== true,
  )
  let autoCorrected = false
  let resultProvider = primaryProvider

  if (!String(fullDishResult.labelEvidence || '').trim() && audit.shouldRecheck) {
    const correctionProvider = audit.repeatedTemplate
      ? alternateFoodProvider(primaryProvider)
      : primaryProvider
    try {
      const correctedDraft = await recheckFoodWithImages(analysisBody, draft, correctionProvider, audit)
      if (correctedDraft.isFood !== false && hasUsableNutrition(correctedDraft)) {
        const correctedResult = stabilizeNutrition(finalizeFoodAnalysis({
          ...correctedDraft,
          estimated: !String(correctedDraft.labelEvidence || '').trim(),
          sources: String(correctedDraft.labelEvidence || '').trim()
            ? correctedDraft.sources
            : nutritionReferenceSources,
        }))
        const correctedAudit = auditFoodResult(
          correctedResult,
          sharedServing,
          recent,
          !String(correctedResult.labelEvidence || '').trim() && correctedResult.lookupUsed !== true,
        )
        if (shouldUseCorrectedNutrition(audit, correctedAudit)) {
          fullDishResult = correctedResult
          audit = correctedAudit
          autoCorrected = true
          resultProvider = correctionProvider
        }
      }
    } catch (error) {
      console.error('Food nutrition recheck failed; preserving primary result:', error)
    }
  }

  const finalResult = applySharedServing(fullDishResult, sharedServing)
  return {
    ...finalResult,
    autoCorrected,
    analysisAudit: {
      version: 2,
      status: autoCorrected ? 'corrected' : audit.issues.length ? 'review' : 'passed',
      provider: resultProvider,
      score: audit.score,
      issues: audit.issues,
      repeatedTemplate: audit.repeatedTemplate,
    },
  }
}

async function analyzeFoodWithProvider(
  body: FoodAnalysisRequest,
  provider: FoodProvider,
  instruction = foodAnalysisInstruction(),
) {
  return provider === 'gemini'
    ? analyzeFoodWithGemini(body, instruction)
    : analyzeFoodWithGroq(body, instruction)
}

function alternateFoodProvider(primary: FoodProvider): FoodProvider {
  if (primary === 'gemini' && groqKey) return 'groq'
  if (primary === 'groq' && geminiKey) return 'gemini'
  return primary
}

async function getRecentFoodAnalyses(
  client: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await client.from('ai_events')
    .select('output')
    .eq('user_id', userId)
    .eq('kind', 'food-analysis')
    .order('created_at', { ascending: false })
    .limit(12)
  if (error) {
    console.error('Could not load recent food analyses for audit:', error.message)
    return []
  }
  return (data || [])
    .map(event => event.output)
    .filter(output => output && output.status !== 'error' && nutritionNumber(output.kcal) > 0)
    .map(output => ({
      name: String(output.name || ''),
      kcal: nutritionNumber(output.kcal),
      protein: nutritionNumber(output.protein),
      carbs: nutritionNumber(output.carbs),
      fat: nutritionNumber(output.fat),
    }))
}

function auditFoodResult(
  fullDishResult: Record<string, unknown>,
  sharedServing: ReturnType<typeof parseSharedServing>,
  recent: Array<Record<string, unknown>>,
  requireBreakdown: boolean,
): NutritionAudit {
  const structural = auditNutrition(fullDishResult, { requireBreakdown })
  const recordedServing = applySharedServing(fullDishResult, sharedServing)
  const historyAudit = auditNutrition(recordedServing, { recent })
  const issues = [...structural.issues]
  if (historyAudit.repeatedTemplate && !issues.includes('repeated_cross_meal_template')) {
    issues.push('repeated_cross_meal_template')
  }
  return {
    score: Math.max(0, structural.score - (historyAudit.repeatedTemplate ? 36 : 0)),
    issues,
    repeatedTemplate: historyAudit.repeatedTemplate,
    shouldRecheck: structural.shouldRecheck || historyAudit.repeatedTemplate,
  }
}

function hasUsableNutrition(value: Record<string, unknown>) {
  return nutritionNumber(value.kcal) > 0
    && ['protein', 'carbs', 'fat'].some(key => nutritionNumber(value[key]) > 0)
}

function finalizeFoodAnalysis(draft: Record<string, unknown>) {
  const hasLabel = String(draft.labelEvidence || '').trim().length > 0
  const estimated = draft.estimated === true || !hasLabel
  return {
    ...draft,
    estimated,
    lookupUsed: draft.lookupUsed === true,
    note: hasLabel
      ? `${draft.note}；已直接採用照片中的營養標示。`
      : `${draft.note}；未讀到成分表，數字為一般份量估算。`,
  }
}

async function recheckFoodWithImages(
  body: FoodAnalysisRequest,
  draft: Record<string, unknown>,
  provider: FoodProvider,
  audit: NutritionAudit,
) {
  const identifiedFood = {
    meal: draft.meal,
    name: draft.name,
    consumedAmount: draft.consumedAmount,
    productQuery: draft.productQuery,
  }
  const instruction = `你是第二道餐點營養稽核。原始照片是主要證據，使用者文字只是輔助。請重新查看所有照片並獨立重算餐點營養；上一輪只提供食物名稱線索，不提供熱量，請勿套用便當 550 kcal 等固定模板。

初步辨識（僅供核對食物與份量，不含營養數字）：${JSON.stringify(identifiedFood)}
系統偵測到需要重查的項目：${audit.issues.join(',') || '完整性檢查'}

規則：
1. 先依照片估每一項食物的可食熟重或實際份數與烹調方式。照片看不到的內容不可自行增加。文字只可協助食物名稱、品牌、實吃數量或幾人分食；玩笑、感想、情緒與誇飾不得改變營養估算。除明確實吃份量外，文字和照片衝突時以照片為準。
2. dishBreakdown 的每一項都要填 kcal、protein、carbs、fat；總熱量與三大營養素必須逐項相加，總 kcal 也要大致符合蛋白質×4＋碳水×4＋脂肪×9。
3. 清蒸、水煮、汆燙不加看不見的油；炒、煎、紅燒依可見份量估吸附油；油炸用油炸後食物值。不可把不同餐點都四捨五入成相同模板數字。
4. 若照片是包裝營養標示，逐字採用每份量、包裝份數與使用者實吃份數，labelEvidence 寫出換算依據，dishBreakdown 可留空。
5. 若是一般餐點，合理區間以視覺份量不確定性設定，通常是中間值上下 15–25%；note 寫出主要重量與用油假設。
6. 若使用者提到多人分食，仍回傳整盤總量，不可先除人數；系統會在最後換算。
只回傳 JSON，不要 markdown：
{"isFood":true,"meal":"早餐/午餐/晚餐/點心","name":"含份量的餐點名稱","kcal":逐項加總數字,"kcalRange":[合理下限,合理上限],"protein":逐項加總數字,"carbs":逐項加總數字,"fat":逐項加總數字,"note":"重量、烹調與用油依據","lookupRecommended":true/false,"productQuery":"品牌 商品 規格","labelEvidence":"讀到的標示與份量換算，沒有則空字串","consumedAmount":"辨識的整盤或實吃數量","dishBreakdown":[{"name":"食材","amount":"熟重或份數","cooking":"烹調方式","kcal":數字,"protein":數字,"carbs":數字,"fat":數字}],"estimated":true}`

  return analyzeFoodWithProvider(body, provider, instruction)
}

function needsNutritionLabel(draft: Record<string, unknown>) {
  return {
    ...draft,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    lookupUsed: false,
    needsNutritionLabel: true,
    note: '這張照片沒有讀到營養標示。請再加入一張包裝背面的成分表／營養標示後重新分析；這樣只需一次免費辨識。',
  }
}

function friendlyAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/\b429\b|rate.?limit|quota|resource.?exhausted/i.test(message)) {
    return new HttpError('免費 AI 額度暫時已達上限，請稍後再試；也可以先用「手動」或「常吃」記錄，不需要購買 token。', 429)
  }
  if (/\b401\b|\b403\b|api.?key|permission/i.test(message)) {
    return new HttpError('AI 服務的免費金鑰目前無法使用，請先改用「手動」或「常吃」記錄。', 503)
  }
  return new HttpError('AI 辨識服務暫時無法使用，請稍後再試，或先用「手動」記錄。', 503)
}

function foodAnalysisDiagnostic(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/\b429\b|rate.?limit|quota|resource.?exhausted|額度|上限/i.test(message)) return 'provider_rate_limited'
  if (/\b401\b|\b403\b|api.?key|permission|金鑰/i.test(message)) return 'provider_auth_failed'
  if (/JSON|usable text|empty_content|finishReason/i.test(message)) return 'provider_invalid_output'
  if (/network|fetch|relay|timeout/i.test(message)) return 'provider_unreachable'
  return 'food_analysis_failed'
}

async function analyzeFoodWithGemini(
  body: FoodAnalysisRequest,
  instruction = foodAnalysisInstruction(),
) {
  const parts: Array<Record<string, unknown>> = [{
    text: `${instruction}
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

  return normalizeFoodAnalysis(parseJson(await callGemini(parts, true)))
}

function foodAnalysisInstruction() {
  return `你是繁體中文營養分析助手。照片是主要證據，使用者文字只作輔助。所有照片都屬於同一餐，可能包含食物正面、營養標示或分批上菜；請合併分析，避免重複計算。
判讀規則：
1. 先逐張看照片，辨識每一項可見食物、份量與烹調方式；每一項都列入 dishBreakdown。文字只可協助確認食物名稱、品牌、實際吃幾份或幾人分食。像「好好吃」、玩笑、感想、情緒和誇飾都要忽略，不得拿來改變熱量。除明確實吃份量外，文字和照片衝突時以照片為準。
2. 使用者明確描述的實吃數量優先。例如包裝有兩顆、備註說吃一顆，就只能記錄一顆。若描述提到多人分食，這個辨識階段必須先估整盤總量，不可自行除以人數；系統會在最後強制換算。
3. 照片若有營養標示，逐字讀取每份量、本包裝含幾份、熱量、蛋白質、碳水與脂肪。包裝標示比一般食物估算可靠。
4. 沒有營養標示時，依照片估每項可食熟重或實際份數。dishBreakdown 每項都填 kcal、protein、carbs、fat，總數逐項相加；總 kcal 也應大致符合蛋白質×4＋碳水×4＋脂肪×9。不可把不同餐點都套成 500 或 550 kcal 等固定模板。
5. 清蒸、水煮、汆燙不額外加看不見的油；炒、煎、紅燒依可見份量估吸附油；油炸採油炸後食物值。note 寫出主要重量與用油假設。
6. 若是超商、超市、品牌食品、飲料、泡麵或包裝商品，lookupRecommended 必須為 true，productQuery 填完整品牌、商品名、口味與規格。自製或無品牌的一般餐點則填 false。
7. labelEvidence 簡要保留照片中讀到的每份量、包裝份數與營養數字，沒有清楚標示就填空字串。不要把整包營養誤當成單份，也不要把單份誤當整包。
只回傳 JSON，不要 markdown，不要多餘文字。
格式：
{"isFood":true/false,"meal":"早餐/午餐/晚餐/點心","name":"含份量的餐點名稱","kcal":逐項加總數字,"kcalRange":[合理下限,合理上限],"protein":逐項加總數字,"carbs":逐項加總數字,"fat":逐項加總數字,"note":"重量、烹調與用油依據","lookupRecommended":true/false,"productQuery":"品牌 商品完整名稱 口味 規格","labelEvidence":"照片上可讀到的營養標示與份數","consumedAmount":"辨識的整盤或實吃數量","dishBreakdown":[{"name":"食材","amount":"熟重或份數","cooking":"烹調方式","kcal":數字,"protein":數字,"carbs":數字,"fat":數字}]}
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
回答飲食問題時，必須檢查 monthlyNutrition，比較本月和上個月的紀錄天數、每日平均營養、餐別分布與常見食物；先指出有數據支持的進步，再提出 1 到 3 個具體改善。若某月紀錄天數太少，要明確提醒資料可能不具代表性，不可把沒有紀錄的日子當成零攝取。
若 weightTrend 有本週或近期體重紀錄，要結合目標與最近幾週趨勢提出簡短建議；單週起伏可能是水分，不可只憑一筆紀錄判定增脂或減脂。`
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
    ? await callGroq([{ role: 'system', content: '你是精確的健身動作分類助手。' }, { role: 'user', content: instruction }], 'llama-3.1-8b-instant', true)
    : await callGemini([{ text: instruction }], true)
  const parsed = parseJson(text)
  const category = ['lower', 'upper', 'cardio', 'core'].includes(parsed.category) ? parsed.category : 'upper'
  const inputType = category === 'cardio' ? 'cardio' : category === 'core' ? 'core' : 'strength'
  return {
    category,
    target: String(parsed.target || '全身肌群').slice(0, 80),
    inputType,
  }
}

async function analyzeExerciseImage(body: ExerciseImageAnalysisRequest) {
  if (!geminiKey && !groqKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  const images = getExerciseImages(body)
  const description = body.description?.trim() || ''
  if (!images.length && !description) throw new HttpError('請拍攝器械、上傳動作照片，或輸入簡短描述。', 400)

  const instruction = `你是專業健身器械與運動動作辨識助手。請根據所有照片與使用者描述，辨識照片中的主要器械，或人物正在做的主要動作，並使用台灣健身房常用的正式繁體中文名稱。

辨識規則：
1. 若是器械照片，綜合器械外型、把手、座椅、配重、運動軌跡、可見品牌與型號文字判斷；name 填最通用且專業的器械／動作名稱，例如「坐姿腿屈伸」而不是「練腿那台」。
2. 若是人物動作照片，根據身體姿勢、器材、握法與運動方向判斷動作；不要辨識或描述人物身分、年齡、外貌或其他個人特徵。
3. 同一照片可能出現多台器械或旁人，只選畫面主體。證據不足時可以採用較通用的名稱，note 說明不確定處，不可捏造品牌或型號。
4. category 只能是 lower、upper、cardio、core；inputType 只能是 strength、cardio、core。lower/upper 通常是 strength，有氧器械與持續性運動用 cardio，計時核心動作用 core。
5. target 用簡短繁體中文列出主要肌群。equipment 填器械類型或照片中可確認的品牌／型號；無法確認就填通用器械名稱。
6. confidence 填 0 到 1。照片沒有器械、沒有可辨識運動動作，或內容不清楚時 detected 必須是 false，不要硬猜。

只回傳 JSON，不要 markdown 或其他文字：
{"detected":true,"kind":"equipment或exercise","name":"正式繁體中文名稱","category":"lower","target":"股四頭肌、臀大肌","inputType":"strength","equipment":"器械或品牌型號","confidence":0.85,"note":"簡短辨識依據或不確定處"}

使用者描述：${description || '無'}`

  let text: string
  try {
    if (groqKey) {
      const content: Array<Record<string, unknown>> = [{ type: 'text', text: instruction }]
      for (const image of images) {
        content.push({ type: 'image_url', image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}` } })
      }
      text = await callGroq([
        { role: 'system', content: '你是精確、保守的健身器械與運動動作圖片辨識助手。' },
        { role: 'user', content },
      ], images.length ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant', true)
    } else {
      const parts: Array<Record<string, unknown>> = [{ text: instruction }]
      for (const image of images) parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } })
      text = await callGemini(parts, true)
    }
  } catch (error) {
    throw friendlyExerciseAiError(error)
  }

  return normalizeExerciseAnalysis(parseJson(text))
}

function friendlyExerciseAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/\b429\b|rate.?limit|quota|resource.?exhausted/i.test(message)) {
    return new HttpError('AI 圖片辨識額度暫時已達上限，請稍後再試，或先輸入器械／動作描述讓 AI 分類。', 429)
  }
  if (/\b401\b|\b403\b|api.?key|permission/i.test(message)) {
    return new HttpError('AI 圖片辨識服務目前無法使用，請先輸入器械／動作描述建立運動。', 503)
  }
  return new HttpError('AI 暫時無法辨識這張照片，請換一張清楚的照片，或改用文字描述。', 503)
}

function normalizeExerciseAnalysis(parsed: Record<string, unknown>) {
  const detected = parsed.detected !== false
  const category = ['lower', 'upper', 'cardio', 'core'].includes(String(parsed.category)) ? String(parsed.category) : 'upper'
  const inputType = category === 'cardio' ? 'cardio' : category === 'core' ? 'core' : 'strength'
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0))
  return {
    detected,
    kind: parsed.kind === 'equipment' ? 'equipment' : 'exercise',
    name: String(parsed.name || (detected ? '未命名運動' : '')).slice(0, 100),
    category,
    target: String(parsed.target || '全身肌群').slice(0, 100),
    inputType,
    equipment: String(parsed.equipment || '').slice(0, 120),
    confidence,
    note: String(parsed.note || (detected ? '由 AI 依照片辨識，請在儲存前確認。' : '照片中沒有可辨識的器械或運動動作。')).slice(0, 300),
  }
}

function getExerciseImages(body: ExerciseImageAnalysisRequest) {
  return (Array.isArray(body.images) ? body.images : []).filter(image => image?.data).slice(0, 2)
}

async function analyzeFoodWithGroq(
  body: FoodAnalysisRequest,
  instruction = foodAnalysisInstruction(),
) {
  const description = body.description?.trim()
  const images = getFoodImages(body)
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `${instruction}
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
      content: '你是營養分析助手。餐點照片是主要證據，使用者文字只是輔助。',
    },
    { role: 'user', content },
  ], images.length ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant', true)
  return normalizeFoodAnalysis(parseJson(text))
}

function normalizeFoodAnalysis(parsed: Record<string, unknown>) {
  const isFood = parsed.isFood !== false
  const dishBreakdown = Array.isArray(parsed.dishBreakdown)
    ? parsed.dishBreakdown
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const value = item as Record<string, unknown>
        return {
          name: String(value.name || '未命名食材').slice(0, 100),
          amount: String(value.amount || '').slice(0, 100),
          cooking: String(value.cooking || '').slice(0, 80),
          kcal: nutritionNumber(value.kcal),
          protein: nutritionNumber(value.protein),
          carbs: nutritionNumber(value.carbs),
          fat: nutritionNumber(value.fat),
        }
      })
      .slice(0, 12)
    : []
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
    kcalRange: isFood && Array.isArray(parsed.kcalRange)
      ? parsed.kcalRange.slice(0, 2).map(nutritionNumber)
      : [],
    protein: isFood ? nutritionNumber(parsed.protein) : 0,
    carbs: isFood ? nutritionNumber(parsed.carbs) : 0,
    fat: isFood ? nutritionNumber(parsed.fat) : 0,
    note: String(parsed.note || (isFood ? '由 AI 依照片與描述估算。' : '沒有辨識到可記錄的餐點。')).slice(0, 500),
    lookupRecommended: parsed.lookupRecommended === true,
    lookupUsed: parsed.lookupUsed === true,
    productQuery: String(parsed.productQuery || '').slice(0, 200),
    labelEvidence: String(parsed.labelEvidence || '').slice(0, 500),
    consumedAmount: String(parsed.consumedAmount || '').slice(0, 100),
    estimated: parsed.estimated === true,
    needsNutritionLabel: parsed.needsNutritionLabel === true,
    dishBreakdown,
    sources,
  }
}

const nutritionReferenceSources = [
  { title: '衛福部食藥署食品營養成分資料庫', url: 'https://consumer.fda.gov.tw/Food/TFND.aspx?nodeID=178' },
  { title: '國民健康署食物代換與份量參考', url: 'https://health.hpa.gov.tw/UploadFolder/upload/files/04_%E8%81%B7%E5%A0%B4%E5%81%A5%E5%BA%B7%E6%88%91%E7%9A%84%E9%A4%90%E7%9B%A4.pdf' },
]

function nutritionNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 10) / 10 : 0
}

function getFoodImages(body: FoodAnalysisRequest) {
  const supplied = Array.isArray(body.images) ? body.images : body.image ? [body.image] : []
  return supplied.filter(image => image?.data).slice(0, 4)
}

async function callGemini(parts: Array<Record<string, unknown>>, jsonMode = false) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: jsonMode ? 2400 : 1200,
        thinkingConfig: { thinkingLevel: 'low' },
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
      contents: [{ role: 'user', parts }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Gemini request failed: ${res.status} ${detail.slice(0, 180)}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts
    ?.filter((part: { thought?: boolean }) => part.thought !== true)
    .map((part: { text?: string }) => part.text || '')
    .join('\n')
    .trim() || ''
  if (!text) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'empty_content'
    throw new Error(`Gemini returned no usable text: ${reason}`)
  }
  return text
}

async function callGeminiGrounded(parts: Array<Record<string, unknown>>) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2400,
        thinkingConfig: { thinkingLevel: 'low' },
        responseMimeType: 'application/json',
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
  const responseText = candidate?.content?.parts
    ?.filter((part: { thought?: boolean }) => part.thought !== true)
    .map((part: { text?: string }) => part.text || '')
    .join('\n')
    .trim() || ''
  if (!responseText) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'empty_content'
    throw new Error(`Gemini grounded request returned no usable text: ${reason}`)
  }
  return {
    text: responseText,
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

async function callGroq(messages: Array<{ role: string; content: unknown }>, model = 'llama-3.1-8b-instant', jsonMode = false) {
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
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
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
