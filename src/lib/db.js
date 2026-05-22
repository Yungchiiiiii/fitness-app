import { supabase } from './supabase'

// ── Auth ──────────────────────────────────────────────
export const signUp = (email, password, name) =>
  supabase.auth.signUp({ email, password, options: { data: { name } } })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getUser = () => supabase.auth.getUser()

// ── Profile ───────────────────────────────────────────
export const getProfile = (userId) =>
  supabase.from('profiles').select('*').eq('id', userId).single()

export const upsertProfile = (profile) =>
  supabase.from('profiles').upsert(profile)

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

export const createFoodLog = (log) =>
  supabase.from('food_logs').insert(log).select().single()

export const deleteFoodLog = (id) =>
  supabase.from('food_logs').delete().eq('id', id)

// ── Custom Exercises ──────────────────────────────────
export const getCustomExercises = (userId) =>
  supabase.from('custom_exercises').select('*').eq('user_id', userId)

export const createCustomExercise = (ex) =>
  supabase.from('custom_exercises').insert(ex).select().single()

export const deleteCustomExercise = (id) =>
  supabase.from('custom_exercises').delete().eq('id', id)
