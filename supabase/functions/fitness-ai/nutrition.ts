export type SharedServing = { diners: number; fraction: number }

const chineseDigits: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

export function parseSharedServing(description = ''): SharedServing | null {
  const normalized = description
    .replace(/[０-９]/g, character => String(character.charCodeAt(0) - 65248))
    .replace(/\s+/g, '')
  const explicitFraction = normalized.match(/(?:我|本人)?(?:吃|食用|享用|分到|份量(?:是|為)?)?(\d+)\/(\d+)(?:份|盤|量)?/)
  if (explicitFraction) {
    const numerator = Number(explicitFraction[1])
    const denominator = Number(explicitFraction[2])
    if (numerator > 0 && denominator > numerator && denominator <= 20) return { diners: denominator, fraction: numerator / denominator }
  }
  const peopleMatch = normalized.match(/([0-9一二兩三四五六七八九十]+)(?:個|位)?人(?:一起|共同|平分|分食|分享|分著)?(?:吃|食用|享用)?/)
    || normalized.match(/(?:給|供)([0-9一二兩三四五六七八九十]+)(?:個|位)?人/)
  if (!peopleMatch) return null
  const diners = parseChineseNumber(peopleMatch[1])
  return diners > 1 && diners <= 20 ? { diners, fraction: 1 / diners } : null
}

export function applySharedServing<T extends Record<string, unknown>>(analysis: T, shared: SharedServing | null): T {
  if (!shared || analysis.isFood === false) return analysis
  const wholeDishKcal = nutritionNumber(analysis.kcal)
  const scale = (value: unknown, integer = false) => {
    const scaled = nutritionNumber(value) * shared.fraction
    return integer ? Math.round(scaled) : Math.round(scaled * 10) / 10
  }
  const range = Array.isArray(analysis.kcalRange) ? analysis.kcalRange : []
  const portionLabel = `${Math.round(shared.fraction * shared.diners)}/${shared.diners}`
  const existingNote = String(analysis.note || '').replace(/；+$/, '')
  return {
    ...analysis,
    name: `${String(analysis.name || '未命名餐點').replace(/（?\d+\/\d+\s*份）?$/, '')}（${portionLabel} 份）`,
    kcal: scale(analysis.kcal, true),
    protein: scale(analysis.protein),
    carbs: scale(analysis.carbs),
    fat: scale(analysis.fat),
    kcalRange: range.length === 2 ? [scale(range[0], true), scale(range[1], true)] : [],
    wholeDishKcal,
    shareCount: shared.diners,
    servingFraction: shared.fraction,
    note: `整盤估算 ${Math.round(wholeDishKcal)} kcal，${shared.diners} 人平分，已記錄 ${portionLabel}（${scale(analysis.kcal, true)} kcal）；${existingNote}`.slice(0, 500),
  }
}

export function stabilizeNutrition<T extends Record<string, unknown>>(analysis: T): T {
  if (analysis.isFood === false) return analysis
  const protein = nutritionNumber(analysis.protein)
  const carbs = nutritionNumber(analysis.carbs)
  const fat = nutritionNumber(analysis.fat)
  const statedKcal = nutritionNumber(analysis.kcal)
  const macroKcal = protein * 4 + carbs * 4 + fat * 9
  const kcal = macroKcal > 0 && (statedKcal < macroKcal * 0.72 || statedKcal > macroKcal * 1.28)
    ? Math.round(macroKcal / 10) * 10
    : Math.round(statedKcal)
  const suppliedRange = Array.isArray(analysis.kcalRange) ? analysis.kcalRange.map(nutritionNumber) : []
  const spread = analysis.labelEvidence ? 0.05 : 0.2
  const low = suppliedRange.length === 2 && suppliedRange[0] > 0 ? suppliedRange[0] : kcal * (1 - spread)
  const high = suppliedRange.length === 2 && suppliedRange[1] >= low ? suppliedRange[1] : kcal * (1 + spread)
  return {
    ...analysis, kcal, protein, carbs, fat,
    kcalRange: [Math.max(0, Math.round(low / 10) * 10), Math.max(0, Math.round(high / 10) * 10)],
  }
}

function parseChineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value)
  if (value === '十') return 10
  if (value.includes('十')) {
    const [tens, ones] = value.split('十')
    return (chineseDigits[tens] || 1) * 10 + (chineseDigits[ones] || 0)
  }
  return chineseDigits[value] || 0
}

function nutritionNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 10) / 10 : 0
}
