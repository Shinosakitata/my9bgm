import { canonicalSearchQuery, gameSearchQueries, type IgdbGame } from "./gameSearch";

let token: { value: string; expiresAt: number } | undefined;
let tokenRequest: Promise<string> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
const cachedSearches = new Map<string, { expiresAt: number; value: IgdbGame[] }>();
const pendingSearches = new Map<string, Promise<IgdbGame[]>>();

async function accessToken() {
  if (token && token.expiresAt > Date.now()) return token.value;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("IGDB credentials are missing");
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`IGDB authentication failed (${response.status})`);
    const data = await response.json();
    if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") throw new Error("Invalid OAuth response");
    token = { value: data.access_token, expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
    return token.value;
  })();
  try { return await tokenRequest; } finally { tokenRequest = undefined; }
}

async function requestGames(body: string): Promise<IgdbGame[]> {
  // Per-process throttling, including retries. A deployment-wide limit requires a shared store.
  const request = queue.catch(() => {}).then(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const bearer = await accessToken();
      const delay = Math.max(0, lastRequestAt + 275 - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      lastRequestAt = Date.now();
      const response = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: { "Client-ID": process.env.IGDB_CLIENT_ID!, Authorization: `Bearer ${bearer}`, "Content-Type": "text/plain" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401 && attempt === 0) { token = undefined; continue; }
      if (!response.ok) throw new Error(`IGDB request failed (${response.status})`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid IGDB response");
      return data.filter((game): game is IgdbGame => Number.isSafeInteger(game?.id) && game.id > 0 && typeof game.name === "string" && Boolean(game.name.trim()));
    }
    throw new Error("IGDB authentication failed");
  });
  queue = request;
  return request;
}

const fields = "fields id,name,first_release_date,cover.image_id,alternative_names.name,game_localizations.name,parent_game,game_type.type;";

export async function searchIgdb(input: string) {
  const query = canonicalSearchQuery(input);
  const cached = cachedSearches.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = pendingSearches.get(query);
  if (pending) return pending;
  const request = (async () => {
    const batches = await Promise.all(gameSearchQueries(query).map(async term => {
      const escaped = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\*/g, "");
      // Japanese names live in aliases/localizations; numeric tokens alone are not relevant matches.
      const body = /[\u3040-\u30ff\u3400-\u9fff]/.test(term)
        ? `${fields} where version_parent = null & (name ~ *"${escaped}"* | alternative_names.name ~ *"${escaped}"* | game_localizations.name ~ *"${escaped}"*); limit 50;`
        : `search "${escaped}"; ${fields} where version_parent = null; limit 50;`;
      return requestGames(body);
    }));
    const games = batches.flat();
    const parentIds = [...new Set(games.filter(g => g.game_type?.type === "Update" && g.parent_game).map(g => g.parent_game!))];
    const missing = parentIds.filter(id => !games.some(g => g.id === id));
    const parents = missing.length ? await requestGames(`${fields} where id = (${missing.join(",")}); limit 50;`) : [];
    return [...new Map([...games.filter(g => g.game_type?.type !== "Update" || !g.parent_game), ...parents].map(game => [game.id, game])).values()];
  })();
  pendingSearches.set(query, request);
  try {
    const value = await request;
    if (cachedSearches.size >= 100) cachedSearches.delete(cachedSearches.keys().next().value!);
    cachedSearches.set(query, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    return value;
  } finally { pendingSearches.delete(query); }
}

export async function getIgdbGame(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid IGDB ID");
  const games = await requestGames(`${fields} where id = ${id}; limit 1;`);
  return games.find(game => game.id === id) ?? null;
}
