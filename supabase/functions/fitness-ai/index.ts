const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type FoodAnalysisRequest = {
  task: 'food-analysis'
  description?: string
  image?: { mimeType: string; data: string } | null
}

type CoachChatRequest = {
  task: 'coach-chat'
  prompt: string
  context?: unknown
}

const geminiKey = Deno.env.get('GEMINI_API_KEY')
const groqKey = Deno.env.get('GROQ_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as FoodAnalysisRequest | CoachChatRequest

    if (body.task === 'food-analysis') return json({ meal: await analyzeFood(body) })
    if (body.task === 'coach-chat') return json({ reply: await coachReply(body) })
    return json({ error: 'Unknown task' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

async function analyzeFood(body: FoodAnalysisRequest) {
  if (groqKey) {
    return analyzeFoodWithGroq(body)
  }
  if (!geminiKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  const parts: Array<Record<string, unknown>> = [{
    text: `你是營養分析助手。根據照片與使用者描述估算餐點營養。
只回傳 JSON，不要 markdown，不要多餘文字。
格式：
{"meal":"早餐/午餐/晚餐/點心","name":"餐點名稱","kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"note":"一句估算依據"}
使用者描述：${body.description || '無'}`,
  }]

  if (body.image?.data) {
    parts.push({
      inline_data: {
        mime_type: body.image.mimeType || 'image/jpeg',
        data: body.image.data,
      },
    })
  }

  const parsed = parseJson(await callGemini(parts))
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

async function coachReply(body: CoachChatRequest) {
  if (groqKey) {
    return callGroq([
      {
        role: 'system',
        content: `你是繁體中文健身、營養與恢復教練。請回答得具體、可執行、保守安全。
不能診斷疾病；如果使用者描述受傷、劇痛、腫脹、無法負重、麻木或症狀惡化，要建議就醫或找物理治療師。
回答 3 到 6 點，避免空泛。請參考 app 內資料：${JSON.stringify(body.context || {})}`,
      },
      { role: 'user', content: body.prompt },
    ])
  }
  if (!geminiKey) throw new Error('Server missing GEMINI_API_KEY or GROQ_API_KEY')
  return (await callGemini([{
    text: `你是繁體中文健身、營養與恢復教練。
請回答得具體、可執行、保守安全，並參考 app 內資料。
不能診斷疾病；如果使用者描述受傷、劇痛、腫脹、無法負重、麻木或症狀惡化，要建議就醫或找物理治療師。
回答 3 到 6 點，避免空泛。

App 內資料：
${JSON.stringify(body.context || {})}

使用者問題：
${body.prompt}`,
  }])).trim()
}

async function analyzeFoodWithGroq(body: FoodAnalysisRequest) {
  const description = body.description?.trim()
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `請分析這份餐點。使用者補充描述：${description || '無'}。
只回傳 JSON，不要 markdown，不要多餘文字。
格式：
{"meal":"早餐/午餐/晚餐/點心","name":"餐點名稱","kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"note":"一句估算依據"}`,
    },
  ]

  if (body.image?.data) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${body.image.mimeType || 'image/jpeg'};base64,${body.image.data}`,
      },
    })
  }

  const text = await callGroq([
    {
      role: 'system',
      content: '你是營養分析助手。你可以根據餐點照片與文字描述估算營養。',
    },
    { role: 'user', content },
  ], body.image?.data ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant')
  const parsed = parseJson(text)
  return {
    meal: parsed.meal || '餐點',
    name: parsed.name || 'AI 估算餐點',
    kcal: Number(parsed.kcal) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fat: Number(parsed.fat) || 0,
    note: parsed.note || '由 AI 依文字描述估算。',
  }
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
