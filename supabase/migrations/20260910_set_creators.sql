-- REVIEW REQUIRED: run in Supabase SQL Editor only after project-owner approval.
-- Additive only: no existing IDs, BGM arrays, rows or RLS policies are changed.
begin;
alter table public.bgm_sets
  add column if not exists creator_id uuid references auth.users(id) on delete set null,
  add column if not exists creator_name text;
-- Old anonymous sets intentionally retain NULL; ownership cannot be inferred.
comment on column public.bgm_sets.creator_name is 'Validated name entered at publication; legacy anonymous sets remain NULL';
notify pgrst, 'reload schema';
commit;
