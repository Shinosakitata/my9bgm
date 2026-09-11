/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const base = "http://127.0.0.1:3001";
const db = "http://127.0.0.1:4011";
async function request(path, body, method = "POST", token) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}

test("localhost: search, registration, duplicates, authenticated edits, legacy contract, image proxy and sets", async () => {
  // This fixed loopback endpoint belongs only to the disposable fixture server.
  assert.equal((await fetch(db + "/fixture/reset", { method: "POST" })).status, 200);
  const before = await (await fetch(db + "/fixture/state")).json();
  const searches = [];
  for (const q of ["モンスターハンター", "monster hunter", "monsterhunter", "モンハン"]) {
    const response = await fetch(base + "/api/games?q=" + encodeURIComponent(q));
    assert.equal(response.status, 200);
    searches.push((await response.json()).results);
  }
  assert.deepEqual(searches[0], searches[1]); assert.deepEqual(searches[1], searches[2]);
  assert.ok(searches[0].length > 0);
  assert.deepEqual(searches[0], searches[3]);
  const pokemon = await (await fetch(base + "/api/games?q=" + encodeURIComponent("ポケットモンスター ブラック2・ホワイト2"))).json();
  assert.deepEqual(pokemon.results.map(g => g.id), [8284, 8353]);
  const honkai = await (await fetch(base + "/api/games?q=honkai%3Astar%20rail")).json();
  assert.deepEqual(honkai.results.map(g => g.id), [178282]);
  const legacyList = await (await fetch(base + "/api/bgms?igdb_game_id=100")).json();
  assert.deepEqual(legacyList.bgms.map(b => b.id), [1], "Game-specific list includes unchanged legacy records");
  for (const q of ["生命ある者へ", "生命", "ある", "者", "生命ある"]) {
    const response = await fetch(base + "/api/bgms?q=" + encodeURIComponent(q));
    assert.equal(response.status, 200);
    assert.ok((await response.json()).bgms.some(bgm => bgm.id === 10), `${q} finds 生命ある者へ`);
  }
  assert.ok((await (await fetch(base + "/api/bgms?q=" + encodeURIComponent("久の"))).json()).bgms.some(bgm => bgm.id === 12), "Another Japanese title supports middle matching");
  assert.ok((await (await fetch(base + "/api/bgms?q=" + encodeURIComponent("cing M"))).json()).bgms.some(bgm => bgm.id === 11), "English titles support partial matching");
  assert.deepEqual((await (await fetch(base + "/api/bgms?q=" + encodeURIComponent("存在しない文字列"))).json()).bgms, []);
  const emptyBug = await request("/api/reports", { report_type: "site_bug", message: "", page_url: base, user_agent: "Fixture Browser" });
  assert.equal(emptyBug.status, 400);
  const bug = await request("/api/reports", { report_type: "site_bug", category: "検索", message: "部分一致検索で結果が出ません。", page_url: base + "/?fixture=1", user_agent: "Fixture Browser" });
  assert.equal(bug.status, 201, JSON.stringify(bug));
  for (const title of ["playsexwithme", "ＰＬＡＹ ＳＥＸ ＷＩＴＨ ＭＥ"]) assert.equal((await request("/api/bgms", { title, igdb_game_id: 100 })).status, 400);
  assert.equal((await fetch(base + "/api/games?q=unavailable")).status, 502);
  assert.equal((await fetch(base + "/api/games?q=" + "a".repeat(151))).status, 400);
  assert.deepEqual((await (await fetch(base + "/api/games?q=" + encodeURIComponent("！？"))).json()).results, []);
  const bad = await request("/api/bgms", { title: "bad", igdb_game_id: 100, rawg_game_id: 100 });
  assert.equal(bad.status, 400);
  const payload = { title: "API検証用BGM", composer: "Fixture", igdb_game_id: 100 };
  const added = await request("/api/bgms", payload);
  assert.equal(added.status, 201, JSON.stringify(added));
  assert.equal(added.data.bgm.igdb_game_id, 100);
  assert.equal(added.data.bgm.rawg_game_id, null);
  assert.equal(added.data.bgm.game_title, "Monster Hunter: World");
  const id = added.data.bgm.id;
  const duplicate = await request("/api/bgms", payload);
  assert.equal(duplicate.status, 409);
  const legacyDuplicate = await request("/api/bgms", { title: "Fixture BGM 1", igdb_game_id: 100 });
  assert.equal(legacyDuplicate.status, 409);
  assert.equal((await request("/api/bgms", { bgm_id: id, igdb_game_id: 200 }, "PATCH")).status, 401);
  assert.equal((await request("/api/bgms", { bgm_id: id, igdb_game_id: 200 }, "PATCH", "invalid")).status, 403);
  const session = await (await fetch(db + "/auth/v1/token?grant_type=password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password: "fixture-password" }) })).json();
  const edited = await request("/api/bgms", { bgm_id: id, igdb_game_id: 200 }, "PATCH", session.access_token);
  assert.equal(edited.status, 200, JSON.stringify(edited));
  assert.equal(edited.data.bgm.id, id);
  assert.equal(edited.data.bgm.igdb_game_id, 200);
  assert.equal(edited.data.bgm.rawg_game_id, null);
  const oldClient = await request("/api/bgms", { title: "旧クライアント検証", rawg_game_id: 300 });
  assert.equal(oldClient.status, 201, JSON.stringify(oldClient));
  assert.equal(oldClient.data.bgm.rawg_game_id, 300);
  assert.equal(oldClient.data.bgm.igdb_game_id, null);
  const unrelatedIgdb = await request("/api/bgms", { title: "旧クライアント検証", igdb_game_id: 300 });
  assert.equal(unrelatedIgdb.status, 201, "Equal numeric provider IDs must not collide");
  for (const host of ["images.igdb.com", "media.rawg.io", "api.rawg.io"]) {
    const response = await fetch(base + "/api/image-proxy?url=" + encodeURIComponent(`https://${host}/image.png`));
    assert.equal(response.status, 200);
  }
  assert.equal((await fetch(base + "/api/image-proxy?url=" + encodeURIComponent("https://example.com/image.png"))).status, 403);
  assert.equal((await fetch(base + "/api/image-proxy?url=" + encodeURIComponent("http://images.igdb.com/image.png"))).status, 403);
  const set = await request("/api/sets", { title: "API公開検証", bgm_ids: [1,2,3,4,5,6,7,8,9], comments: ["思い出の曲", "", "", "", "", "", "", "", ""] });
  assert.equal(set.status, 201);
  assert.equal(set.data.edit_token, undefined, "Published pages do not receive an edit credential");
  assert.equal((await request("/api/sets", { bgm_ids: [1,1,2,3,4,5,6,7,8] })).status, 400);
  const memberSession = await (await fetch(db + "/auth/v1/token?grant_type=password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "member@example.test", password: "fixture-password" }) })).json();
  assert.equal((await request("/api/bgms", { bgm_id: id, igdb_game_id: 100 }, "PATCH", memberSession.access_token)).status, 403);
  const named = await request("/api/sets", { title: "作成者検証", creator_name: "入力した作成者", bgm_ids: [1,2,3,4,5,6,7,8,9] });
  assert.equal(named.status, 201, JSON.stringify(named));
  const after = await (await fetch(db + "/fixture/state")).json();
  const savedBug = after.bgm_reports.find(report => report.detail?.startsWith("[サイト不具合]"));
  assert.ok(savedBug);
  assert.match(savedBug.detail, /\[種類\]\n検索/);
  assert.match(savedBug.detail, /\[URL\]\nhttp:\/\/127\.0\.0\.1:3001\/\?fixture=1/);
  assert.match(savedBug.detail, /\[User Agent\]\nFixture Browser/);
  assert.deepEqual(after.bgms.filter(row => row.id <= 9), before.bgms.filter(row => row.id <= 9));
  assert.deepEqual(after.bgm_sets[0], before.bgm_sets[0]);
  assert.deepEqual(after.games, before.games, "Search must not write the dictionary");
  assert.equal(after.bgm_sets.find(s => s.share_id === named.data.share_id).creator_name, "入力した作成者");
  assert.deepEqual(after.bgm_sets.find(s => s.share_id === set.data.share_id).comments, ["思い出の曲", "", "", "", "", "", "", "", ""]);
});
