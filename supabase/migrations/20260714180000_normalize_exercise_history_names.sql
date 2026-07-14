-- Merge only unambiguous legacy labels into the current exercise library.
-- Historical sets stay attached, so charts and AI coaching see one history.

update public.session_exercises
set name = case name
  when '器械胸推' then '坐姿胸推'
  when '機械胸推' then '坐姿胸推'
  when '胸推機' then '坐姿胸推'
  when '器械肩推' then '肩推機'
  when '機械肩推' then '肩推機'
  when '蝴蝶機' then '蝴蝶機夾胸'
  when '蝴蝶夾胸' then '蝴蝶機夾胸'
  when '外展機' then '髖外展'
  when '髖外展機' then '髖外展'
  when '內收機' then '髖內收'
  when '髖內收機' then '髖內收'
  when '腿屈伸' then '腿伸展'
  when '腿伸展機' then '腿伸展'
  when '坐姿腿後勾' then '坐姿腿彎舉'
  else name
end
where name in (
  '器械胸推', '機械胸推', '胸推機',
  '器械肩推', '機械肩推',
  '蝴蝶機', '蝴蝶夾胸',
  '外展機', '髖外展機', '內收機', '髖內收機',
  '腿屈伸', '腿伸展機', '坐姿腿後勾'
);

-- Remove only duplicate custom aliases when the canonical name already exists.
delete from public.custom_exercises legacy
where legacy.name in (
  '器械胸推', '機械胸推', '胸推機',
  '器械肩推', '機械肩推',
  '蝴蝶機', '蝴蝶夾胸',
  '外展機', '髖外展機', '內收機', '髖內收機',
  '腿屈伸', '腿伸展機', '坐姿腿後勾'
)
and exists (
  select 1
  from public.custom_exercises canonical
  where canonical.user_id = legacy.user_id
    and canonical.name = case legacy.name
      when '器械胸推' then '坐姿胸推'
      when '機械胸推' then '坐姿胸推'
      when '胸推機' then '坐姿胸推'
      when '器械肩推' then '肩推機'
      when '機械肩推' then '肩推機'
      when '蝴蝶機' then '蝴蝶機夾胸'
      when '蝴蝶夾胸' then '蝴蝶機夾胸'
      when '外展機' then '髖外展'
      when '髖外展機' then '髖外展'
      when '內收機' then '髖內收'
      when '髖內收機' then '髖內收'
      when '腿屈伸' then '腿伸展'
      when '腿伸展機' then '腿伸展'
      when '坐姿腿後勾' then '坐姿腿彎舉'
    end
);

update public.custom_exercises
set name = case name
  when '器械胸推' then '坐姿胸推'
  when '機械胸推' then '坐姿胸推'
  when '胸推機' then '坐姿胸推'
  when '器械肩推' then '肩推機'
  when '機械肩推' then '肩推機'
  when '蝴蝶機' then '蝴蝶機夾胸'
  when '蝴蝶夾胸' then '蝴蝶機夾胸'
  when '外展機' then '髖外展'
  when '髖外展機' then '髖外展'
  when '內收機' then '髖內收'
  when '髖內收機' then '髖內收'
  when '腿屈伸' then '腿伸展'
  when '腿伸展機' then '腿伸展'
  when '坐姿腿後勾' then '坐姿腿彎舉'
  else name
end
where name in (
  '器械胸推', '機械胸推', '胸推機',
  '器械肩推', '機械肩推',
  '蝴蝶機', '蝴蝶夾胸',
  '外展機', '髖外展機', '內收機', '髖內收機',
  '腿屈伸', '腿伸展機', '坐姿腿後勾'
);
