import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { enforceRateLimit } from "../../../lib/rateLimit";
import { inappropriateText } from "../../../lib/textValidation";
import { belongsToGame } from "../../../lib/bgmGame";

import { parseGameReference, verifyGame, findDuplicateBgm, gameColumns, normalizeBgmTitle, type VerifiedGame } from "../../../lib/bgmGame";

const MAX_TITLE_LENGTH = 150;
const MAX_COMPOSER_LENGTH = 100;

export async function GET(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  const id = Number(request.nextUrl.searchParams.get("igdb_game_id"));
  const gameIdParam = request.nextUrl.searchParams.get("game_id");
  const gameId = gameIdParam == null ? null : Number(gameIdParam);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "ゲームを選択してください。" }, { status: 400 });
  if (gameId != null && (!Number.isSafeInteger(gameId) || gameId <= 0)) return NextResponse.json({ error: "ゲームを選択してください。" }, { status: 400 });
  try {
    const game = await verifyGame({ source: "igdb", id, ...(gameId == null ? {} : { gameId }) }, supabase);
    if (!game) return NextResponse.json({ error: "ゲームが見つかりません。" }, { status: 404 });
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("bgms").select("*").eq("is_hidden", false).order("id").range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []).filter(row => belongsToGame(row, game)));
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ bgms: rows });
  } catch {
    return NextResponse.json({ error: "登録済みBGMを取得できませんでした。もう一度お試しください。" }, { status: 502 });
  }
}



function containsControlCharacters(value: string) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

function containsLineBreak(value: string) {
  return /[\r\n\u2028\u2029]/.test(value);
}

function containsUrl(value: string) {
  return /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|net|org|jp|io|gg|co|xyz|info|biz|me|tv|app)(?:\/|$))/i.test(
    value
  );
}

function hasExcessiveRepeatedCharacters(value: string) {
  const normalized = value.normalize("NFKC");
  return /(.)\1{11,}/u.test(normalized);
}

