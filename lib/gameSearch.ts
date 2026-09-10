export type IgdbGame = {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  alternative_names?: Array<{ name?: string }>;
  game_localizations?: Array<{ name?: string }>;
  parent_game?: number;
  game_type?: { type?: string };
};

export type GameSearchResult = {
  id: number;
  game_id?: number | null;
  source: "igdb";
  name: string;
  image: string | null;
  released: string | null;
};

export type LogicalGameMapping = {
  game_id: number;
  external_id: number;
};

export type LogicalGameAlias = {
  game_id: number;
  alias: string;
};

export type LocalGame = {
  id: number;
  igdb_game_id: number | null;
  rawg_game_id: number | null;
  name: string;
  image_url: string | null;
  released: string | null;
  matched_alias?: string;
  similarity_score?: number;
};

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[\s　:：・\-_.／/\\'"’“”!?！？()[\]{}【】「」『』,，&＆+＋]+/g, "");
}

// Search aliases only: these must never be used to assign provider IDs.
// Keep suffixes so World/Rise searches are not broadened to the whole series.
export function canonicalSearchQuery(value: string) {
  const query = value.normalize("NFKC").trim().toLowerCase()
    .replace(/モンスター[\s・]*ハンター/g, "monster hunter ")
    .replace(/モンハン/g, "monster hunter ")
    .replace(/(?:ポケットモンスター|ポケモン)/g, "pokemon ")
    .replace(/pokémon/g, "pokemon")
    .replace(/ブラック/g, "black ").replace(/ホワイト/g, "white ")
    .replace(/ダイヤモンド/g, "diamond ").replace(/パール/g, "pearl ")
    .replace(/プラチナ/g, "platinum ")
    .replace(/崩壊[\s:：・]*スターレイル/g, "honkai star rail")
    .replace(/ワールド/g, "world").replace(/ライズ/g, "rise").replace(/ワイルズ/g, "wilds")
    .replace(/\bmonster\s*hunter(?=$|[\s:：\-\d]|world\b|rise\b|wilds\b)/g, "monster hunter ")
    .replace(/\s+/g, " ").trim();
  return query.startsWith("pokemon") ? query.replace(/\bversion\s*/g, "").replace(/金/g, "gold").replace(/銀/g, "silver") : query;
}

// IGDB stores paired Pokémon releases separately. Expand the query to both
// provider records; collapseLogicalGames later merges IDs mapped to one game_id.
export function gameSearchQueries(value: string): string[] {
  const query = canonicalSearchQuery(value);
  if (query.startsWith("pokemon")) {
    const versions = query.slice(7).split(/[・／/＆&、]|\band\b/).map(s => s.trim()).filter(Boolean);
    if (versions.length > 1) return versions.slice(0, 3).map(s => `pokemon ${s}`);
  }
  return [query];
}

export function matchesSearch(value: string, query: string) {
  const name = normalizeSearchText(canonicalSearchQuery(value));
  return gameSearchQueries(query).some(q => name.includes(normalizeSearchText(q)));
}

export function gameNames(game: IgdbGame) {
  return [game.name, ...[...(game.alternative_names ?? []), ...(game.game_localizations ?? [])].flatMap(a => a.name ? [a.name] : [])];
}

export function toSearchResult(game: IgdbGame): GameSearchResult {
  return {
    id: game.id,
    source: "igdb",
    name: game.name,
    image: game.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
      : null,
    released: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
  };
}

function scoreName(name: string, query: string) {
  return Math.max(...gameSearchQueries(query).map(q => scoreSingleName(name, q)));
}

function scoreSingleName(name: string, query: string) {
  const n = normalizeSearchText(canonicalSearchQuery(name));
  const q = normalizeSearchText(canonicalSearchQuery(query));
  if (!n || !q) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 800;
  if (n.includes(q)) return 650;
  if (n.length >= 4 && q.includes(n)) return 500;
  return 0;
}

export function rankGames(local: LocalGame[], remote: IgdbGame[], query: string) {
  const entries = new Map<number, { game: GameSearchResult; score: number }>();
  for (const item of local) {
    // A RAWG ID is never a substitute for a missing IGDB ID.
    if (!Number.isSafeInteger(item.igdb_game_id) || item.igdb_game_id! <= 0) continue;
    const score = Math.max(scoreName(item.name, query), scoreName(item.matched_alias ?? "", query));
    const previous = entries.get(item.igdb_game_id!);
    if (previous && previous.score >= score) continue;
    entries.set(item.igdb_game_id!, {
      game: { id: item.igdb_game_id!, source: "igdb", name: item.name, image: item.image_url, released: item.released },
      score,
    });
  }
  for (const item of remote) {
    const previous = entries.get(item.id);
    const game = toSearchResult(item);
    entries.set(item.id, {
      game: { ...game, image: game.image ?? previous?.game.image ?? null, released: game.released ?? previous?.game.released ?? null },
      score: Math.max(previous?.score ?? 0, ...gameNames(item).map(name => scoreName(name, query))),
    });
  }
  return [...entries.values()].filter(item => item.score > 0).sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const an = normalizeSearchText(a.game.name);
    const bn = normalizeSearchText(b.game.name);
    return (an < bn ? -1 : an > bn ? 1 : 0) || a.game.id - b.game.id;
  }).slice(0, 6).map(item => item.game);
}

export function collapseLogicalGames(
  results: GameSearchResult[],
  logicalGames: LocalGame[],
  mappings: LogicalGameMapping[],
) {
  const gameById = new Map(logicalGames.map(game => [game.id, game]));
  const gameIdByExternalId = new Map(mappings.map(mapping => [mapping.external_id, mapping.game_id]));
  const collapsed = new Map<string, GameSearchResult>();
  for (const result of results) {
    const gameId = gameIdByExternalId.get(result.id);
    const logical = gameId == null ? undefined : gameById.get(gameId);
    const value = logical ? {
      ...result,
      game_id: logical.id,
      name: logical.name,
      image: logical.image_url ?? result.image,
      released: logical.released ?? result.released,
    } : result;
    const key = logical ? `game:${logical.id}` : `igdb:${result.id}`;
    if (!collapsed.has(key)) collapsed.set(key, value);
  }
  return [...collapsed.values()];
}
