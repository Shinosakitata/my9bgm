const adminId = "11111111-1111-4111-8111-111111111111";
const cover = "https://images.igdb.com/igdb/image/upload/t_cover_big/co2w44.jpg";
const rawgCover = "https://media.rawg.io/media/games/21c/21cc15d233117c6809ec86870559e105.jpg";
const games = [
  { id: 69721, name: "Monster Hunter", cover: { image_id: "co2w44" }, alternative_names: [{ name: "モンスターハンター" }], first_release_date: 1078963200 },
  { id: 100, name: "Monster Hunter: World", cover: { image_id: "co2w44" }, alternative_names: [{ name: "モンスターハンター：ワールド" }] },
  { id: 200, name: "Monster Hunter Rise", cover: { image_id: "co2w44" } },
  { id: 300, name: "Final Fantasy VII", cover: { image_id: "co2w44" } },
  { id: 8284, name: "Pokémon Black Version 2", alternative_names: [{ name: "Pokémon Black 2" }] },
  { id: 8353, name: "Pokémon White Version 2", alternative_names: [{ name: "Pokémon White 2" }] },
  { id: 999, name: "Star Fox 2" },
  { id: 178282, name: "Honkai: Star Rail", game_type: { type: "Main Game" } },
  { id: 322770, name: "Honkai: Star Rail - A New Venture on the Eighth Dawn", parent_game: 178282, game_type: { type: "Update" } },
];
function seed() {
  return {
    bgms: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, title: `Fixture BGM ${i + 1}`, game_title: i === 0 ? "Monster Hunter: World" : `Legacy Game ${i + 1}`, composer: "Fixture Composer", rawg_game_id: 9000 + i, igdb_game_id: null, normalized_title: `fixturebgm${i + 1}`, image_url: i % 2 ? cover : rawgCover, is_hidden: false })),
    bgm_sets: [{ id: 1, share_id: "fixtureShare", title: "既存セット検証", bgm_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9], created_at: "2026-09-10T00:00:00Z" }],
    bgm_reports: [], games: [],
  };
}
module.exports = { adminId, games, seed };
