import type { SupabaseClient } from "@supabase/supabase-js";
import { getIgdbGame } from "./igdb";
import { canonicalSearchQuery, gameNames, normalizeSearchText, toSearchResult, type IgdbGame } from "./gameSearch";

export type GameReference = { source: "igdb" | "rawg"; id: number; gameId?: number };
export type VerifiedGame = {
  game_title: string;
  image_url: string | null;
  igdb_game_id: number | null;
  rawg_game_id: number | null;
  game_id: number | null;
  igdb_game_ids: number[];
  names: string[];
  igdb?: IgdbGame;
};

export function parseGameReference(payload: Record<string, unknown>): GameReference | null {
  const igdb = payload.igdb_game_id;
  const rawg = payload.rawg_game_id;
  const gameIdValue = payload.game_id;
  // Reject ambiguous payloads; never interpret an IGDB ID as a RAWG ID.
  if (igdb != null && rawg != null) return null;
  const value = igdb ?? rawg;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (gameIdValue != null && (typeof gameIdValue !== "number" || !Number.isSafeInteger(gameIdValue) || gameIdValue <= 0)) return null;
  return { source: igdb != null ? "igdb" : "rawg", id,
    ...(typeof gameIdValue === "number" ? { gameId: gameIdValue } : {}) };
}

export function normalizeBgmTitle(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s　]/g, "")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]/g, "").trim();
}

export async function verifyGame(reference: GameReference, supabase: SupabaseClient): Promise<VerifiedGame | null> {
  if (reference.source === "igdb") {
    const game = await getIgdbGame(reference.id);
    if (!game) return null;
    const { data: external, error: externalError } = await supabase.from("game_external_ids")
      .select("game_id").eq("provider", "igdb").eq("external_id", reference.id).maybeSingle();
    if (externalError) throw new Error("Logical game mapping lookup failed");
    if (external) {
      if (reference.gameId != null && reference.gameId !== external.game_id) return null;
      const [{ data: logical, error: logicalError }, { data: externalIds, error: idsError }] = await Promise.all([
        supabase.from("games").select("id,name,image_url,released").eq("id", external.game_id).maybeSingle(),
        supabase.from("game_external_ids").select("external_id").eq("provider", "igdb").eq("game_id", external.game_id),
      ]);
      if (logicalError || idsError) throw new Error("Logical game lookup failed");
      if (!logical) return null;
      return { game_id: logical.id, game_title: logical.name, image_url: logical.image_url,
        igdb_game_id: null, rawg_game_id: null, igdb_game_ids: (externalIds ?? []).map(row => row.external_id),
        names: [logical.name, ...gameNames(game)], igdb: game };
    }
    if (reference.gameId != null) return null;
    const { data, error } = await supabase.from("games").select("rawg_game_id")
      .eq("igdb_game_id", reference.id).maybeSingle();
    if (error) throw new Error("Game mapping lookup failed");
    return { game_id: null, game_title: game.name.trim(), image_url: toSearchResult(game).image,
      igdb_game_id: game.id, rawg_game_id: data?.rawg_game_id ?? null, igdb_game_ids: [game.id], names: gameNames(game), igdb: game };
  }
  // Retain the legacy submission contract for already-open RAWG clients.
  const key = process.env.RAWG_API_KEY;
  if (!key) throw new Error("RAWG credentials are missing");
  const response = await fetch(`https://api.rawg.io/api/games/${reference.id}?key=${encodeURIComponent(key)}`, {
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`RAWG verification failed (${response.status})`);
  const game = await response.json();
  if (game.id !== reference.id || typeof game.name !== "string" || !game.name.trim()) return null;
  const { data, error } = await supabase.from("games").select("igdb_game_id")
    .eq("rawg_game_id", reference.id).maybeSingle();
  if (error) throw new Error("Game mapping lookup failed");
  return { game_id: null, game_title: game.name.trim(), image_url: game.background_image ?? null,
    rawg_game_id: game.id, igdb_game_id: data?.igdb_game_id ?? null,
    igdb_game_ids: data?.igdb_game_id ? [data.igdb_game_id] : [], names: [game.name] };
}

export async function findDuplicateBgm(supabase: SupabaseClient, game: VerifiedGame, title: string, exceptId?: number) {
  // Include old rows with no normalized title; never rewrite them during checking.
  const { data, error } = await supabase.from("bgms")
    .select("id,title,game_title,normalized_title,rawg_game_id,igdb_game_id,game_id")
    .or(`normalized_title.eq.${title.replace(/[(),.]/g, "")},normalized_title.is.null`);
  if (error) throw new Error("BGM duplicate check failed");
  // Third-party aliases can contain mistakes (e.g. the other Pokémon version).
  // They help search, but must not establish identity for legacy songs.
  const name = normalizeSearchText(canonicalSearchQuery(game.game_title));
  return data?.find(row => {
    if (row.id === exceptId || (row.normalized_title ?? normalizeBgmTitle(row.title)) !== title) return false;
    if (belongsToGame(row, game)) return true;
    if (game.rawg_game_id && row.rawg_game_id) return row.rawg_game_id === game.rawg_game_id;
    // A legacy title match blocks a possible duplicate, but NEVER assigns an ID.
    return name === normalizeSearchText(canonicalSearchQuery(row.game_title));
  }) ?? null;
}

export function gameColumns(game: VerifiedGame) {
  return { game_title: game.game_title, image_url: game.image_url,
    game_id: game.game_id, igdb_game_id: game.igdb_game_id, rawg_game_id: game.rawg_game_id };
}

export function belongsToGame(row: { game_id?: number | null; igdb_game_id: number | null; rawg_game_id: number | null; game_title: string }, game: VerifiedGame) {
  if (row.game_id != null || game.game_id != null) {
    if (row.game_id != null) return row.game_id === game.game_id;
    if (row.igdb_game_id != null && game.game_id != null) return game.igdb_game_ids.includes(row.igdb_game_id);
    return false;
  }
  if (row.igdb_game_id && game.igdb_game_id) return row.igdb_game_id === game.igdb_game_id;
  if (row.rawg_game_id && game.rawg_game_id) return row.rawg_game_id === game.rawg_game_id;
  const name = normalizeSearchText(canonicalSearchQuery(row.game_title));
  return normalizeSearchText(canonicalSearchQuery(game.game_title)) === name;
}
