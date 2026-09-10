import fs from "node:fs/promises";

const oauth = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: process.env.IGDB_CLIENT_ID,
    client_secret: process.env.IGDB_CLIENT_SECRET,
    grant_type: "client_credentials",
  }),
});
if (!oauth.ok) throw new Error(`IGDB OAuth failed (${oauth.status})`);
const token = (await oauth.json()).access_token;
const headers = {
  "Client-ID": process.env.IGDB_CLIENT_ID,
  Authorization: `Bearer ${token}`,
  "Content-Type": "text/plain",
};
const fields = "fields id,name,first_release_date,alternative_names.name,game_localizations.name,cover.image_id,version_parent,game_type.type;";
const bodies = [
  `${fields} where id = (426,1561,1514,275105); limit 20;`,
  `${fields} where name ~ *"Pokemon Green"* | alternative_names.name ~ *"Pokemon Green"* | game_localizations.name ~ *"Pokemon Green"*; limit 50;`,
  `${fields} where name ~ *"Pocket Monsters Green"* | alternative_names.name ~ *"Pocket Monsters Green"* | game_localizations.name ~ *"Pocket Monsters Green"*; limit 50;`,
];
const results = [];
for (const body of bodies) {
  const response = await fetch("https://api.igdb.com/v4/games", { method: "POST", headers, body });
  if (!response.ok) throw new Error(`IGDB request failed (${response.status}): ${await response.text()}`);
  results.push(await response.json());
}
await fs.writeFile("seed_output/igdb_direct_verification.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