function sanitizeSingleLine(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase();

  if (!supabase) {
    console.error("Supabaseのサーバー用環境変数が設定されていません。");

    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const rateLimitResponse = await enforceRateLimit({
    request,
    supabase,
    namespace: "bgms-create",
    burstLimit: 3,
    burstWindowSeconds: 5 * 60,
    hourlyLimit: 15,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type は application/json を指定してください。" },
      { status: 415 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  const rawTitle =
    typeof payload.title === "string"
      ? payload.title
      : "";

  const rawComposer =
    typeof payload.composer === "string"
      ? payload.composer
      : "";

  if (inappropriateText(rawTitle) || inappropriateText(rawComposer)) {
    return NextResponse.json({ error: "不適切な表現が含まれています。BGM名・作曲者名を確認してください。" }, { status: 400 });
  }

  const reference = parseGameReference(payload);

  if (!rawTitle.trim()) {
    return NextResponse.json(
      { error: "BGM名を入力してください。" },
      { status: 400 }
    );
  }

  if (containsControlCharacters(rawTitle)) {
    return NextResponse.json(
      { error: "BGM名に使用できない文字が含まれています。" },
      { status: 400 }
    );
  }

  if (containsLineBreak(rawTitle)) {
    return NextResponse.json(
      { error: "BGM名に改行は使用できません。" },
      { status: 400 }
    );
  }

  if (containsUrl(rawTitle)) {
    return NextResponse.json(
      { error: "BGM名にURLは入力できません。" },
      { status: 400 }
    );
  }

  if (hasExcessiveRepeatedCharacters(rawTitle)) {
    return NextResponse.json(
      { error: "BGM名に同じ文字を連続して入力しすぎています。" },
      { status: 400 }
    );
  }

  const title = sanitizeSingleLine(rawTitle);

  if (title.length < 1 || title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `BGM名は1〜${MAX_TITLE_LENGTH}文字で入力してください。` },
      { status: 400 }
    );
  }

  if (rawComposer) {
    if (containsControlCharacters(rawComposer)) {
      return NextResponse.json(
        { error: "作曲者名に使用できない文字が含まれています。" },
        { status: 400 }
      );
    }

    if (containsLineBreak(rawComposer)) {
      return NextResponse.json(
        { error: "作曲者名に改行は使用できません。" },
        { status: 400 }
      );
    }

    if (containsUrl(rawComposer)) {
      return NextResponse.json(
        { error: "作曲者名にURLは入力できません。" },
        { status: 400 }
      );
    }

    if (hasExcessiveRepeatedCharacters(rawComposer)) {
      return NextResponse.json(
        { error: "作曲者名に同じ文字を連続して入力しすぎています。" },
        { status: 400 }
      );
    }
  }

  const composer = sanitizeSingleLine(rawComposer);

  if (composer.length > MAX_COMPOSER_LENGTH) {
    return NextResponse.json(
      { error: `作曲者名は${MAX_COMPOSER_LENGTH}文字以内で入力してください。` },
      { status: 400 }
    );
  }

  if (!reference) {
    return NextResponse.json(
      { error: "ゲームを検索結果から選択してください。" },
      { status: 400 }
    );
  }

  const normalizedTitle = normalizeBgmTitle(title);

  if (!normalizedTitle) {
    return NextResponse.json(
      { error: "BGM名を正しく入力してください。" },
      { status: 400 }
    );
  }

  if (normalizedTitle.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: "BGM名が長すぎます。" },
      { status: 400 }
    );
  }

  let game: VerifiedGame;
  let duplicate;
  try {
    const verified = await verifyGame(reference, supabase);
    if (!verified) {
      return NextResponse.json({ error: "選択されたゲームを確認できませんでした。" }, { status: 400 });
    }
    game = verified;
    duplicate = await findDuplicateBgm(supabase, game, normalizedTitle);
  } catch (error) {
    console.error("ゲーム確認エラー:", error);
    return NextResponse.json({ error: "ゲーム情報の確認に失敗しました。" }, { status: 502 });
  }

  if (duplicate) {
    return NextResponse.json(
      {
        error: `「${duplicate.title}」はすでに登録されています。`,
        code: "DUPLICATE_BGM",
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("bgms")
    .insert({
      title,
      ...gameColumns(game),
      composer: composer || null,
      normalized_title: normalizedTitle,
      is_hidden: false,
    })
    .select()
    .single();

  if (error) {
    console.error("BGM追加エラー:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: "このBGMはすでに登録されています。",
          code: "DUPLICATE_BGM",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "BGMの追加に失敗しました。" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { bgm: data },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return NextResponse.json({ error: "管理者ログインが必要です。" }, { status: 401 });
  const { data: auth, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !auth.user || !process.env.NEXT_PUBLIC_ADMIN_USER_ID || auth.user.id !== process.env.NEXT_PUBLIC_ADMIN_USER_ID) {
    return NextResponse.json({ error: "管理者権限がありません。" }, { status: 403 });
  }
  let payload: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid JSON");
    payload = body;
  } catch {
    return NextResponse.json({ error: "送信データが正しくありません。" }, { status: 400 });
  }
  const reference = parseGameReference(payload);
  const id = payload.bgm_id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || !reference) {
    return NextResponse.json({ error: "BGMとゲームを選択してください。" }, { status: 400 });
  }
  const { data: existing, error: readError } = await supabase.from("bgms").select("*").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: "BGMを取得できませんでした。" }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "BGMが見つかりません。" }, { status: 404 });
  try {
    const game = await verifyGame(reference, supabase);
    if (!game) return NextResponse.json({ error: "選択されたゲームを確認できませんでした。" }, { status: 400 });
    const normalizedTitle = normalizeBgmTitle(existing.title);
    const duplicate = await findDuplicateBgm(supabase, game, normalizedTitle, id);
    if (duplicate) return NextResponse.json({ error: "同じゲームに同じBGMがすでに登録されています。", code: "DUPLICATE_BGM" }, { status: 409 });
    const columns = gameColumns(game);
    // Re-selecting the same IGDB game retains its existing explicit RAWG association.
    if (existing.igdb_game_id && existing.igdb_game_id === game.igdb_game_id) {
      columns.rawg_game_id ??= existing.rawg_game_id;
    }
    const { data, error } = await supabase.from("bgms").update({
      ...columns, image_url: game.image_url ?? existing.image_url, normalized_title: normalizedTitle,
    }).eq("id", id).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "同じゲームに同じBGMがすでに登録されています。", code: "DUPLICATE_BGM" }, { status: 409 });
      console.error("ゲーム情報更新エラー:", error);
      return NextResponse.json({ error: "ゲーム情報の保存に失敗しました。" }, { status: 500 });
    }
    return NextResponse.json({ bgm: data });
  } catch (error) {
    console.error("ゲーム情報確認エラー:", error);
    return NextResponse.json({ error: "ゲーム情報の確認に失敗しました。" }, { status: 502 });
  }
}
