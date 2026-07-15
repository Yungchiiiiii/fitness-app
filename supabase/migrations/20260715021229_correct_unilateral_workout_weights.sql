-- Convert the user's historical per-hand dumbbell entries to total load.
-- The correction is pinned to the movement, date, set order, and original
-- weight so it cannot accidentally double an already-corrected value.

with target_user as (
  select w.user_id
  from public.workout_sessions w
  join public.session_exercises e on e.session_id = w.id
  where (e.name = '保加利亞分腿蹲' and w.date in ('2026-05-25', '2026-04-23', '2026-04-09', '2026-03-23'))
     or (e.name = '羅馬尼亞硬拉' and w.date = '2026-04-30')
  group by w.user_id
  having count(distinct case when e.name = '保加利亞分腿蹲' then w.date end) = 4
     and count(distinct case when e.name = '羅馬尼亞硬拉' then w.date end) = 1
),
corrections(exercise_name, session_date, set_order, original_weight, corrected_weight) as (
  values
    ('保加利亞分腿蹲', date '2026-05-25', 0, 16::numeric, 32::numeric),
    ('保加利亞分腿蹲', date '2026-05-25', 1, 16::numeric, 32::numeric),
    ('保加利亞分腿蹲', date '2026-05-25', 2, 16::numeric, 32::numeric),
    ('保加利亞分腿蹲', date '2026-04-23', 0,  8::numeric, 16::numeric),
    ('保加利亞分腿蹲', date '2026-04-23', 1, 12::numeric, 24::numeric),
    ('保加利亞分腿蹲', date '2026-04-23', 2, 16::numeric, 32::numeric),
    ('保加利亞分腿蹲', date '2026-04-09', 0,  8::numeric, 16::numeric),
    ('保加利亞分腿蹲', date '2026-04-09', 1, 12::numeric, 24::numeric),
    ('保加利亞分腿蹲', date '2026-04-09', 2, 16::numeric, 32::numeric),
    ('保加利亞分腿蹲', date '2026-03-23', 0,  8::numeric, 16::numeric),
    ('保加利亞分腿蹲', date '2026-03-23', 1, 12::numeric, 24::numeric),
    ('保加利亞分腿蹲', date '2026-03-23', 2, 16::numeric, 32::numeric),
    ('羅馬尼亞硬拉', date '2026-04-30', 0, 10::numeric, 20::numeric),
    ('羅馬尼亞硬拉', date '2026-04-30', 1, 15::numeric, 30::numeric)
),
target_sets as (
  select s.id, c.corrected_weight
  from target_user u
  join public.workout_sessions w on w.user_id = u.user_id
  join public.session_exercises e on e.session_id = w.id
  join public.exercise_sets s on s.exercise_id = e.id
  join corrections c
    on c.exercise_name = e.name
   and c.session_date = w.date
   and c.set_order = s.order_index
   and c.original_weight = s.weight
)
update public.exercise_sets s
set weight = target_sets.corrected_weight
from target_sets
where s.id = target_sets.id;
