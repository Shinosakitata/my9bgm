const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase configuration is missing");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

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
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const bgm215 = bgms.find((row) => row.id === 215);
const bgm510 = bgms.find((row) => row.id === 510);
const mhp3 = games.find((row) => row.normalized_name === "モンスタハンタポタブル3rd");
assert(!bgms.some((row) => row.id === 409), "BGM 409 still exists");
assert(bgm215?.game_id === 217 && bgm215.game_title === "Monster Hunter Tri" && bgm215.title === "生命ある者へ" && bgm215.normalized_title === "生命ある者へ", "BGM 215 changed");
assert(mhp3, "MHP3rd logical game is missing");
assert(bgm510?.game_id === mhp3.id && bgm510.game_title === mhp3.name && bgm510.title === "閃烈なる蒼光／ジンオウガ" && bgm510.normalized_title === "閃烈なる蒼光ジンオウガ", "BGM 510 mapping is incorrect");
assert(!sets.some((set) => set.bgm_ids.includes(409)), "A set still references 409");
assert(sets.every((set) => set.bgm_ids.length === 9 && new Set(set.bgm_ids).size === 9), "A set does not have nine unique BGM IDs");
const mhp3External = externalIds.filter((row) => row.game_id === mhp3.id && row.provider === "igdb");
assert(mhp3External.length === 1 && Number(mhp3External[0].external_id) === 42759, "MHP3rd IGDB mapping is incorrect");
assert(!mhp3External.some((row) => Number(row.external_id) === 78633), "HD version IGDB ID was used");

const duplicateExternalIds = Object.entries(Object.groupBy(externalIds, (row) => `${row.provider}:${row.external_id}`)).filter(([, rows]) => rows.length > 1);
const duplicateAliases = Object.entries(Object.groupBy(aliases, (row) => row.normalized_alias)).filter(([, rows]) => rows.length > 1);
const duplicateBgms = Object.entries(Object.groupBy(bgms, (row) => `${row.game_id ?? `legacy:${row.game_title}`}\0${row.normalized_title}`)).filter(([, rows]) => rows.length > 1);
assert(duplicateExternalIds.length === 0, "External ID collision detected");
assert(duplicateAliases.length === 0, "Alias collision detected");
assert(duplicateBgms.length === 0, "Logical-game BGM duplicate detected");

console.log(JSON.stringify({
  result: "success",
  bgm215,
  bgm409Exists: false,
  bgm510,
  mhp3,
  externalIds: mhp3External,
  aliases: aliases.filter((row) => row.game_id === mhp3.id),
  setsReferencing409: 0,
  allSetsHaveNineUniqueIds: true,
  collisions: { externalIds: 0, aliases: 0, bgmsWithinGame: 0 },
  counts: { bgms: bgms.length, games: games.length, game_external_ids: externalIds.length, game_aliases: aliases.length, bgm_sets: sets.length },
}, null, 2));
