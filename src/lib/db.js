import { supabase } from './supabase'

// ── Profile ───────────────────────────────────────────
export const getProfile = (userId) =>
  supabase
    .from('profiles')
    .select('id, display_name, height_cm, weight_kg, targets, training_days, calories_target, protein_target, carbs_target, fat_target, profile_setup_version, name, weight, height, goal, calorie_target, carb_target, created_at, updated_at')
    .eq('id', userId)
    .single()

export const updateProfile = ({ id, ...updates }) =>
  supabase.from('profiles').update(updates).eq('id', id).select('id').single()

export const upsertProfile = (profile) =>
  supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select('id, display_name, height_cm, weight_kg, targets, training_days, calories_target, protein_target, carbs_target, fat_target, profile_setup_version, created_at, updated_at')
    .single()

// ── Workout Sessions ──────────────────────────────────
export const getSessions = (userId) =>
  supabase
    .from('workout_sessions')
    .select(`*, session_exercises(*, exercise_sets(*))`)
    .eq('user_id', userId)
    .order('date', { ascending: false })

export const createSession = (session) =>
  supabase.from('workout_sessions').insert(session).select().single()

export const updateSession = (id, updates) =>
  supabase.from('workout_sessions').update(updates).eq('id', id)

export const deleteSession = (id) =>
  supabase.from('workout_sessions').delete().eq('id', id)

// ── Exercises ─────────────────────────────────────────
export const createExercise = (exercise) =>
  supabase.from('session_exercises').insert(exercise).select().single()

export const updateExercise = (id, updates) =>
  supabase.from('session_exercises').update(updates).eq('id', id)

export const deleteExercise = (id) =>
  supabase.from('session_exercises').delete().eq('id', id)

export const deleteExerciseHistory = async (userId, exerciseName) => {
  const { data: sessions, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
  if (sessionsError) return { error: sessionsError }

  const sessionIds = (sessions || []).map(session => session.id)
  if (!sessionIds.length) return { error: null }

  const { data: deleted, error: deleteError } = await supabase
    .from('session_exercises')
    .delete()
    .eq('name', exerciseName)
    .in('session_id', sessionIds)
    .select('session_id')
  if (deleteError) return { error: deleteError }

  const affectedSessionIds = [...new Set((deleted || []).map(exercise => exercise.session_id))]
  if (!affectedSessionIds.length) return { error: null }

  const { data: remaining, error: remainingError } = await supabase
    .from('session_exercises')
    .select('session_id')
    .in('session_id', affectedSessionIds)
  if (remainingError) return { error: remainingError }

  const sessionsWithExercises = new Set((remaining || []).map(exercise => exercise.session_id))
  const emptySessionIds = affectedSessionIds.filter(id => !sessionsWithExercises.has(id))
  if (!emptySessionIds.length) return { error: null }

  const { error: emptySessionError } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
    .in('id', emptySessionIds)
  return { error: emptySessionError }
}

// ── Sets ──────────────────────────────────────────────
export const createSet = (set) =>
  supabase.from('exercise_sets').insert(set).select().single()

export const updateSet = (id, updates) =>
  supabase.from('exercise_sets').update(updates).eq('id', id)

export const deleteSet = (id) =>
  supabase.from('exercise_sets').delete().eq('id', id)

// ── Food Logs ─────────────────────────────────────────
export const getFoodLogs = (userId, date) =>
  supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('logged_at', { ascending: true })

export const getFoodLogsRange = (userId, from, to) =>
  supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('logged_at', { ascending: true })

export const createFoodLog = (log) =>
  supabase.from('food_logs').insert(log).select().single()

export const deleteFoodLog = (id) =>
  supabase.from('food_logs').delete().eq('id', id)

export const getDailyNutrition = (userId, from, to) =>
  supabase
    .from('v_daily_nutrition')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

// ── Frequent foods ───────────────────────────────────
export const getFrequentFoods = (userId) =>
  supabase
    .from('frequent_foods')
    .select('*')
    .eq('user_id', userId)
    .order('meal', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

export const createFrequentFood = (food) =>
  supabase.from('frequent_foods').insert(food).select().single()

export const updateFrequentFood = (id, updates) =>
  supabase.from('frequent_foods').update(updates).eq('id', id).select().single()

export const deleteFrequentFood = (id) =>
  supabase.from('frequent_foods').delete().eq('id', id)

export const getFrequentFoodsInitialized = (userId) =>
  supabase.from('profiles').select('frequent_foods_initialized').eq('id', userId).single()

export const initializeFrequentFoods = async (userId, foods) => {
  const rows = foods.map((food, index) => ({ ...food, user_id: userId, sort_order: index }))
  const insertResult = await supabase.from('frequent_foods').upsert(rows, { onConflict: 'user_id,meal,name' })
  if (insertResult.error) return insertResult
  return supabase.from('profiles').update({ frequent_foods_initialized: true }).eq('id', userId)
}

export const getExerciseProgress = (userId, exerciseName) => {
  let query = supabase
    .from('v_exercise_progress')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  if (exerciseName) query = query.eq('exercise_name', exerciseName)
  return query
}

export const getWeeklyTrainingSummary = (userId) =>
  supabase
    .from('v_weekly_training_summary')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })

// ── Body weight / recovery ───────────────────────────
export const getWeightLogs = (userId) =>
  supabase
    .from('body_weight_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

export const upsertWeightLog = (log) =>
  supabase.from('body_weight_logs').upsert(log, { onConflict: 'user_id,date' }).select().single()

export const getRecoveryLogs = (userId, from) => {
  let query = supabase
    .from('recovery_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (from) query = query.gte('date', from)
  return query
}

export const createRecoveryLog = (log) =>
  supabase.from('recovery_logs').insert(log).select().single()

export const getAiEvents = (userId, kind) => {
  let query = supabase
    .from('ai_events')
    .select('id, kind, input, output, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (kind) query = query.eq('kind', kind)
  return query
}

// ── Custom Exercises ──────────────────────────────────
export const getCustomExercises = (userId) =>
  supabase.from('custom_exercises').select('*').eq('user_id', userId)

export const createCustomExercise = (ex) =>
  supabase.from('custom_exercises').insert(ex).select().single()

export const updateCustomExercise = (id, updates) =>
  supabase.from('custom_exercises').update(updates).eq('id', id).select().single()

export const deleteCustomExercise = (id) =>
  supabase.from('custom_exercises').delete().eq('id', id)

export const getHiddenExercises = (userId) =>
  supabase.from('hidden_exercises').select('exercise_name').eq('user_id', userId)

export const hideExercise = (userId, exerciseName) =>
  supabase.from('hidden_exercises').insert({ user_id: userId, exercise_name: exerciseName })
