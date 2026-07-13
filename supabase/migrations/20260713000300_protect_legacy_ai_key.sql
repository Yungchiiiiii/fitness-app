-- Keep the legacy column for backward compatibility, but never expose it through the API.
revoke select, insert, update on public.profiles from anon, authenticated;
grant select (
  id, display_name, height_cm, weight_kg, targets, training_days,
  calories_target, protein_target, carbs_target, fat_target,
  name, weight, height, goal, calorie_target, carb_target, created_at, updated_at
) on public.profiles to authenticated;
grant insert (
  id, display_name, height_cm, weight_kg, targets, training_days,
  calories_target, protein_target, carbs_target, fat_target,
  name, weight, height, goal, calorie_target, carb_target, created_at, updated_at
) on public.profiles to authenticated;
grant update (
  display_name, height_cm, weight_kg, targets, training_days,
  calories_target, protein_target, carbs_target, fat_target,
  name, weight, height, goal, calorie_target, carb_target, updated_at
) on public.profiles to authenticated;
