import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path


REVIEW_REASONS = {
    "FINAL FANTASY VI": "IGDBでは原作日本版と海外版・移植版の名称が分かれており、単一の正式IDを安全に確定できない",
    "Monster Hunter Frontier Z": "IGDB候補はMonster Hunter Frontier Onlineのみで、Zを同一作品として確定できない",
    "ポケットモンスター X・Y": "XとYが別々のIGDB game IDで登録されている",
    "ポケットモンスター サン・ムーン": "サンとムーンが別々のIGDB game IDで登録されている",
    "ポケットモンスター スカーレット・バイオレット": "スカーレットとバイオレットが別々のIGDB game IDで登録されている",
    "ポケットモンスター ソード・シールド": "ソードとシールドが別々のIGDB game IDで登録されている",
    "ポケットモンスター ダイヤモンド・パール": "ダイヤモンドとパールが別々のIGDB game IDで登録されている",
    "ポケットモンスター ブラック・ホワイト": "ブラックとホワイトが別々のIGDB game IDで登録されている",
    "ポケットモンスター ブラック2・ホワイト2": "ブラック2とホワイト2が別々のIGDB game IDで登録されている",
    "ポケットモンスター ルビー・サファイア": "ルビーとサファイアが別々のIGDB game IDで登録されている",
    "ポケットモンスター 金・銀": "金と銀が別々のIGDB game IDで登録されている",
    "ポケットモンスター 赤・緑": "赤と緑が別々のIGDB game IDで登録されている",
    "ポケモン不思議のダンジョン 時の探検隊・闇の探検隊": "時の探検隊と闇の探検隊が別々のIGDB game IDで登録されている",
    "ポケモン不思議のダンジョン 青の救助隊・赤の救助隊": "青の救助隊と赤の救助隊が別々のIGDB game IDで登録されている",
}

# Search ranking alone is not identity. These IDs were selected from the returned
# candidates after checking the requested edition and release name.
OVERRIDE_IDS = {
    "Devil May Cry 3": 136,
    "FINAL FANTASY IV": 16587,
    "Hades": 113112,
    "Minecraft": 121,
    "MOTHER3": 3683,
    "NieR:Automata": 11208,
    "Pokémon LEGENDS アルセウス": 144054,
    "スーパーマリオワールド": 1070,
    "ゼノブレイド3": 191411,
    "ソフィーのアトリエ": 12633,
    "ペルソナ3 リロード": 252647,
    "ペルソナ5 ザ・ロイヤル": 114283,
    "メタファー：リファンタジオ": 26602,
    "リディー＆スールのアトリエ": 36814,
    "勝利の女神：NIKKE": 117199,
    "真・女神転生V": 26775,
    "星のカービィ Wii": 3725,
    "大逆転裁判 -成歩堂龍ノ介の冒險-": 76244,
    "東方永夜抄 ～ Imperishable Night.": 27162,
    "東方紅魔郷 ～ the Embodiment of Scarlet Devil.": 27155,
    "東方風神録 ～ Mountain of Faith.": 27167,
    "東方妖々夢 ～ Perfect Cherry Blossom.": 27166,
}

GAME_EQUIVALENTS = {
    "Monster Hunter Frontier Z": {"Monster Hunter Frontier G"},
    "ポケットモンスター ブラック2・ホワイト2": {"Pokémon Black 2, White 2"},
    "Pokémon LEGENDS Z-A": {"Pokémon Legends: Z-A", "Pokémon Legends Z-A"},
    "崩壊：スターレイル": {"Honkai Star Rail", "Honkai: Star Rail"},
    "スーパーマリオ64": {"Super Mario 64"},
    "Monster Hunter: World": {"Monster Hunter: World"},
}


def normalize_bgm(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r'''[\s　!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]''', "", value).strip()


def normalize_game(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r"[^0-9a-z\u3040-\u30ff\u3400-\u9fff]+", "", value)


def load_candidates(paths):
    by_game = {}
    id_index = {}
    for path in paths:
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        for game, payload in data.items():
            results = payload.get("results", [])
            if results:
                by_game[game] = results
            for item in results:
                id_index[int(item["id"])] = item
    return by_game, id_index


