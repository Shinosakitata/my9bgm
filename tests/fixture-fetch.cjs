/* eslint-disable @typescript-eslint/no-require-imports */
// Loaded ONLY by the isolated test process, never by the application.
const { games } = require("./fixture-data.cjs");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return originalFetch(input, init);
  if (url.hostname === "id.twitch.tv") return Response.json({ access_token: "fixture-igdb-token", expires_in: 3600 });
  if (url.hostname === "api.igdb.com") {
    const body = String(init?.body ?? "");
    if (body.includes('search "unavailable"')) return new Response("Unavailable", { status: 503 });
    const id = body.match(/where id = (\d+)/)?.[1];
    return Response.json(id ? games.filter(g => g.id === Number(id)) : games);
  }
  if (url.hostname === "api.rawg.io") {
    const id = Number(url.pathname.split("/").pop());
    return Response.json({ id, name: "RAWG Legacy Game", background_image: null });
  }
  if (["images.igdb.com", "media.rawg.io", "placehold.co"].includes(url.hostname)) {
    // A valid opaque image, sufficient to detect Canvas fetch/export failures.
    return new Response(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64"), { headers: { "Content-Type": "image/png" } });
  }
  throw new Error(`Fixture blocked external network: ${url.hostname}`);
};
