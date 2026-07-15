-- 保加利亞弓箭步 and 保加利亞分腿蹲 are distinct movements.
-- Immediately before this correction, the linked database had no pre-existing
-- 保加利亞分腿蹲 history; all five rows with that label came from the preceding
-- mistaken alias migration, so restoring them does not overwrite genuine data.

update public.session_exercises
set name = '保加利亞弓箭步'
where name = '保加利亞分腿蹲';
