export const emptyProfileGoals = {
  height: '',
  weight: '',
  targets: [],
  trainingDays: 3,
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
}

export const profileToGoals = profile => ({
  height: profile?.height_cm ?? '',
  weight: profile?.weight_kg ?? '',
  targets: profile?.targets || [],
  trainingDays: profile?.training_days ?? 3,
  calories: profile?.calories_target ?? '',
  protein: profile?.protein_target ?? '',
  carbs: profile?.carbs_target ?? '',
  fat: profile?.fat_target ?? '',
})

export const isProfileComplete = profile => Boolean(
  profile?.display_name?.trim()
  && Number(profile?.height_cm) > 0
  && Number(profile?.weight_kg) > 0
  && profile?.targets?.length
  && Number(profile?.calories_target) > 0
  && Number(profile?.protein_target) > 0
  && Number(profile?.carbs_target) > 0
  && Number(profile?.fat_target) > 0
)

export const calculateNutritionTargets = goals => {
  const height = Number(goals.height)
  const weight = Number(goals.weight)
  const trainingDays = Math.max(1, Math.min(7, Number(goals.trainingDays) || 3))
  const targets = new Set(goals.targets || [])
  const heightAdjustment = Math.max(-100, Math.min(100, (height - 165) * 3))
  const activityAdjustment = (trainingDays - 3) * 70
  const goalAdjustment = (targets.has('減脂') ? -300 : 0)
    + (targets.has('增肌') ? 250 : 0)
    + (targets.has('提升運動表現') ? 100 : 0)
  const calories = Math.max(1200, Math.round((weight * 30 + heightAdjustment + activityAdjustment + goalAdjustment) / 10) * 10)
  const proteinMultiplier = targets.has('增肌') || targets.has('減脂') ? 2 : 1.7
  const protein = Math.round(weight * proteinMultiplier)
  const fat = Math.round(weight * 0.8)
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4))

  return { ...goals, trainingDays, calories, protein, carbs, fat }
}

export const profilePayload = (userId, name, goals) => ({
  id: userId,
  display_name: name.trim(),
  height_cm: Number(goals.height),
  weight_kg: Number(goals.weight),
  targets: goals.targets || [],
  training_days: Math.max(1, Math.min(7, Number(goals.trainingDays) || 3)),
  calories_target: Number(goals.calories),
  protein_target: Number(goals.protein),
  carbs_target: Number(goals.carbs),
  fat_target: Number(goals.fat),
})
