import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const review = process.argv.includes("--review");
const EXPECTED = review ? 54 : 27;
const CONFIRMATION = review ? "UPDATE_REVIEW_TITLE_ONLY_54" : "UPDATE_TITLE_ONLY_27";
const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase configuration is missing");

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const csvPath = review
  ? "candidate_title_localization/title_changes_review_resolved.csv"
  : "candidate_title_localization/title_changes_high.csv";

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += character;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  const [columns, ...data] = rows.filter(item => item.some(Boolean));
  return data.map(values => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])));
}

function normalizeBgmTitle(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s　]/g, "")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]/g, "").trim();
}

async function getAll(table, select = "*") {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id&offset=${offset}&limit=1000`, { headers });
    if (!response.ok) throw new Error(`${table} read failed (${response.status}): ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const stable = value => JSON.stringify(value, Object.keys(value[0] ?? {}).sort());
const digest = value => createHash("sha256").update(stable(value)).digest("hex");
const candidates = parseCsv(await readFile(csvPath, "utf8"))
  .filter(row => !review || row.confidence === "confirmed_high")
  .map(row => ({
  ...row,
  bgm_id: Number(row.bgm_id),
  proposed_title: review ? row.confirmed_title : row.proposed_title,
  proposed_normalized_title: normalizeBgmTitle(review ? row.confirmed_title : row.proposed_title),
}));

if (candidates.length !== EXPECTED) throw new Error(`Expected ${EXPECTED} CSV rows, got ${candidates.length}`);
if (new Set(candidates.map(row => row.bgm_id)).size !== EXPECTED) throw new Error("CSV contains duplicate BGM IDs");
if (candidates.some(row => !Number.isSafeInteger(row.bgm_id) || row.bgm_id <= 0
  || (!review && row.confidence !== "high") || (review && row.confidence !== "confirmed_high")
  || !row.proposed_title.trim() || !row.proposed_normalized_title)) {
  throw new Error("CSV contains an invalid target row");
}

function validateBefore(bgms, sets) {
  const byId = new Map(bgms.map(row => [row.id, row]));
  for (const candidate of candidates) {
    const current = byId.get(candidate.bgm_id);
    if (!current) throw new Error(`BGM ${candidate.bgm_id} does not exist`);
    if (current.title !== candidate.current_title) throw new Error(`BGM ${candidate.bgm_id} title changed after audit`);
    if (current.game_title !== candidate.game_title) throw new Error(`BGM ${candidate.bgm_id} game title changed after audit`);
    const collision = bgms.find(row => row.id !== current.id && row.game_id === current.game_id
      && (row.normalized_title || normalizeBgmTitle(row.title)) === candidate.proposed_normalized_title);
    if (collision) throw new Error(`BGM ${candidate.bgm_id} conflicts with BGM ${collision.id} in game ${current.game_id}`);
  }
  return { bgms: bgms.length, bgm_sets: sets.length, bgmsDigest: digest(bgms), setsDigest: digest(sets) };
}

const [beforeBgms, beforeSets] = await Promise.all([getAll("bgms"), getAll("bgm_sets")]);
const before = validateBefore(beforeBgms, beforeSets);
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", targets: candidates.length, before, updates: apply ? EXPECTED : 0, inserts: 0, deletes: 0, schemaChanges: 0 }, null, 2));
if (!apply) process.exit(0);
if (process.env.CONFIRM_TITLE_LOCALIZATION !== CONFIRMATION) throw new Error(`Set CONFIRM_TITLE_LOCALIZATION=${CONFIRMATION}`);

// Re-read immediately before the first write. Any intervening DB change aborts the run.
const [guardBgms, guardSets] = await Promise.all([getAll("bgms"), getAll("bgm_sets")]);
const guard = validateBefore(guardBgms, guardSets);
if (guard.bgmsDigest !== before.bgmsDigest || guard.setsDigest !== before.setsDigest) throw new Error("Database changed after preflight; no UPDATE was sent");

for (const candidate of candidates) {
  const endpoint = `${url}/rest/v1/bgms?id=eq.${candidate.bgm_id}&title=eq.${encodeURIComponent(candidate.current_title)}&select=*`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ title: candidate.proposed_title, normalized_title: candidate.proposed_normalized_title }),
  });
  if (!response.ok) throw new Error(`BGM ${candidate.bgm_id} UPDATE failed (${response.status}): ${await response.text()}`);
  const changed = await response.json();
  if (changed.length !== 1 || changed[0].id !== candidate.bgm_id) throw new Error(`BGM ${candidate.bgm_id} UPDATE count was not exactly one`);
}

const [afterBgms, afterSets] = await Promise.all([getAll("bgms"), getAll("bgm_sets")]);
if (afterBgms.length !== beforeBgms.length || afterSets.length !== beforeSets.length || digest(afterSets) !== before.setsDigest) throw new Error("Table counts or bgm_sets changed unexpectedly");
const targetIds = new Set(candidates.map(row => row.bgm_id));
const beforeById = new Map(beforeBgms.map(row => [row.id, row]));
const afterById = new Map(afterBgms.map(row => [row.id, row]));
for (const beforeRow of beforeBgms) {
  const afterRow = afterById.get(beforeRow.id);
  if (!afterRow) throw new Error(`BGM ID ${beforeRow.id} disappeared`);
  const expected = targetIds.has(beforeRow.id)
    ? { ...beforeRow, title: candidates.find(row => row.bgm_id === beforeRow.id).proposed_title, normalized_title: candidates.find(row => row.bgm_id === beforeRow.id).proposed_normalized_title }
    : beforeRow;
  if (JSON.stringify(afterRow) !== JSON.stringify(expected)) throw new Error(`Unexpected column change on BGM ${beforeRow.id}`);
}
validateBefore(afterBgms.map(row => targetIds.has(row.id) ? { ...row, title: beforeById.get(row.id).title } : row), afterSets);
const normalizedKeys = new Set();
for (const row of afterBgms) {
  const keyValue = `${row.game_id ?? `legacy:${row.game_title}`}\u0000${row.normalized_title || normalizeBgmTitle(row.title)}`;
  if (normalizedKeys.has(keyValue)) throw new Error(`Duplicate logical-game title detected after UPDATE: ${keyValue}`);
  normalizedKeys.add(keyValue);
}
console.log(JSON.stringify({ result: "success", updated: EXPECTED, bgms: afterBgms.length, bgm_sets: afterSets.length, inserts: 0, deletes: 0, idsChanged: 0, gameIdsChanged: 0, unintendedRowsChanged: 0 }, null, 2));
