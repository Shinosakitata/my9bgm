const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase configuration is missing");

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const normalize = (value) => value.normalize("NFKC").toLowerCase().replace(/[\s　]/g, "")
  .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]/g, "").trim();

async function getAll(table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=1000`, { headers });
    if (!response.ok) throw new Error(`${table} read failed (${response.status}): ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const [bgms, games, externalIds, aliases, sets] = await Promise.all([
  getAll("bgms"), getAll("games"), getAll("game_external_ids"), getAll("game_aliases"), getAll("bgm_sets"),
]);
const bgm215 = bgms.find((row) => row.id === 215);
const bgm409 = bgms.find((row) => row.id === 409);
const bgm510 = bgms.find((row) => row.id === 510);
if (!bgm215 || !bgm409 || !bgm510) throw new Error("One of BGM IDs 215, 409, 510 is missing");
if (bgm215.game_title !== "Monster Hunter Tri" || bgm215.title !== "生命ある者へ") throw new Error("BGM 215 is not the approved survivor");
if (bgm409.game_title !== "Monster Hunter 2" || bgm409.title !== "To One with Life") throw new Error("BGM 409 changed after review");
if (bgm510.game_title !== "Monster Hunter Freedom Unite" || bgm510.title !== "The Roar of the Spark / Zinogre") throw new Error("BGM 510 changed after review");

const referencedSets = sets.filter((set) => Array.isArray(set.bgm_ids) && set.bgm_ids.includes(409));
const invalidSetPlans = referencedSets.flatMap((set) => {
  const replaced = set.bgm_ids.map((id) => id === 409 ? 215 : id);
  const reasons = [];
  if (set.bgm_ids.includes(215)) reasons.push("already_contains_215");
  if (replaced.length < 9) reasons.push("fewer_than_9");
  if (new Set(replaced).size !== replaced.length) reasons.push("duplicate_after_replacement");
  return reasons.length ? [{ id: set.id, share_id: set.share_id, reasons, before: set.bgm_ids, after: replaced }] : [];
});

const gameNames = ["モンスターハンターポータブル 3rd", "Monster Hunter Portable 3rd"];
const existingGames = games.filter((game) => gameNames.map(normalize).includes(game.normalized_name));
const externalConflict = externalIds.find((row) => row.provider === "igdb" && Number(row.external_id) === 42759);
const aliasValues = [
  "Monster Hunter Portable 3rd", "モンスターハンターポータブル 3rd", "モンスターハンターポータブル3rd",
  "MHP3", "MHP3rd", "モンハン3rd",
];
const aliasPlans = aliasValues.map((alias) => ({ alias, normalized_alias: normalize(alias), existing: aliases.find((row) => row.normalized_alias === normalize(alias)) ?? null }));
const aliasConflicts = aliasPlans.filter((row) => row.existing && !existingGames.some((game) => game.id === row.existing.game_id));
const mhp3Id = existingGames[0]?.id ?? null;
const title510 = "閃烈なる蒼光／ジンオウガ";
const bgm510Conflict = mhp3Id == null ? null : bgms.find((row) => row.id !== 510 && row.game_id === mhp3Id
  && (row.normalized_title || normalize(row.title)) === normalize(title510));

const conflicts = [];
if (invalidSetPlans.length) conflicts.push("invalid_set_replacement");
if (existingGames.length > 1) conflicts.push("multiple_mhp3_games");
if (externalConflict && !existingGames.some((game) => game.id === externalConflict.game_id)) conflicts.push("external_id_collision");
if (aliasConflicts.length) conflicts.push("alias_collision");
if (bgm510Conflict) conflicts.push("bgm_510_title_collision");

console.log(JSON.stringify({
  mode: "dry-run",
  sourceFacts: {
    mhp3IgdbId: 42759,
    mhp3HdIgdbIdExcluded: 78633,
    bgm510Title: title510,
    bgm409Survivor: 215,
  },
  targetRows: { bgm215, bgm409, bgm510 },
  referenceSets: referencedSets.map((set) => ({ id: set.id, share_id: set.share_id, bgm_ids: set.bgm_ids })),
  invalidSetPlans,
  existingGames,
  externalConflict: externalConflict ?? null,
  aliasPlans,
  aliasConflicts,
  bgm510Conflict: bgm510Conflict ?? null,
  conflicts,
  planned: {
    setUpdates: referencedSets.length,
    bgmUpdates: 1,
    bgmDeletes: 1,
    gameInserts: existingGames.length ? 0 : 1,
    externalIdInserts: externalConflict ? 0 : 1,
    aliasInserts: aliasPlans.filter((row) => !row.existing).length,
  },
  countsBefore: { bgms: bgms.length, games: games.length, game_external_ids: externalIds.length, game_aliases: aliases.length, bgm_sets: sets.length },
}, null, 2));
if (conflicts.length) process.exitCode = 2;
