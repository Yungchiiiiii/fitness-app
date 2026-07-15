import assert from 'node:assert/strict'
import test from 'node:test'
import { applySharedServing, parseSharedServing, stabilizeNutrition } from '../supabase/functions/fitness-ai/nutrition.ts'

test('parses common Chinese shared-meal notes', () => {
  assert.deepEqual(parseSharedServing('這盤三個人吃'), { diners: 3, fraction: 1 / 3 })
  assert.deepEqual(parseSharedServing('3 人一起平分'), { diners: 3, fraction: 1 / 3 })
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
