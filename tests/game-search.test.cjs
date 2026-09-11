/* eslint-disable @typescript-eslint/no-require-imports */
require("./register-ts.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { canonicalSearchQuery, collapseLogicalGames, rankGames } = require("../lib/gameSearch.ts");
const { parseGameReference, belongsToGame } = require("../lib/bgmGame.ts");

test("Japanese, spaced, compact, full-width inputs resolve to the same query", () => {
  for (const q of ["モンハン", "モンスターハンター", "monster hunter", "monsterhunter", " ＭＯＮＳＴＥＲ　ＨＵＮＴＥＲ "]) {
    assert.equal(canonicalSearchQuery(q), "monster hunter");
  }
  assert.equal(canonicalSearchQuery("monsterhunter world"), "monster hunter world");
  assert.equal(canonicalSearchQuery("モンスターハンターライズ"), "monster hunter rise");
  assert.equal(canonicalSearchQuery("Final Fantasy VII"), "final fantasy vii");
});

test("BGM catalog search supports title substrings without breaking game and composer search", () => {
  const { matchesBgmCatalog, matchesBgmTitle } = require("../lib/bgmSearch.ts");
  const japanese = { title: "生命ある者へ", normalized_title: "生命ある者へ", game_title: "Monster Hunter Tri", composer: null };
  for (const query of ["生命ある者へ", "生命", "ある", "者", "生命ある"]) assert.equal(matchesBgmTitle(japanese, query), true);
  assert.equal(matchesBgmTitle({ title: "悠久の風", normalized_title: "悠久の風" }, "久の"), true);
  assert.equal(matchesBgmTitle({ title: "Dancing Mad", normalized_title: "dancingmad" }, "cing M"), true);
  assert.equal(matchesBgmCatalog(japanese, "Monster Hunter Tri"), true);
  assert.equal(matchesBgmCatalog({ ...japanese, game_title: "Monster Hunter: World" }, "モンハンワールド"), true);
  assert.equal(matchesBgmCatalog({ ...japanese, composer: "Nobuo Uematsu" }, "uematsu"), true);
  assert.equal(matchesBgmCatalog(japanese, "存在しない文字列"), false);
});

test("paired Pokémon queries find both provider records before logical collapse", () => {
  const { matchesSearch } = require("../lib/gameSearch.ts");
  const games = [{ id: 1, name: "Pokémon Black Version 2" }, { id: 2, name: "Pokémon White Version 2" }, { id: 3, name: "Star Fox 2" }];
  assert.deepEqual(rankGames([], games, "ポケットモンスター ブラック2・ホワイト2").map(g => g.id), [1, 2]);
  assert.equal(matchesSearch("Monster Hunter: World", "モンハン"), true);
  assert.equal(matchesSearch("Pokémon Black Version 2", "ポケモン ブラック2"), true);
});

test("moderation and typo hints do not merge songs or block innocent words", () => {
  const { inappropriateText, similarTitle, usernameError } = require("../lib/textValidation.ts");
  for (const value of ["playsexwithme", "ＰＬＡＹ ＳＥＸ ＷＩＴＨ ＭＥ", "play\u200bsex-with-me"]) assert.equal(inappropriateText(value), true);
  for (const value of ["Sussex", "戦闘！トレーナー", "通常戦闘BGM"]) assert.equal(inappropriateText(value), false);
  assert.equal(similarTitle("戦闘！トレーナー", "戦闘トレーナー"), true);
  assert.equal(similarTitle("戦闘！トレーナー", "通常戦闘BGM"), false);
  assert.ok(usernameError(" "));
});

test("incorrect search aliases never attach a legacy song to another Pokémon version", () => {
  const white = { igdb_game_id: 8353, rawg_game_id: null, game_title: "Pokémon White Version 2", names: ["Pokemon Black 2", "Pokemon White 2"] };
  assert.equal(belongsToGame({ igdb_game_id: null, rawg_game_id: 100, game_title: "Pokémon Black Version 2" }, white), false);
  assert.equal(belongsToGame({ igdb_game_id: null, rawg_game_id: 200, game_title: "ポケットモンスター ホワイト2" }, white), true);
  assert.equal(belongsToGame({ igdb_game_id: 8284, rawg_game_id: null, game_title: white.game_title }, white), false);
});

test("ranking does not depend on query spelling, remote order, or a cached copy", () => {
  const games = [{ id: 10, name: "Monster Hunter" }, { id: 20, name: "Monster Hunter: World" }, { id: 30, name: "Monster Hunter Rise" }];
  const local = [{ id: 777, igdb_game_id: 20, rawg_game_id: 9000, name: games[1].name, image_url: null, released: null, matched_alias: games[1].name, similarity_score: 1 }];
  const expected = rankGames([], games, "monster hunter");
  for (const query of ["モンスターハンター", "monster hunter", "monsterhunter"]) {
    assert.deepEqual(rankGames(local, [...games].reverse(), query), expected);
  }
});

test("RAWG IDs and missing IGDB IDs cannot enter IGDB results", () => {
  const local = [null, undefined].map(igdb_game_id => ({ id: 1, igdb_game_id, rawg_game_id: 10, name: "Monster Hunter", image_url: null, released: null }));
  assert.deepEqual(rankGames(local, [], "monster hunter"), []);
  assert.deepEqual(parseGameReference({ igdb_game_id: 10 }), { source: "igdb", id: 10 });
  assert.deepEqual(parseGameReference({ rawg_game_id: "10" }), { source: "rawg", id: 10 });
  for (const payload of [{ igdb_game_id: 10, rawg_game_id: 10 }, { igdb_game_id: true }, { igdb_game_id: -1 }, { igdb_game_id: "1e2" }, {}]) assert.equal(parseGameReference(payload), null);
});

test("multiple IGDB versions collapse to one logical game", () => {
  const logical = [{ id: 97, igdb_game_id: null, rawg_game_id: null, name: "ポケットモンスター ブラック・ホワイト", image_url: "cover.jpg", released: "2010-09-18" }];
  const mappings = [{ game_id: 97, external_id: 1521 }, { game_id: 97, external_id: 1522 }];
  const ranked = [
    { id: 1521, source: "igdb", name: "Pokémon Black Version", image: null, released: null },
    { id: 1522, source: "igdb", name: "Pokémon White Version", image: null, released: null },
  ];
  const collapsed = collapseLogicalGames(ranked, logical, mappings);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].game_id, 97);
  assert.equal(collapsed[0].name, logical[0].name);

  const verified = { game_id: 97, igdb_game_id: null, rawg_game_id: null, igdb_game_ids: [1521, 1522], game_title: logical[0].name };
  assert.equal(belongsToGame({ game_id: 97, igdb_game_id: null, rawg_game_id: null, game_title: logical[0].name }, verified), true);
  assert.equal(belongsToGame({ game_id: null, igdb_game_id: 1522, rawg_game_id: null, game_title: "Pokémon White Version" }, verified), true);

  const bw2 = [{ id: 6, igdb_game_id: null, rawg_game_id: 331454, name: "ポケットモンスター ブラック2・ホワイト2", image_url: "bw2.jpg", released: "2012-06-23" }];
  const bw2Mappings = [{ game_id: 6, external_id: 8284 }, { game_id: 6, external_id: 8353 }];
  const bw2Collapsed = collapseLogicalGames([
    { id: 8284, source: "igdb", name: "Pokémon Black Version 2", image: null, released: null },
    { id: 8353, source: "igdb", name: "Pokémon White Version 2", image: null, released: null },
  ], bw2, bw2Mappings);
  assert.equal(bw2Collapsed.length, 1);
  assert.equal(bw2Collapsed[0].game_id, 6);
  assert.equal(bw2Collapsed[0].name, "ポケットモンスター ブラック2・ホワイト2");
});
