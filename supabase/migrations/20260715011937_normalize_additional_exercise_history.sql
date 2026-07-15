-- Merge only labels that have an unambiguous equivalent in the current library.
-- Less certain historical names remain unchanged and are surfaced dynamically by the app.

update public.session_exercises exercise
set name = aliases.canonical_name
from (values
  ('保加利亞弓箭步', '保加利亞分腿蹲'),
  ('坐姿內收機', '髖內收'),
  ('坐姿腿伸展機', '腿伸展'),
  ('槓桿坐姿腿彎舉', '坐姿腿彎舉')
) as aliases(legacy_name, canonical_name)
where exercise.name = aliases.legacy_name;

delete from public.custom_exercises legacy
using (values
  ('保加利亞弓箭步', '保加利亞分腿蹲'),
  ('坐姿內收機', '髖內收'),
  ('坐姿腿伸展機', '腿伸展'),
  ('槓桿坐姿腿彎舉', '坐姿腿彎舉')
) as aliases(legacy_name, canonical_name)
where legacy.name = aliases.legacy_name
  and exists (
    select 1
    from public.custom_exercises canonical
    where canonical.user_id = legacy.user_id
      and canonical.name = aliases.canonical_name
  );

update public.custom_exercises exercise
set name = aliases.canonical_name
from (values
  ('保加利亞弓箭步', '保加利亞分腿蹲'),
  ('坐姿內收機', '髖內收'),
  ('坐姿腿伸展機', '腿伸展'),
  ('槓桿坐姿腿彎舉', '坐姿腿彎舉')
) as aliases(legacy_name, canonical_name)
where exercise.name = aliases.legacy_name;
