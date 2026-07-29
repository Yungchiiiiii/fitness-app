export type SharedServing = { diners: number; fraction: number }
export type NutritionAudit = {
  score: number
  issues: string[]
  repeatedTemplate: boolean
  shouldRecheck: boolean
}

type NutritionAuditOptions = {
  requireBreakdown?: boolean
  recent?: Array<Record<string, unknown>>
}

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
  const peopleMatch = normalized.match(/([0-9一二兩三四五六七八九十]+)(?:個|位)?人(?:(?:一起|共同|平分|分食|分享|分著))*(?:吃|食用|享用)?/)
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
  const kcal = !analysis.labelEvidence && macroKcal > 0 && (statedKcal < macroKcal * 0.72 || statedKcal > macroKcal * 1.28)
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

export function auditNutrition(
  analysis: Record<string, unknown>,
  { requireBreakdown = false, recent = [] }: NutritionAuditOptions = {},
): NutritionAudit {
  if (analysis.isFood === false) {
    return { score: 100, issues: [], repeatedTemplate: false, shouldRecheck: false }
  }

  const issues: string[] = []
  const kcal = nutritionNumber(analysis.kcal)
  const protein = nutritionNumber(analysis.protein)
  const carbs = nutritionNumber(analysis.carbs)
  const fat = nutritionNumber(analysis.fat)
  const macroKcal = protein * 4 + carbs * 4 + fat * 9
  const breakdown = Array.isArray(analysis.dishBreakdown)
    ? analysis.dishBreakdown.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>
    : []
  const breakdownKcal = breakdown.reduce((sum, item) => sum + nutritionNumber(item.kcal), 0)
  const range = Array.isArray(analysis.kcalRange) ? analysis.kcalRange.map(nutritionNumber) : []

  if (kcal <= 0 || macroKcal <= 0) issues.push('missing_nutrition')
  if (kcal > 0 && macroKcal > 0 && relativeDifference(kcal, macroKcal) > 0.28) {
    issues.push('macro_calorie_mismatch')
  }
  if (requireBreakdown && breakdown.length === 0) issues.push('missing_breakdown')
  if (breakdown.length > 0 && breakdownKcal > 0 && relativeDifference(kcal, breakdownKcal) > 0.3) {
    issues.push('breakdown_total_mismatch')
  }
  if (range.length === 2 && range[0] > 0 && (range[0] > kcal || range[1] < kcal)) {
    issues.push('range_excludes_result')
  }

  const candidateName = normalizedFoodName(analysis.name)
  const roundedTemplate = isMultipleOf(kcal, 10)
    && [protein, carbs, fat].filter(value => isMultipleOf(value, 5)).length >= 2
  const matchingRecentNames = new Set(recent
    .filter(item => Math.round(nutritionNumber(item.kcal)) === Math.round(kcal))
    .map(item => normalizedFoodName(item.name))
    .filter(name => name && name !== candidateName))
  const repeatedTemplate = roundedTemplate && matchingRecentNames.size >= 2
  if (repeatedTemplate) issues.push('repeated_cross_meal_template')

  const penalties: Record<string, number> = {
    missing_nutrition: 80,
    macro_calorie_mismatch: 28,
    missing_breakdown: 24,
    breakdown_total_mismatch: 28,
    range_excludes_result: 10,
    repeated_cross_meal_template: 36,
  }
  const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + (penalties[issue] || 0), 0))
  return {
    score,
    issues,
    repeatedTemplate,
    shouldRecheck: issues.some(issue => issue !== 'range_excludes_result'),
  }
}

export function shouldUseCorrectedNutrition(primary: NutritionAudit, corrected: NutritionAudit) {
  if (corrected.issues.includes('missing_nutrition')) return false
  if (primary.repeatedTemplate && !corrected.repeatedTemplate) return true
  return corrected.score >= primary.score
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

function relativeDifference(first: number, second: number) {
  return Math.abs(first - second) / Math.max(first, second, 1)
}

function isMultipleOf(value: number, step: number) {
  return value > 0 && Math.abs(value / step - Math.round(value / step)) < 0.001
}

function normalizedFoodName(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[（(]\d+\/\d+\s*份?[）)]/g, '')
    .replace(/[\s、，,。．\-_/＋+]/g, '')
}
