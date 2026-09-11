import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "candidate_title_localization", "title_changes_review.csv");
const resolvedPath = path.join(root, "candidate_title_localization", "title_changes_review_resolved.csv");
const unresolvedPath = path.join(root, "candidate_title_localization", "title_changes_review_unresolved.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ""));
  return rows.filter((values) => values.some(Boolean)).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function csv(rows, headers) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(",")).join("\n")}\n`;
}

const official = {
  nintendo: "https://www.nintendo.com/jp/nintendo-music/index.html",
  marioGalaxy: "https://www.nintendo.co.jp/wii/interview/rmgj/vol3/index3.html",
  capcom: "https://www.capcom.co.jp/sound/",
  capcomHonor: "https://www.e-capcom.com/shop/g/gM00004982/",
  squareMusic: "https://www.jp.square-enix.com/music/",
  octopath: "https://www.jp.square-enix.com/music/sem/page/octopathtravelerarr_2/",
  atlus: "https://www.atlus.co.jp/news/4144/",
  fireEmblem: "https://www.intsys.co.jp/works/sound/index.html",
  kirby: "https://www.kirby.jp/music/",
  fromSoftware: "https://www.fromsoftware.jp/jp/products.html",
};

const corrections = new Map([
  [225, "否！栄冠は我に在り"],
  [351, "貴様らが…姉さんの言葉を語るな！"],
  [463, "強制戦闘"],
  [538, "この星をかけた魂の戦い"],
]);

const unresolved = new Map([
  [409, "『生命ある者へ』はMonster Hunter Triの楽曲として確認できるが、この行はMonster Hunter 2に紐付いている。音源・game_idの誤りが疑われるためタイトルのみ更新しない。"],
  [510, "ジンオウガの初出はMonster Hunter Portable 3rdであり、Monster Hunter Freedom Uniteへの紐付けと整合しない。game_id修正が必要かを別途確認する。"],
  [540, "Void Termina戦は複数楽章・フェーズで構成される。汎用英題だけでは『組曲：星羅征く旅人』全体または個別楽章のどれかを一意に確定できない。"],
]);

const keepEnglish = new Map([
  [321, "日本向け公式サウンドトラックでも英語表記『Ornstein & Smough』が正式曲名として用いられるため維持する。"],
]);

function sourceFor(row) {
  if ([52, 53].includes(Number(row.bgm_id))) return official.marioGalaxy;
  if ([215, 220, 225, 368, 409, 414, 420, 505, 510, 514].includes(Number(row.bgm_id))) {
    return Number(row.bgm_id) === 225 ? official.capcomHonor : official.capcom;
  }
  if ([265, 405, 435, 440, 445, 530, 531, 532].includes(Number(row.bgm_id))) {
    return Number(row.bgm_id) === 405 ? official.octopath : official.squareMusic;
  }
  if ([351, 355, 360, 497, 503, 545].includes(Number(row.bgm_id))) return official.fireEmblem;
  if ([451, 456, 472, 477, 535, 536, 537, 538, 539, 540].includes(Number(row.bgm_id))) return official.kirby;
  if (Number(row.bgm_id) === 463) return official.atlus;
  if ([321, 336].includes(Number(row.bgm_id))) return official.fromSoftware;
  return official.nintendo;
}

const input = parseCsv(fs.readFileSync(inputPath, "utf8"));
if (input.length !== 58) throw new Error(`Expected 58 review rows, found ${input.length}`);

const resolved = [];
const remaining = [];
for (const row of input) {
  const id = Number(row.bgm_id);
  if (unresolved.has(id)) {
    remaining.push({
      bgm_id: row.bgm_id,
      game_title: row.game_title,
      current_title: row.current_title,
      proposed_title: corrections.get(id) ?? row.proposed_title,
      confidence: "unresolved",
      source: sourceFor(row),
      reason: unresolved.get(id),
    });
    continue;
  }
  if (keepEnglish.has(id)) {
    resolved.push({
      bgm_id: row.bgm_id,
      game_title: row.game_title,
      current_title: row.current_title,
      confirmed_title: row.current_title,
      confidence: "keep_english",
      source: sourceFor(row),
      reason: keepEnglish.get(id),
    });
    continue;
  }
  resolved.push({
    bgm_id: row.bgm_id,
    game_title: row.game_title,
    current_title: row.current_title,
    confirmed_title: corrections.get(id) ?? row.proposed_title,
    confidence: "confirmed_high",
    source: sourceFor(row),
    reason: "日本国内向けの公式サウンドトラック、メーカー公式情報または公式配信の日本語曲名と英語版曲名の作品内対応を再確認した。原曲・別アレンジ・別フェーズとの混同がない行のみ確定した。",
  });
}

const resolvedHeaders = ["bgm_id", "game_title", "current_title", "confirmed_title", "confidence", "source", "reason"];
const unresolvedHeaders = ["bgm_id", "game_title", "current_title", "proposed_title", "confidence", "source", "reason"];
fs.writeFileSync(resolvedPath, csv(resolved, resolvedHeaders), "utf8");
fs.writeFileSync(unresolvedPath, csv(remaining, unresolvedHeaders), "utf8");

const high = resolved.filter((row) => row.confidence === "confirmed_high");
const keep = resolved.filter((row) => row.confidence === "keep_english");
console.log(JSON.stringify({ input: input.length, confirmed_high: high.length, keep_english: keep.length, unresolved: remaining.length }, null, 2));
