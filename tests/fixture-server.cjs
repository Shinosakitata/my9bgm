/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const { adminId, seed } = require("./fixture-data.cjs");
let state = seed();
const user = { id: adminId, email: "admin@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { display_name: "検証管理者" }, created_at: "2026-09-10T00:00:00Z" };
const member = { ...user, id: "22222222-2222-4222-8222-222222222222", email: "member@example.test", user_metadata: { display_name: "検証ユーザー" } };
const jwt = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now()/1000)+3600, role: "authenticated" })).toString("base64url"), "fixture-signature"].join(".");
const memberJwt = jwt.split(".").map((part, i) => i === 1 ? Buffer.from(JSON.stringify({ sub: member.id, exp: Math.floor(Date.now()/1000)+3600, role: "authenticated" })).toString("base64url") : part).join(".");
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  if (req.method === "OPTIONS") { res.end(); return; }
  const url = new URL(req.url, "http://127.0.0.1");
  let raw = ""; for await (const chunk of req) raw += chunk;
  let body; try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  const send = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/fixture/reset" && req.method === "POST") {
    state = seed(); user.user_metadata = { display_name: "検証管理者" };
    member.email = "member@example.test"; member.user_metadata = { display_name: "検証ユーザー" };
    return send({ ok: true });
  }
  if (url.pathname === "/fixture/state") return send(state);
  if (url.pathname === "/auth/v1/token") {
    const account = body.email === user.email ? user : body.email === member.email ? member : null;
    if (!account || body.password !== "fixture-password") return send({ error: "Invalid credentials" }, 400);
    return send({ access_token: account === user ? jwt : memberJwt, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: "fixture-refresh", user: account });
  }
  if (url.pathname === "/auth/v1/signup") {
    member.email = body.email; member.user_metadata = body.data ?? {};
    return send({ access_token: memberJwt, token_type: "bearer", expires_in: 3600, refresh_token: "fixture-refresh", user: member });
  }
  if (url.pathname === "/auth/v1/user") {
    const account = req.headers.authorization === `Bearer ${jwt}` ? user : req.headers.authorization === `Bearer ${memberJwt}` ? member : null;
    if (!account) return send({ error: "Invalid token" }, 401);
    if (req.method === "PUT") account.user_metadata = { ...account.user_metadata, ...body.data };
    return send(account);
  }
  if (url.pathname === "/auth/v1/logout") return send({});
  if (url.pathname === "/rest/v1/rpc/check_rate_limit") return send(req.headers["x-fixture-limit"] !== "deny");
  if (url.pathname === "/rest/v1/rpc/search_games") return send([]);
  const table = url.pathname.replace("/rest/v1/", "");
  if (!Array.isArray(state[table])) return send({ error: `Unexpected fixture path ${url.pathname}` }, 404);
  let rows = state[table];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith("eq.")) rows = rows.filter(row => String(row[key]) === value.slice(3));
    if (value.startsWith("in.(")) { const ids = value.slice(4, -1).split(","); rows = rows.filter(row => ids.includes(String(row[key]))); }
    if (value.startsWith("ilike.")) {
      const pattern = value.slice(6).replace(/^%|%$/g, "").replace(/\\([\\%_])/g, "$1").toLocaleLowerCase();
      rows = rows.filter(row => String(row[key] ?? "").toLocaleLowerCase().includes(pattern));
    }
  }
  if (url.searchParams.has("or")) {
    const or = url.searchParams.get("or");
    const title = or.match(/normalized_title\.eq\.([^,)]*)/)?.[1];
    const gameId = or.match(/game_id\.eq\.([^,)]*)/)?.[1];
    const igdbIds = or.match(/igdb_game_id\.in\.\(([^)]*)\)/)?.[1].split(",") ?? [];
    if (title != null) rows = rows.filter(row => row.normalized_title == null || row.normalized_title === title);
    else rows = rows.filter(row => (gameId != null && String(row.game_id) === gameId) || igdbIds.includes(String(row.igdb_game_id)));
  }
  if (req.method === "GET" && url.searchParams.has("offset")) rows = rows.slice(Number(url.searchParams.get("offset")));
  if (req.method === "GET" && url.searchParams.has("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
  if (req.method === "POST") {
    if (table === "bgms" && state.bgms.some(row => row.normalized_title === body.normalized_title && ((body.igdb_game_id && row.igdb_game_id === body.igdb_game_id) || (body.rawg_game_id && row.rawg_game_id === body.rawg_game_id)))) return send({ code: "23505", message: "duplicate" }, 409);
    const row = { id: Math.max(0, ...state[table].map(row => row.id)) + 1, created_at: new Date().toISOString(), ...body };
    state[table].push(row); rows = [row];
  } else if (req.method === "PATCH") {
    rows.forEach(row => Object.assign(row, body));
  } else if (req.method !== "GET") return send({ error: "Unsupported method" }, 405);
  const single = req.headers.accept?.includes("application/vnd.pgrst.object+json");
  if (single && rows.length !== 1) return send({ code: "PGRST116", details: `The result contains ${rows.length} rows` }, 406);
  return send(single ? rows[0] : rows, req.method === "POST" ? 201 : 200);
});
server.listen(4011, "127.0.0.1", () => console.log("Fixture Supabase: http://127.0.0.1:4011 (memory only)"));
