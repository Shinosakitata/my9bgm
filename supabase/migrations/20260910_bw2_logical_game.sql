-- Review before applying to production.
-- Reuses the existing My9BGM game id=6 and preserves every BGM/public-set ID.
begin;

do $guard$
begin
  if not exists (
    select 1 from public.games
    where id = 6
      and name = 'Pokémon Black 2, White 2'
      and rawg_game_id = 331454
  ) then
    raise exception 'Expected legacy BW2 game id=6 was not found';
  end if;

  if (select count(*) from public.bgms where id in (4, 211)) <> 2 then
    raise exception 'Expected BW2 BGM ids 4 and 211 were not both found';
  end if;

  if exists (
    select 1
    from public.game_external_ids
    where provider = 'igdb'
      and external_id in (8284, 8353)
      and game_id <> 6
  ) then
    raise exception 'A BW2 IGDB ID is already assigned to another logical game';
  end if;
end
$guard$;

update public.games
set name = 'ポケットモンスター ブラック2・ホワイト2',
    normalized_name = 'ポケットモンスターブラック2ホワイト2',
    updated_at = now()
where id = 6;

insert into public.game_external_ids (game_id, provider, external_id)
values
  (6, 'igdb', 8284),
  (6, 'igdb', 8353)
on conflict (provider, external_id) do nothing;

insert into public.game_aliases (game_id, alias, normalized_alias, source)
values
  (6, 'ポケットモンスター ブラック2・ホワイト2', 'ポケットモンスターブラック2ホワイト2', 'logical-game'),
  (6, 'ポケモンBW2', 'ポケモンbw2', 'logical-game'),
  (6, 'Pokemon BW2', 'pokemonbw2', 'logical-game'),
  (6, 'Pokemon Black 2', 'pokemonblack2', 'logical-game'),
  (6, 'Pokemon White 2', 'pokemonwhite2', 'logical-game'),
  (6, 'Pokémon Black Version 2', 'pokemonblackversion2', 'logical-game'),
  (6, 'Pokémon White Version 2', 'pokemonwhiteversion2', 'logical-game'),
  (6, 'Pokémon Black 2, White 2', 'pokemonblack2white2', 'logical-game')
on conflict do nothing;

-- game_id becomes authoritative. Provider IDs remain as provenance on legacy rows.
update public.bgms
set game_id = 6,
    game_title = 'ポケットモンスター ブラック2・ホワイト2'
where id in (4, 211);

commit;

-- Read-only verification.
select id, name, normalized_name, igdb_game_id, rawg_game_id
from public.games
where id = 6;

select game_id, provider, external_id
from public.game_external_ids
where game_id = 6
order by provider, external_id;

select id, title, game_title, game_id, igdb_game_id, rawg_game_id
from public.bgms
where id in (4, 211)
order by id;
