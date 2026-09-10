/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { adminId } = require("./fixture-data.cjs");
const root = path.resolve(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "my9bgm-igdb-test-"));
// Copy the real application; never copy credentials or production database contents.
for (const entry of ["app", "lib", "public", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) fs.cpSync(path.join(root, entry), path.join(dir, entry), { recursive: true });
fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction");
fs.writeFileSync(path.join(dir, "package-lock.json"), '{"name":"my9bgm","lockfileVersion":3,"packages":{}}');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4011", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", RATE_LIMIT_SECRET: "fixture-rate-secret", NEXT_PUBLIC_ADMIN_USER_ID: adminId, IGDB_CLIENT_ID: "fixture-client", IGDB_CLIENT_SECRET: "fixture-secret", RAWG_API_KEY: "fixture-rawg", NODE_OPTIONS: `--require "${path.join(__dirname, "fixture-fetch.cjs").split(path.sep).join("/")}"` };
const db = spawn(process.execPath, [path.join(__dirname, "fixture-server.cjs")], { stdio: "inherit", env });
const app = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3001"], { cwd: dir, stdio: "inherit", env });
console.log(`Isolated application copy: ${dir}`);
console.log("Test admin: admin@example.test / fixture-password");
const stop = () => { app.kill(); db.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", code => { db.kill(); process.exitCode = code ?? 0; });

