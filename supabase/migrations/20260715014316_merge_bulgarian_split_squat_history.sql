-- The user's historical label "保加利亞弓箭步" described the same supported-leg
-- movement as "保加利亞分腿蹲". Merge the legacy label everywhere it can affect
-- exercise history, custom lists, or hidden-list preferences.

update public.session_exercises
set name = '保加利亞分腿蹲'
where name = '保加利亞弓箭步';

delete from public.custom_exercises legacy
where legacy.name = '保加利亞弓箭步'
  and exists (
    select 1
    from public.custom_exercises canonical
    where canonical.user_id = legacy.user_id
      and canonical.name = '保加利亞分腿蹲'
  );

update public.custom_exercises
set name = '保加利亞分腿蹲'
where name = '保加利亞弓箭步';

delete from public.hidden_exercises legacy
where legacy.exercise_name = '保加利亞弓箭步'
  and exists (
    select 1
    from public.hidden_exercises canonical
    where canonical.user_id = legacy.user_id
      and canonical.exercise_name = '保加利亞分腿蹲'
  );

update public.hidden_exercises
set exercise_name = '保加利亞分腿蹲'
where exercise_name = '保加利亞弓箭步';
