begin;

do $$
declare
  v_mhp3_game_id bigint;
  v_tri_game_id bigint;
  v_count integer;
  v_alias record;
begin
  if (select count(*) from public.bgms where id in (215, 409, 510)) <> 3 then
    raise exception 'Expected BGM IDs 215, 409 and 510 to exist';
  end if;

  if not exists (
    select 1 from public.bgms
    where id = 215 and game_title = 'Monster Hunter Tri' and title = '生命ある者へ'
  ) then raise exception 'BGM 215 changed after dry-run'; end if;
  if not exists (
    select 1 from public.bgms
    where id = 409 and game_title = 'Monster Hunter 2' and title = 'To One with Life'
  ) then raise exception 'BGM 409 changed after dry-run'; end if;
  if not exists (
    select 1 from public.bgms
    where id = 510 and game_title = 'Monster Hunter Freedom Unite' and title = 'The Roar of the Spark / Zinogre'
  ) then raise exception 'BGM 510 changed after dry-run'; end if;

  select id into strict v_tri_game_id
  from public.games where normalized_name = 'monsterhuntertri';
  if v_tri_game_id <> (select game_id from public.bgms where id = 215) then
    raise exception 'BGM 215 is not linked to the canonical Monster Hunter Tri game';
  end if;

  if exists (
    select 1 from public.bgm_sets
    where bgm_ids @> array[409]::bigint[] and bgm_ids @> array[215]::bigint[]
  ) then raise exception 'A set contains both BGM 409 and 215'; end if;
  if exists (
    select 1 from public.bgm_sets
    where bgm_ids @> array[409]::bigint[]
      and (cardinality(array_replace(bgm_ids, 409::bigint, 215::bigint)) < 9
        or cardinality(array(select distinct unnest(array_replace(bgm_ids, 409::bigint, 215::bigint)))) <> cardinality(array_replace(bgm_ids, 409::bigint, 215::bigint)))
  ) then raise exception 'A set would become short or contain duplicate IDs'; end if;

  select id into v_mhp3_game_id
  from public.games
  where normalized_name = 'モンスタハンタポタブル3rd';

  if v_mhp3_game_id is null then
    if exists (select 1 from public.game_external_ids where provider = 'igdb' and external_id = 42759) then
      raise exception 'IGDB 42759 already belongs to another game';
    end if;
    insert into public.games (rawg_game_id, igdb_game_id, name, normalized_name, image_url, released)
    values (null, null, 'モンスターハンターポータブル 3rd', 'モンスタハンタポタブル3rd',
      'https://images.igdb.com/igdb/image/upload/t_cover_big/coau02.jpg', '2010-12-01')
    returning id into v_mhp3_game_id;
  end if;

  if exists (
    select 1 from public.game_external_ids
    where provider = 'igdb' and external_id = 42759 and game_id <> v_mhp3_game_id
  ) then raise exception 'IGDB 42759 collision'; end if;
  insert into public.game_external_ids (game_id, provider, external_id)
  select v_mhp3_game_id, 'igdb', 42759
  where not exists (
    select 1 from public.game_external_ids
    where game_id = v_mhp3_game_id and provider = 'igdb' and external_id = 42759
  );

  for v_alias in select * from (values
    ('Monster Hunter Portable 3rd', 'monsterhunterportable3rd'),
    ('モンスターハンターポータブル3rd', 'モンスタハンタポタブル3rd'),
    ('MHP3', 'mhp3'),
    ('MHP3rd', 'mhp3rd'),
    ('モンハン3rd', 'モンハン3rd')
  ) as aliases(alias, normalized_alias)
  loop
    if exists (
      select 1 from public.game_aliases
      where normalized_alias = v_alias.normalized_alias and game_id <> v_mhp3_game_id
    ) then raise exception 'Alias % belongs to another game', v_alias.alias; end if;
    insert into public.game_aliases (game_id, alias, normalized_alias, source)
    select v_mhp3_game_id, v_alias.alias, v_alias.normalized_alias, 'monster-hunter-mapping-fix'
    where not exists (
      select 1 from public.game_aliases where normalized_alias = v_alias.normalized_alias
    );
  end loop;

  if exists (
    select 1 from public.bgms
    where id <> 510 and game_id = v_mhp3_game_id and normalized_title = '閃烈なる蒼光ジンオウガ'
  ) then raise exception 'MHP3rd already has the Zinogre music'; end if;

  update public.bgm_sets
  set bgm_ids = array_replace(bgm_ids, 409::bigint, 215::bigint)
  where bgm_ids @> array[409]::bigint[];

  if exists (select 1 from public.bgm_sets where bgm_ids @> array[409]::bigint[]) then
    raise exception 'BGM 409 is still referenced';
  end if;

  delete from public.bgms where id = 409;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'BGM 409 delete count was %', v_count; end if;

  update public.bgms
  set game_id = v_mhp3_game_id,
      game_title = 'モンスターハンターポータブル 3rd',
      title = '閃烈なる蒼光／ジンオウガ',
      normalized_title = '閃烈なる蒼光ジンオウガ'
  where id = 510
    and game_title = 'Monster Hunter Freedom Unite'
    and title = 'The Roar of the Spark / Zinogre';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'BGM 510 update count was %', v_count; end if;

  if not exists (
    select 1 from public.bgms
    where id = 215 and game_id = v_tri_game_id and game_title = 'Monster Hunter Tri'
      and title = '生命ある者へ' and normalized_title = '生命ある者へ'
  ) then raise exception 'BGM 215 changed unexpectedly'; end if;
  if exists (select 1 from public.bgms where id = 409) then raise exception 'BGM 409 still exists'; end if;
  if not exists (
    select 1 from public.bgms
    where id = 510 and game_id = v_mhp3_game_id
      and game_title = 'モンスターハンターポータブル 3rd'
      and title = '閃烈なる蒼光／ジンオウガ'
      and normalized_title = '閃烈なる蒼光ジンオウガ'
  ) then raise exception 'BGM 510 final state is incorrect'; end if;
  if exists (
    select 1 from public.game_external_ids
    where provider = 'igdb' and external_id = 78633 and game_id = v_mhp3_game_id
  ) then raise exception 'HD version IGDB ID was attached incorrectly'; end if;
  if exists (
    select 1 from public.bgm_sets
    where cardinality(bgm_ids) <> 9
      or cardinality(array(select distinct unnest(bgm_ids))) <> 9
  ) then raise exception 'A BGM set does not contain nine unique IDs'; end if;
end $$;

select id, name, normalized_name from public.games
where normalized_name = 'モンスタハンタポタブル3rd';
select id, game_id, game_title, title, normalized_title from public.bgms where id in (215, 409, 510) order by id;
select game_id, provider, external_id from public.game_external_ids where provider = 'igdb' and external_id in (42759, 78633);
select game_id, alias, normalized_alias from public.game_aliases
where normalized_alias in ('monsterhunterportable3rd', 'モンスタハンタポタブル3rd', 'mhp3', 'mhp3rd', 'モンハン3rd') order by alias;

commit;
