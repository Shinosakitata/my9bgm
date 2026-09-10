import fs from "node:fs/promises";

const mode = process.argv[2];
if (!new Set(["preflight", "insert"]).has(mode)) throw new Error("Use preflight or insert");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server credentials are missing");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const planned = JSON.parse(await fs.readFile("seed_output/planned_import.json", "utf8"));
if (!Array.isArray(planned) || planned.length !== 178) throw new Error(`Expected 178 planned rows, got ${planned?.length}`);

const keyOf = row => `${row.igdb_game_id}:${row.normalized_title}`;
const plannedKeys = new Set(planned.map(keyOf));
if (plannedKeys.size !== planned.length) throw new Error("Planned data contains duplicate keys");

async function fetchAll() {
  const response = await fetch(`${url}/rest/v1/bgms?select=*&order=id`, { headers });
  if (!response.ok) throw new Error(`Supabase read failed (${response.status}): ${await response.text()}`);
  return await response.json();
}

const before = await fetchAll();
const conflicts = before.filter(row => row.igdb_game_id != null && plannedKeys.has(keyOf(row)));
if (conflicts.length) {
  console.log(JSON.stringify({ mode, beforeCount: before.length, conflicts: conflicts.map(row => ({ id: row.id, title: row.title, igdb_game_id: row.igdb_game_id })) }, null, 2));
  process.exitCode = 2;
} else if (mode === "preflight") {
  console.log(JSON.stringify({ mode, beforeCount: before.length, plannedCount: planned.length, conflicts: 0 }, null, 2));
} else {
  const response = await fetch(`${url}/rest/v1/bgms`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(planned),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Supabase INSERT failed (${response.status}): ${responseText}`);
  const inserted = JSON.parse(responseText);
  const returnedKeys = new Set(inserted.map(keyOf));
  const after = await fetchAll();
  const afterById = new Map(after.map(row => [row.id, row]));
  const existingChanged = before.filter(row => JSON.stringify(row) !== JSON.stringify(afterById.get(row.id))).map(row => row.id);
  const persisted = after.filter(row => row.igdb_game_id != null && plannedKeys.has(keyOf(row)));
  const persistedKeys = new Set(persisted.map(keyOf));
  const missingKeys = [...plannedKeys].filter(value => !persistedKeys.has(value));
  const duplicateKeys = [...persisted.reduce((map, row) => map.set(keyOf(row), (map.get(keyOf(row)) ?? 0) + 1), new Map())]
    .filter(([, count]) => count !== 1).map(([value, count]) => ({ key: value, count }));
  const receipt = {
    insertedAt: new Date().toISOString(), beforeCount: before.length, afterCount: after.length,
    requestedCount: planned.length, returnedInsertCount: inserted.length, returnedUniqueKeys: returnedKeys.size,
    persistedCount: persisted.length, missingKeys, duplicateKeys, existingChanged,
    insertedIds: inserted.map(row => row.id),
  };
  await fs.writeFile("seed_output/production_import_receipt.json", JSON.stringify(receipt, null, 2), "utf8");
  console.log(JSON.stringify(receipt, null, 2));
  if (inserted.length !== 178 || returnedKeys.size !== 178 || persisted.length !== 178 || missingKeys.length || duplicateKeys.length || existingChanged.length || after.length !== before.length + 178) process.exitCode = 3;
}
