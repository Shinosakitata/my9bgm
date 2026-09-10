import fs from "node:fs/promises";

const mode = process.argv[2];
if (!new Set(["preflight", "insert", "verify"]).has(mode)) throw new Error("Use preflight, insert, or verify");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server credentials are missing");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const desired = [
  ["ポケモン不思議のダンジョン時の探検隊闇の探検隊", "けっせん！ディアルガ！", "けっせんディアルガ"],
  ["ポケットモンスタースカーレットバイオレット", "戦闘！ゼロラボ", "戦闘ゼロラボ"],
  ["finalfantasyvi", "仲間を求めて", "仲間を求めて"],
  ["ポケットモンスター赤緑", "戦闘！野生ポケモン", "戦闘野生ポケモン"],
  ["ポケットモンスター金銀", "戦闘！チャンピオン", "戦闘チャンピオン"],
  ["ポケットモンスタールビーサファイア", "戦闘！チャンピオン", "戦闘チャンピオン"],
  ["ポケットモンスターダイヤモンドパール", "戦闘！シロナ", "戦闘シロナ"],
  ["ポケットモンスターブラックホワイト", "戦闘！N", "戦闘n"],
  ["ポケットモンスターブラックホワイト", "決戦！N", "決戦n"],
  ["ポケットモンスターxy", "戦闘！フラダリ", "戦闘フラダリ"],
  ["ポケットモンスターサンムーン", "戦闘！グラジオ", "戦闘グラジオ"],
  ["ポケットモンスターソードシールド", "戦闘！ジムリーダー", "戦闘ジムリダ"],
  ["ポケモン不思議のダンジョン青の救助隊赤の救助隊", "逃避行", "逃避行"],
  ["finalfantasyvi", "決戦", "決戦"],
];

async function get(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const [before, games, mappings] = await Promise.all([
  get("bgms?select=*&order=id"),
  get("games?select=id,name,normalized_name,image_url&igdb_game_id=is.null&rawg_game_id=is.null"),
  get("game_external_ids?provider=eq.igdb&select=game_id,external_id&order=game_id,external_id"),
]);
const gameByName = new Map(games.map(game => [game.normalized_name, game]));
if (desired.some(([gameName]) => !gameByName.has(gameName))) throw new Error("One or more logical games are missing");
if (new Set(desired.map(([gameName]) => gameByName.get(gameName).id)).size !== 12) throw new Error("Expected 12 logical games");
if (mappings.length !== 23) throw new Error(`Expected 23 IGDB mappings, got ${mappings.length}`);

const externalIdsByGame = new Map();
for (const mapping of mappings) {
  const ids = externalIdsByGame.get(mapping.game_id) ?? [];
  ids.push(mapping.external_id);
  externalIdsByGame.set(mapping.game_id, ids);
}

const duplicateRows = [];
const planned = [];
for (const [gameName, title, normalizedTitle] of desired) {
  const game = gameByName.get(gameName);
  const externalIds = externalIdsByGame.get(game.id) ?? [];
  const duplicate = before.find(row => row.normalized_title === normalizedTitle &&
    (row.game_id === game.id || (row.igdb_game_id != null && externalIds.includes(row.igdb_game_id))));
  if (duplicate) {
    duplicateRows.push({ requestedTitle: title, existingId: duplicate.id, gameId: game.id });
    continue;
  }
  planned.push({ title, normalized_title: normalizedTitle, game_title: game.name, game_id: game.id,
    igdb_game_id: null, rawg_game_id: null, image_url: game.image_url, composer: null, is_hidden: false });
}

if (mode === "preflight") {
  console.log(JSON.stringify({ mode, beforeCount: before.length, logicalGameCount: 12,
    mappingCount: mappings.length, requestedCount: desired.length, plannedCount: planned.length,
    duplicateSkipCount: duplicateRows.length, duplicateRows }, null, 2));
  process.exit(0);
}

if (mode === "verify") {
  const sets = await get("bgm_sets?select=id,share_id,bgm_ids&order=id");
  const bgmIds = new Set(before.map(row => row.id));
  const missingSetReferences = sets.flatMap(set => set.bgm_ids.filter(id => !bgmIds.has(Number(id))).map(id => ({ setId: set.id, bgmId: id })));
  const groupedMappings = games.filter(game => externalIdsByGame.has(game.id)).map(game => ({
    game_id: game.id, name: game.name, external_ids: externalIdsByGame.get(game.id).sort((a, b) => a - b),
  })).sort((a, b) => a.game_id - b.game_id);
  console.log(JSON.stringify({ mode, totalBgmCount: before.length, logicalBgmCount: duplicateRows.length,
    logicalGameCount: groupedMappings.length, mappingCount: mappings.length, groupedMappings,
    publicSetCount: sets.length, missingSetReferences }, null, 2));
  process.exit(missingSetReferences.length || duplicateRows.length !== 14 ? 3 : 0);
}

let inserted = [];
if (planned.length) {
  const response = await fetch(`${url}/rest/v1/bgms`, {
    method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(planned),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`BGM INSERT failed (${response.status}): ${body}`);
  inserted = JSON.parse(body);
}

const after = await get("bgms?select=*&order=id");
const afterById = new Map(after.map(row => [row.id, row]));
const existingChanged = before.filter(row => JSON.stringify(row) !== JSON.stringify(afterById.get(row.id))).map(row => row.id);
const insertedIds = new Set(inserted.map(row => row.id));
const persisted = after.filter(row => insertedIds.has(row.id));
const failedCount = planned.length - persisted.length;
const receipt = {
  insertedAt: new Date().toISOString(), beforeCount: before.length, afterCount: after.length,
  requestedCount: desired.length, insertedCount: inserted.length, duplicateSkipCount: duplicateRows.length,
  failedCount, existingChanged, insertedIds: [...insertedIds], logicalGameCount: 12,
  mappingCount: mappings.length, mappings,
};
await fs.writeFile("seed_output/logical_import_receipt.json", JSON.stringify(receipt, null, 2), "utf8");
console.log(JSON.stringify(receipt, null, 2));
if (inserted.length !== planned.length || failedCount || existingChanged.length || after.length !== before.length + inserted.length) process.exitCode = 3;
