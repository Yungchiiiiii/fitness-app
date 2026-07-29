import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySharedServing,
  auditNutrition,
  parseSharedServing,
  shouldUseCorrectedNutrition,
  stabilizeNutrition,
} from '../supabase/functions/fitness-ai/nutrition.ts'

test('parses common Chinese shared-meal notes', () => {
  assert.deepEqual(parseSharedServing('這盤三個人吃'), { diners: 3, fraction: 1 / 3 })
  assert.deepEqual(parseSharedServing('3 人一起平分'), { diners: 3, fraction: 1 / 3 })
  assert.deepEqual(parseSharedServing('三個人平分一起吃'), { diners: 3, fraction: 1 / 3 })
  assert.deepEqual(parseSharedServing('我只吃 1/3 份'), { diners: 3, fraction: 1 / 3 })
  assert.equal(parseSharedServing('我一個人吃'), null)
})

test('forces calories and macros to the recorded share', () => {
  const result = applySharedServing({
    isFood: true,
    name: '大腸豆皮兩份',
    kcal: 900,
    protein: 30,
    carbs: 60,
    fat: 60,
    kcalRange: [750, 1050],
    note: '整盤一般份量估算',
  }, { diners: 3, fraction: 1 / 3 })
  assert.equal(result.kcal, 300)
  assert.equal(result.protein, 10)
  assert.deepEqual(result.kcalRange, [250, 350])
  assert.match(String(result.note), /3 人平分/)
})

test('repairs a calorie total that conflicts sharply with its macros', () => {
  const result = stabilizeNutrition({ isFood: true, kcal: 1200, protein: 30, carbs: 80, fat: 20, labelEvidence: '' })
  assert.equal(result.kcal, 620)
  assert.deepEqual(result.kcalRange, [500, 740])
})

test('keeps calories read from a nutrition label instead of replacing them', () => {
  const result = stabilizeNutrition({ isFood: true, kcal: 227, protein: 2.4, carbs: 28.4, fat: 11.5, labelEvidence: '每份 227 kcal' })
  assert.equal(result.kcal, 227)
})

test('flags a rounded calorie template repeated across different meals', () => {
  const audit = auditNutrition({
    isFood: true,
    name: '蔥爆豬柳便當',
    kcal: 550,
    protein: 35,
    carbs: 60,
    fat: 25,
    dishBreakdown: [],
  }, {
    requireBreakdown: true,
    recent: [
      { name: '福隆便當', kcal: 550 },
      { name: '三寶飯便當', kcal: 550 },
    ],
  })
  assert.equal(audit.repeatedTemplate, true)
  assert.equal(audit.shouldRecheck, true)
  assert.ok(audit.issues.includes('missing_breakdown'))
  assert.ok(audit.issues.includes('repeated_cross_meal_template'))
})

test('accepts a detailed estimate whose item and macro totals agree', () => {
  const audit = auditNutrition({
    isFood: true,
    name: '雞肉飯與青菜',
    kcal: 535,
    kcalRange: [450, 620],
    protein: 33,
    carbs: 62,
    fat: 17,
    dishBreakdown: [
      { name: '雞肉', kcal: 230 },
      { name: '白飯', kcal: 235 },
      { name: '青菜與用油', kcal: 70 },
    ],
  }, { requireBreakdown: true })
  assert.equal(audit.shouldRecheck, false)
  assert.equal(audit.score, 100)
})

test('prefers a corrected estimate that removes a repeated template', () => {
  const primary = { score: 40, issues: ['repeated_cross_meal_template'], repeatedTemplate: true, shouldRecheck: true }
  const corrected = { score: 90, issues: [], repeatedTemplate: false, shouldRecheck: false }
  assert.equal(shouldUseCorrectedNutrition(primary, corrected), true)
})
