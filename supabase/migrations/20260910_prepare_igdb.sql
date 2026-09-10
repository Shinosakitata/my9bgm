-- My9BGM: RAWG / IGDB coexistence.
-- Run manually in the Supabase SQL Editor after review.
-- No UPDATE, DELETE, backfill, ID conversion, RLS or RPC changes.
-- A duplicate-key or lock error aborts the entire transaction.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Existing BGM rows retain all values; their new IGDB ID remains NULL.
ALTER TABLE public.bgms
  ADD COLUMN IF NOT EXISTS igdb_game_id bigint;

-- Already present in the inspected database; included for repeatability.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS igdb_game_id bigint;

-- IGDB-only games have no RAWG ID. Preserve existing RAWG IDs and indexes.
ALTER TABLE public.games
  ALTER COLUMN rawg_game_id DROP NOT NULL;

-- Never merge games by title or by coincidentally equal provider IDs.
-- Existing conflicting mappings cause an error, not automatic data changes.
CREATE UNIQUE INDEX IF NOT EXISTS games_igdb_game_id_unique
  ON public.games (igdb_game_id)
  WHERE igdb_game_id IS NOT NULL;

-- Keep the existing RAWG-based duplicate protection as well.
CREATE UNIQUE INDEX IF NOT EXISTS bgms_igdb_normalized_title_unique
  ON public.bgms (igdb_game_id, normalized_title)
  WHERE igdb_game_id IS NOT NULL;

COMMIT;

-- Read-only verification: bgms.igdb_game_id and both games provider IDs
-- should be nullable. No existing game or BGM is linked automatically.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('bgms', 'games')
  AND column_name IN ('rawg_game_id', 'igdb_game_id')
ORDER BY table_name, column_name;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'games_igdb_game_id_unique',
    'bgms_igdb_normalized_title_unique'
  )
ORDER BY tablename, indexname;
