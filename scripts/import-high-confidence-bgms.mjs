import fs from "node:fs/promises";

const APPLY_FLAG = "--apply";
const mode = process.argv[2] === APPLY_FLAG ? "apply" : "dry-run";
const inputDir = "candidate_500_resolved";
const expectedBgmCount = 335;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) throw new Error("Supabase server credentials are missing");
if (mode === "apply" && process.env.CONFIRM_HIGH_CONFIDENCE_IMPORT !== "INSERT_ONLY_335") {
  throw new Error("Apply mode requires CONFIRM_HIGH_CONFIDENCE_IMPORT=INSERT_ONLY_335");
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const columns = rows.shift().map((value, index) => index ? value : value.replace(/^\uFEFF/, ""));
  return rows.filter(values => values.some(Boolean)).map(values => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])));
}

function normalizeGame(value) {
  return value.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/pokémon/g, "pokemon").replace(/[^0-9a-z\u3040-\u30ff\u3400-\u9fff]+/g, "");
}

function normalizeBgmTitle(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s　]/g, "")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]/g, "").trim();
}

async function loadCsv(name) {
  return parseCsv(await fs.readFile(`${inputDir}/${name}`, "utf8"));
}

async function getAll(table, select = "*") {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id&offset=${offset}&limit=1000`, { headers });
    if (!response.ok) throw new Error(`${table} read failed (${response.status}): ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function insertRows(table, rows) {
  if (!rows.length) return [];
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table} INSERT failed (${response.status}): ${await response.text()}`);
  return response.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(`Preflight failed: ${message}`);
}

const [bgmCsv, gameCsv, aliasCsv, externalCsv] = await Promise.all([
  loadCsv("import_ready_final.csv"), loadCsv("new_games_final.csv"),
  loadCsv("game_aliases_final.csv"), loadCsv("game_external_ids_final.csv"),
]);

const bgmRows = bgmCsv.filter(row => row.confidence === "high");
const highGames = gameCsv.filter(row => row.confidence === "high");
const highAliases = aliasCsv.filter(row => row.confidence === "high");
const highExternalIds = externalCsv.filter(row => row.confidence === "high");

assert(bgmCsv.length === expectedBgmCount && bgmRows.length === expectedBgmCount, `expected exactly ${expectedBgmCount} high-confidence BGM rows`);
assert(!bgmRows.some(row => row.source_game_title === "Super Smash Bros. Ultimate" && row.bgm_title === "Main Theme"), "ambiguous Smash Main Theme is present");
assert(!bgmRows.some(row => row.confidence !== "high"), "medium or low BGM entered the plan");
assert(new Set(bgmRows.map(row => row.rank)).size === expectedBgmCount, "BGM ranks are duplicated");
const forbiddenDuplicates = new Set([
  "Xenoblade Chronicles|You Will Know Our Names", "Xenoblade Chronicles 3|The Weight of Life",
  "Monster Hunter Rise: Sunbreak|Proof of a Hero - Sunbreak Version",
  "The Legend of Zelda: Majora's Mask|Song of Healing", "NieR Replicant|Song of the Ancients / Fate",
  "Kirby: Triple Deluxe|Moonstruck Blossom",
]);
assert(!bgmRows.some(row => forbiddenDuplicates.has(`${row.source_game_title}|${row.bgm_title}`)), "a confirmed duplicate entered the plan");

const [beforeBgms, beforeGames, beforeAliases, beforeExternalIds, beforeSets] = await Promise.all([
  getAll("bgms", "id,title,normalized_title,game_title,game_id,igdb_game_id,rawg_game_id"),
  getAll("games"), getAll("game_aliases"), getAll("game_external_ids"), getAll("bgm_sets"),
]);

function buildPlan(currentGames, currentAliases, currentExternalIds, currentBgms) {
  const conflicts = [];
  const gameById = new Map(currentGames.map(game => [Number(game.id), game]));
  const gameByNormalizedName = new Map(currentGames.map(game => [game.normalized_name, game]));
  const plannedGameByName = new Map(highGames.map(game => [game.logical_game_name, game]));

  const gamesToInsert = [];
  for (const candidate of highGames) {
    const existing = gameByNormalizedName.get(candidate.normalized_name);
    if (existing && existing.name !== candidate.logical_game_name) {
      conflicts.push(`game normalized_name ${candidate.normalized_name} belongs to ${existing.name}`);
    } else if (!existing) {
      assert(candidate.logical_game_name && candidate.normalized_name && candidate.image_url_candidate && candidate.released, `new game has NULL required import data: ${candidate.logical_game_name}`);
      gamesToInsert.push({ rawg_game_id: null, igdb_game_id: null, name: candidate.logical_game_name, normalized_name: candidate.normalized_name, image_url: candidate.image_url_candidate, released: candidate.released });
    }
  }

  const resolveExistingGame = logicalName => {
    const explicit = bgmRows.find(row => row.logical_game_name === logicalName && row.existing_game_id)?.existing_game_id;
    if (explicit) {
      const game = gameById.get(Number(explicit));
      if (!game || game.name !== logicalName) conflicts.push(`existing_game_id ${explicit} does not match ${logicalName}`);
      return game;
    }
    return [...gameByNormalizedName.values()].find(game => game.name === logicalName)
      ?? gameByNormalizedName.get(plannedGameByName.get(logicalName)?.normalized_name);
  };

  const externalByKey = new Map(currentExternalIds.map(row => [`${row.provider}:${row.external_id}`, row]));
  const externalToInsert = [];
  for (const candidate of highExternalIds) {
    const target = resolveExistingGame(candidate.logical_game_name);
    const planned = plannedGameByName.get(candidate.logical_game_name);
    if (!target && !planned) { conflicts.push(`external ID target game missing: ${candidate.logical_game_name}`); continue; }
    const existing = externalByKey.get(`${candidate.provider}:${candidate.external_id}`);
    if (existing && (!target || Number(existing.game_id) !== Number(target.id))) {
      conflicts.push(`external ID collision ${candidate.provider}:${candidate.external_id}`);
    } else if (!existing) externalToInsert.push(candidate);
  }

  const aliasByNormalized = new Map(currentAliases.map(alias => [alias.normalized_alias, alias]));
  const aliasToInsert = [];
  for (const candidate of highAliases) {
    const target = resolveExistingGame(candidate.logical_game_name);
    const planned = plannedGameByName.get(candidate.logical_game_name);
    if (!target && !planned) { conflicts.push(`alias target game missing: ${candidate.logical_game_name}`); continue; }
    const existing = aliasByNormalized.get(candidate.normalized_alias);
    if (existing && (!target || Number(existing.game_id) !== Number(target.id))) {
      conflicts.push(`alias collision ${candidate.normalized_alias}`);
    } else if (!existing) aliasToInsert.push(candidate);
  }

  const externalIdsByLogicalName = new Map();
  for (const row of highExternalIds) {
    const values = externalIdsByLogicalName.get(row.logical_game_name) ?? new Set();
    values.add(Number(row.external_id)); externalIdsByLogicalName.set(row.logical_game_name, values);
  }
  for (const row of currentExternalIds) {
    const game = gameById.get(Number(row.game_id)); if (!game) continue;
    const values = externalIdsByLogicalName.get(game.name) ?? new Set();
    values.add(Number(row.external_id)); externalIdsByLogicalName.set(game.name, values);
  }

  const plannedBgmKeys = new Set();
  const bgmsToInsert = [], bgmsAlreadyPresent = [];
  for (const candidate of bgmRows) {
    const normalizedTitle = normalizeBgmTitle(candidate.bgm_title);
    assert(normalizedTitle, `normalized title is empty for rank ${candidate.rank}`);
    const target = resolveExistingGame(candidate.logical_game_name);
    const planned = plannedGameByName.get(candidate.logical_game_name);
    if (!target && !planned) { conflicts.push(`BGM target game missing: ${candidate.logical_game_name}`); continue; }
    const planKey = `${candidate.logical_game_name}:${normalizedTitle}`;
    if (plannedBgmKeys.has(planKey)) conflicts.push(`duplicate BGM inside CSV: ${planKey}`);
    plannedBgmKeys.add(planKey);
    const targetExternalIds = externalIdsByLogicalName.get(candidate.logical_game_name) ?? new Set();
    const duplicate = currentBgms.find(row => {
      const currentTitle = row.normalized_title || normalizeBgmTitle(row.title);
      if (currentTitle !== normalizedTitle) return false;
      if (target && row.game_id != null) return Number(row.game_id) === Number(target.id);
      if (row.igdb_game_id != null && targetExternalIds.has(Number(row.igdb_game_id))) return true;
      return normalizeGame(row.game_title) === normalizeGame(candidate.logical_game_name)
        || normalizeGame(row.game_title) === normalizeGame(candidate.source_game_title);
    });
    if (duplicate && target && Number(duplicate.game_id) === Number(target.id)) bgmsAlreadyPresent.push({ candidate, existingId: duplicate.id });
    else if (duplicate) conflicts.push(`existing BGM duplicate rank=${candidate.rank}, existing id=${duplicate.id}`);
    else bgmsToInsert.push({ candidate, normalizedTitle });
  }

  return { conflicts: [...new Set(conflicts)], gamesToInsert, externalToInsert, aliasToInsert, bgmsToInsert, bgmsAlreadyPresent };
}

let plan = buildPlan(beforeGames, beforeAliases, beforeExternalIds, beforeBgms);
assert(plan.conflicts.length === 0, plan.conflicts.join("; "));
assert(plan.bgmsToInsert.length + plan.bgmsAlreadyPresent.length === expectedBgmCount,
  `expected ${expectedBgmCount} planned/already-present BGMs, got ${plan.bgmsToInsert.length + plan.bgmsAlreadyPresent.length}`);

const beforeCounts = { bgms: beforeBgms.length, games: beforeGames.length, game_external_ids: beforeExternalIds.length, game_aliases: beforeAliases.length, bgm_sets: beforeSets.length };
const plannedCounts = { bgms: plan.bgmsToInsert.length, games: plan.gamesToInsert.length, game_external_ids: plan.externalToInsert.length, game_aliases: plan.aliasToInsert.length };

if (mode === "dry-run") {
  console.log(JSON.stringify({ mode, expectedBgmCount, beforeCounts, plannedCounts,
    alreadyPresent: { bgms: plan.bgmsAlreadyPresent.length, games: highGames.length - plan.gamesToInsert.length,
      game_external_ids: highExternalIds.length - plan.externalToInsert.length, game_aliases: highAliases.length - plan.aliasToInsert.length },
    totalInserts: Object.values(plannedCounts).reduce((sum, value) => sum + value, 0),
    expectedAfter: Object.fromEntries(Object.entries(beforeCounts).map(([key, value]) => [key, value + (plannedCounts[key] ?? 0)])),
    validation: { foreignKeyViolations: 0, uniqueViolations: 0, externalIdConflicts: 0, aliasConflicts: 0, bgmDuplicates: 0, nullRequiredViolations: 0, bgmSetsImpact: 0, updates: 0, deletes: 0 },
    coverPolicy: "games.image_url uses the primary IGDB cover at t_cover_big; additional IGDB IDs map to the same game without replacing its cover",
  }, null, 2));
  process.exit(0);
}

// Re-read immediately before the first INSERT. Any changed plan aborts without writing.
const [freshBgms, freshGames, freshAliases, freshExternalIds, freshSets] = await Promise.all([
  getAll("bgms", "id,title,normalized_title,game_title,game_id,igdb_game_id,rawg_game_id"), getAll("games"),
  getAll("game_aliases"), getAll("game_external_ids"), getAll("bgm_sets"),
]);
assert(JSON.stringify(freshSets) === JSON.stringify(beforeSets), "bgm_sets changed during preflight");
assert(JSON.stringify(freshBgms) === JSON.stringify(beforeBgms), "bgms changed during preflight");
assert(JSON.stringify(freshGames) === JSON.stringify(beforeGames), "games changed during preflight");
assert(JSON.stringify(freshAliases) === JSON.stringify(beforeAliases), "game_aliases changed during preflight");
assert(JSON.stringify(freshExternalIds) === JSON.stringify(beforeExternalIds), "game_external_ids changed during preflight");
plan = buildPlan(freshGames, freshAliases, freshExternalIds, freshBgms);
assert(plan.conflicts.length === 0 && plan.bgmsToInsert.length + plan.bgmsAlreadyPresent.length === expectedBgmCount, "database changed after preflight");

await insertRows("games", plan.gamesToInsert);
const gamesAfterInsert = await getAll("games");
const gameByName = new Map(gamesAfterInsert.map(game => [game.name, game]));

const externalPayload = plan.externalToInsert.map(row => ({ game_id: gameByName.get(row.logical_game_name)?.id, provider: row.provider, external_id: Number(row.external_id) }));
assert(externalPayload.every(row => Number.isSafeInteger(row.game_id)), "external ID FK resolution failed");
await insertRows("game_external_ids", externalPayload);

const aliasPayload = plan.aliasToInsert.map(row => ({ game_id: gameByName.get(row.logical_game_name)?.id, alias: row.alias, normalized_alias: row.normalized_alias, source: "high-confidence-seed" }));
assert(aliasPayload.every(row => Number.isSafeInteger(row.game_id)), "alias FK resolution failed");
await insertRows("game_aliases", aliasPayload);

const bgmPayload = plan.bgmsToInsert.map(({ candidate, normalizedTitle }) => {
  const game = gameByName.get(candidate.logical_game_name);
  return { title: candidate.bgm_title, game_title: candidate.logical_game_name, composer: null, image_url: game.image_url,
    rawg_game_id: null, igdb_game_id: null, game_id: game.id, normalized_title: normalizedTitle, is_hidden: false };
});
assert(bgmPayload.every(row => Number.isSafeInteger(row.game_id) && row.title && row.game_title && row.image_url && row.normalized_title), "BGM NULL/FK validation failed");
await insertRows("bgms", bgmPayload);

const [afterBgms, afterGames, afterAliases, afterExternalIds, afterSets] = await Promise.all([
  getAll("bgms"), getAll("games"), getAll("game_aliases"), getAll("game_external_ids"), getAll("bgm_sets"),
]);
assert(JSON.stringify(afterSets) === JSON.stringify(beforeSets), "bgm_sets content changed");
const actualAfter = { bgms: afterBgms.length, games: afterGames.length, game_external_ids: afterExternalIds.length, game_aliases: afterAliases.length, bgm_sets: afterSets.length };
const expectedAfter = Object.fromEntries(Object.entries(beforeCounts).map(([key, value]) => [key, value + (plannedCounts[key] ?? 0)]));
assert(JSON.stringify(actualAfter) === JSON.stringify(expectedAfter), `post-insert counts differ: ${JSON.stringify({ actualAfter, expectedAfter })}`);
console.log(JSON.stringify({ mode, beforeCounts, inserted: plannedCounts, actualAfter, updates: 0, deletes: 0 }, null, 2));