def sql_literal(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--work", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    input_path, work, output = Path(args.input), Path(args.work), Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    with input_path.open(encoding="utf-8-sig", newline="") as handle:
        seeds = list(csv.DictReader(handle))
    existing = json.loads((work / "existing_bgms.json").read_text(encoding="utf-8-sig"))
    candidates, id_index = load_candidates([
        work / "igdb_candidates.json",
        work / "igdb_alias_candidates.json",
        work / "igdb_extra_candidates.json",
    ])

    existing_by_title = {}
    for row in existing:
        key = row.get("normalized_title") or normalize_bgm(row["title"])
        existing_by_title.setdefault(key, []).append(row)

    analyses = []
    unmatched_games = {}
    for seed in seeds:
        source_game = seed["game_title"].strip()
        title = seed["bgm_title"].strip()
        normalized = normalize_bgm(title)
        duplicate = None
        for current in existing_by_title.get(normalized, []):
            allowed = {source_game, *GAME_EQUIVALENTS.get(source_game, set())}
            if any(normalize_game(name) == normalize_game(current["game_title"]) for name in allowed):
                duplicate = current
                break

        selected = None
        if source_game not in REVIEW_REASONS:
            wanted_id = OVERRIDE_IDS.get(source_game)
            if wanted_id:
                selected = id_index.get(wanted_id)
            elif candidates.get(source_game):
                selected = candidates[source_game][0]

        if duplicate:
            status = "duplicate"
            reason = f"既存BGM id={duplicate['id']} を維持"
        elif source_game in REVIEW_REASONS:
            status = "needs_review"
            reason = REVIEW_REASONS[source_game]
        elif not selected:
            status = "needs_review"
            reason = "IGDBで対応作品を一意に確認できない"
        elif not selected.get("image"):
            status = "needs_review"
            reason = "IGDB作品は一致したがcover画像がない"
        else:
            status = "insert"
            reason = "IGDB照合済み"

        if source_game in REVIEW_REASONS:
            unmatched_games[source_game] = REVIEW_REASONS[source_game]
        elif status == "needs_review":
            unmatched_games[source_game] = reason
        analyses.append({
            "seed_no": int(seed["seed_no"]),
            "source_game_title": source_game,
            "bgm_title": title,
            "normalized_bgm_title": normalized,
            "status": status,
            "reason": reason,
            "igdb_game_id": int(selected["id"]) if selected else None,
            "official_game_title": selected.get("name") if selected else None,
            "cover_url": selected.get("image") if selected else None,
            "release_date": selected.get("released") if selected else None,
            "existing_bgm_id": duplicate.get("id") if duplicate else None,
        })

    fieldnames = list(analyses[0])
    for filename, rows in {
        "all_results.csv": analyses,
        "planned_import.csv": [r for r in analyses if r["status"] == "insert"],
        "duplicates.csv": [r for r in analyses if r["status"] == "duplicate"],
        "needs_review.csv": [r for r in analyses if r["status"] == "needs_review"],
    }.items():
        with (output / filename).open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    unmatched_rows = [{"source_game_title": game, "reason": reason} for game, reason in sorted(unmatched_games.items())]
    with (output / "igdb_unmatched_games.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source_game_title", "reason"])
        writer.writeheader()
        writer.writerows(unmatched_rows)

    planned = [r for r in analyses if r["status"] == "insert"]
    values = []
    for row in planned:
        values.append("(" + ", ".join([
            sql_literal(row["bgm_title"]), sql_literal(row["official_game_title"]), "NULL",
            sql_literal(row["cover_url"]), "NULL", str(row["igdb_game_id"]),
            sql_literal(row["normalized_bgm_title"]), "false",
        ]) + ")")
    sql = """-- REVIEW ONLY: do not run until the project owner approves this import.\nBEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '60s';\n\nINSERT INTO public.bgms\n  (title, game_title, composer, image_url, rawg_game_id, igdb_game_id, normalized_title, is_hidden)\nVALUES\n""" + ",\n".join(values) + "\nON CONFLICT (igdb_game_id, normalized_title) WHERE igdb_game_id IS NOT NULL DO NOTHING;\n\nCOMMIT;\n"
    (output / "planned_import.sql").write_text(sql, encoding="utf-8")

    summary = {
        "source_rows": len(analyses),
        "planned_insert_count": sum(r["status"] == "insert" for r in analyses),
        "duplicate_count": sum(r["status"] == "duplicate" for r in analyses),
        "needs_review_count": sum(r["status"] == "needs_review" for r in analyses),
        "unmatched_game_count": len(unmatched_rows),
        "existing_bgm_snapshot_count": len(existing),
    }
    (output / "report_data.json").write_text(json.dumps({"summary": summary, "analyses": analyses, "unmatched_games": unmatched_rows}, ensure_ascii=False), encoding="utf-8")
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
