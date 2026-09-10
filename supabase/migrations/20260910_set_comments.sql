-- REVIEW REQUIRED: run in Supabase SQL Editor only after project-owner approval.
-- Additive only. Existing sets remain readable without comments.
begin;
alter table public.bgm_sets
  add column if not exists comments text[] not null default array_fill(''::text, array[9]);

alter table public.bgm_sets
  add constraint bgm_sets_comments_length_check
  check (array_length(comments, 1) = 9) not valid;

comment on column public.bgm_sets.comments is 'Comments aligned with bgm_ids; legacy sets default to nine empty strings';
notify pgrst, 'reload schema';
commit;
