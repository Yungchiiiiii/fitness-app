-- Keep AI event logging compatible with every task handled by fitness-ai.
alter table public.ai_events
drop constraint if exists ai_events_kind_check;

alter table public.ai_events
add constraint ai_events_kind_check check (kind in (
  'food-analysis',
  'coach-chat',
  'exercise-classification',
  'exercise-image-analysis',
  'daily-nutrition-advice'
));
