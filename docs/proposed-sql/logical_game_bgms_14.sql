-- PROPOSED ONLY: run after 20260910_logical_games_proposed.sql and app support.
-- INSERT-only data migration. Existing BGM rows are neither updated nor deleted.

begin;

do $guard$
begin
  if (
    select count(*)
    from public.games
    where normalized_name in (
      'ポケモン不思議のダンジョン時の探検隊闇の探検隊',
      'ポケットモンスタースカーレットバイオレット',
      'ポケットモンスター赤緑',
      'ポケットモンスター金銀',
      'ポケットモンスタールビーサファイア',
      'ポケットモンスターダイヤモンドパール',
      'ポケットモンスターブラックホワイト',
      'ポケットモンスターxy',
      'ポケットモンスターサンムーン',
      'ポケットモンスターソードシールド',
      'ポケモン不思議のダンジョン青の救助隊赤の救助隊',
      'finalfantasyvi'
    )
  ) <> 12 then
    raise exception 'All 12 logical games must exist before inserting the 14 BGM rows';
  end if;
end
$guard$;

with desired(game_normalized_name, title, normalized_title) as (
  values
    ('ポケモン不思議のダンジョン時の探検隊闇の探検隊', 'けっせん！ディアルガ！', 'けっせんディアルガ'),
    ('ポケットモンスタースカーレットバイオレット', '戦闘！ゼロラボ', '戦闘ゼロラボ'),
    ('finalfantasyvi', '仲間を求めて', '仲間を求めて'),
    ('ポケットモンスター赤緑', '戦闘！野生ポケモン', '戦闘野生ポケモン'),
    ('ポケットモンスター金銀', '戦闘！チャンピオン', '戦闘チャンピオン'),
    ('ポケットモンスタールビーサファイア', '戦闘！チャンピオン', '戦闘チャンピオン'),
    ('ポケットモンスターダイヤモンドパール', '戦闘！シロナ', '戦闘シロナ'),
    ('ポケットモンスターブラックホワイト', '戦闘！N', '戦闘n'),
    ('ポケットモンスターブラックホワイト', '決戦！N', '決戦n'),
    ('ポケットモンスターxy', '戦闘！フラダリ', '戦闘フラダリ'),
    ('ポケットモンスターサンムーン', '戦闘！グラジオ', '戦闘グラジオ'),
    ('ポケットモンスターソードシールド', '戦闘！ジムリーダー', '戦闘ジムリダ'),
    ('ポケモン不思議のダンジョン青の救助隊赤の救助隊', '逃避行', '逃避行'),
    ('finalfantasyvi', '決戦', '決戦')
)
insert into public.bgms (
  title,
  normalized_title,
  game_title,
  game_id,
  igdb_game_id,
  rawg_game_id,
  image_url,
  composer,
  is_hidden
)
select
  d.title,
  d.normalized_title,
  g.name,
  g.id,
  null,
  null,
  g.image_url,
  null,
  false
from desired d
join public.games g on g.normalized_name = d.game_normalized_name
where not exists (
  select 1 from public.bgms b
  where b.game_id = g.id and b.normalized_title = d.normalized_title
);

commit;

-- Post-apply verification (read-only): expected 14.
select count(*) as inserted_logical_bgm_count
from public.bgms b
join public.games g on g.id = b.game_id
where (g.normalized_name, b.normalized_title) in (
  ('ポケモン不思議のダンジョン時の探検隊闇の探検隊', 'けっせんディアルガ'),
  ('ポケットモンスタースカーレットバイオレット', '戦闘ゼロラボ'),
  ('finalfantasyvi', '仲間を求めて'),
  ('ポケットモンスター赤緑', '戦闘野生ポケモン'),
  ('ポケットモンスター金銀', '戦闘チャンピオン'),
  ('ポケットモンスタールビーサファイア', '戦闘チャンピオン'),
  ('ポケットモンスターダイヤモンドパール', '戦闘シロナ'),
  ('ポケットモンスターブラックホワイト', '戦闘n'),
  ('ポケットモンスターブラックホワイト', '決戦n'),
  ('ポケットモンスターxy', '戦闘フラダリ'),
  ('ポケットモンスターサンムーン', '戦闘グラジオ'),
  ('ポケットモンスターソードシールド', '戦闘ジムリダ'),
  ('ポケモン不思議のダンジョン青の救助隊赤の救助隊', '逃避行'),
  ('finalfantasyvi', '決戦')
);
