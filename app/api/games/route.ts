import { NextRequest, NextResponse } from "next/server";
import { canonicalSearchQuery, collapseLogicalGames, normalizeSearchText, rankGames, type LocalGame, type LogicalGameAlias, type LogicalGameMapping } from "../../../lib/gameSearch";
import { searchIgdb } from "../../../lib/igdb";

async function searchLocalGames(query: string): Promise<LocalGame[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing");
  const response = await fetch(`${url}/rest/v1/rpc/search_games`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ search_text: normalizeSearchText(query), result_limit: 50 }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Local search failed (${response.status})`);
  return await response.json() as LocalGame[];
}

async function fetchAllRows<T>(requestUrl: string, headers: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const separator = requestUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${requestUrl}${separator}offset=${offset}&limit=1000`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Logical catalog lookup failed (${response.status})`);
    const page = await response.json() as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function loadLogicalCatalog(): Promise<{ games: LocalGame[]; mappings: LogicalGameMapping[]; aliases: LogicalGameAlias[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const mappings = await fetchAllRows<LogicalGameMapping>(
    `${url}/rest/v1/game_external_ids?provider=eq.igdb&select=game_id,external_id&order=id`, headers,
  );
  const ids = [...new Set(mappings.map(mapping => mapping.game_id))];
  if (!ids.length) return { games: [], mappings, aliases: [] };
  const [gameResponse, aliases] = await Promise.all([
    fetch(`${url}/rest/v1/games?id=in.(${ids.join(",")})&select=id,igdb_game_id,rawg_game_id,name,image_url,released`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(5000),
    }),
    fetchAllRows<LogicalGameAlias>(
      `${url}/rest/v1/game_aliases?game_id=in.(${ids.join(",")})&select=game_id,alias&order=id`, headers,
    ),
  ]);
  if (!gameResponse.ok) throw new Error(`Logical game lookup failed (${gameResponse.status})`);
  return {
    games: await gameResponse.json() as LocalGame[],
    mappings,
    aliases,
  };
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!input || !normalizeSearchText(input)) return NextResponse.json({ results: [] });
  if (input.length > 150 || /[\u0000-\u001f\u007f]/.test(input)) {
    return NextResponse.json({ error: "ゲーム名は150文字以内で入力してください。" }, { status: 400 });
  }
  const query = canonicalSearchQuery(input);
  const [localOriginal, localCanonical, remote, catalog] = await Promise.allSettled([
    searchLocalGames(input), query === input ? Promise.resolve([]) : searchLocalGames(query), searchIgdb(query), loadLogicalCatalog(),
  ]);
  const localGames = [...new Map([
    ...(localOriginal.status === "fulfilled" ? localOriginal.value : []),
    ...(localCanonical.status === "fulfilled" ? localCanonical.value : []),
  ].map(game => [game.id, game])).values()];
  const remoteGames = remote.status === "fulfilled" ? [...remote.value] : [];
  const logicalCatalog = catalog.status === "fulfilled" ? catalog.value : { games: [], mappings: [], aliases: [] };
  const numericId = /^\d+$/.test(input) ? Number(input) : null;
  if (numericId != null) {
    const mapping = logicalCatalog.mappings.find(item => item.external_id === numericId);
    const logical = mapping && logicalCatalog.games.find(game => game.id === mapping.game_id);
    if (logical) return NextResponse.json({ results: [{ id: numericId, game_id: logical.id, source: "igdb", name: logical.name, image: logical.image_url, released: logical.released }], source: "local", partial: false });
  }
  // Existing Japanese aliases can supply a canonical query even on RAWG-only rows.
  // This expands search terms only; it never creates a provider-ID mapping.
  if (remote.status === "fulfilled" && remoteGames.length === 0) {
    const normalized = normalizeSearchText(query);
    const names = [...new Set(localGames.filter(game =>
      normalizeSearchText(game.matched_alias ?? "").includes(normalized)
    ).map(game => canonicalSearchQuery(game.name)))].filter(name => name !== query).sort().slice(0, 3);
    const expanded = await Promise.allSettled(names.map(searchIgdb));
    for (const result of expanded) if (result.status === "fulfilled") remoteGames.push(...result.value);
  }
  const mappedLocalGames = [...localGames];
  const exactCatalogAliases = logicalCatalog.aliases.filter(alias =>
    normalizeSearchText(canonicalSearchQuery(alias.alias)) === normalizeSearchText(query)
  );
  for (const logical of logicalCatalog.games) {
    const match = localGames.find(game => game.id === logical.id);
    const external = logicalCatalog.mappings.find(mapping => mapping.game_id === logical.id);
    if (match && external) mappedLocalGames.push({ ...match, igdb_game_id: external.external_id });
    const exactAlias = exactCatalogAliases.find(alias => alias.game_id === logical.id);
    if (exactAlias && external) {
      mappedLocalGames.push({ ...logical, igdb_game_id: external.external_id, matched_alias: exactAlias.alias });
    }
  }
  const mappedLogicalIds = new Set(logicalCatalog.mappings.map(mapping => mapping.game_id));
  const exactLogicalIds = new Set(localGames.filter(game =>
    mappedLogicalIds.has(game.id)
      && game.matched_alias
      && normalizeSearchText(canonicalSearchQuery(game.matched_alias)) === normalizeSearchText(query)
  ).map(game => game.id));
  for (const game of logicalCatalog.games) {
    if (normalizeSearchText(canonicalSearchQuery(game.name)) === normalizeSearchText(query)) {
      exactLogicalIds.add(game.id);
    }
  }
  for (const alias of exactCatalogAliases) exactLogicalIds.add(alias.game_id);
  let results = collapseLogicalGames(rankGames(mappedLocalGames, remoteGames, query), logicalCatalog.games, logicalCatalog.mappings)
    .sort((a, b) => Number(!exactLogicalIds.has(a.game_id ?? -1)) - Number(!exactLogicalIds.has(b.game_id ?? -1)));
  // An exact alias identifies the My9GameMusic logical game. Once found, omit the
  // individual provider records and incidental partial matches from the list.
  if (exactLogicalIds.size > 0) {
    results = results.filter(result => result.game_id != null && exactLogicalIds.has(result.game_id));
  }
  if (localOriginal.status === "rejected" && localCanonical.status === "rejected") console.error("Local game search unavailable:", localOriginal.reason);
  if (catalog.status === "rejected") console.error("Logical game catalog unavailable:", catalog.reason);
  if (remote.status === "rejected") console.error("IGDB search unavailable:", remote.reason);
  if (remote.status === "rejected" && results.length === 0) {
    return NextResponse.json({ error: "ゲーム検索に失敗しました。しばらくしてから再度お試しください。" }, { status: 502 });
  }
  // Searching is read-only: history cannot rewrite provider mappings or affect ranks.
  return NextResponse.json({ results, source: remote.status === "fulfilled" ? "merged" : "local", partial: remote.status === "rejected" });
}
