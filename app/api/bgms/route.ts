import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "../../../lib/rateLimit";

type RawgGameDetail = {
  id: number;
  name: string;
  background_image: string | null;
};

function normalizeBgmTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(
      /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！？。、・「」『』【】（）［］｛｝〜ー]/g,
      ""
    )
    .trim();
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

  const rawgApiKey = process.env.RAWG_API_KEY;

  if (!rawgApiKey) {
    console.error("RAWG_API_KEY が設定されていません。");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
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

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  const title =
    typeof payload.title === "string"
      ? payload.title.trim()
      : "";

  const composer =
    typeof payload.composer === "string"
      ? payload.composer.trim()
      : "";

  const rawgGameId =
    typeof payload.rawg_game_id === "number"
      ? payload.rawg_game_id
      : Number(payload.rawg_game_id);

  if (title.length < 1 || title.length > 150) {
    return NextResponse.json(
      { error: "BGM名は1〜150文字で入力してください。" },
      { status: 400 }
    );
  }

  if (composer.length > 150) {
    return NextResponse.json(
      { error: "作曲者名は150文字以内で入力してください。" },
      { status: 400 }
    );
  }

  if (
    !Number.isSafeInteger(rawgGameId) ||
    rawgGameId <= 0
  ) {
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

  let rawgGame: RawgGameDetail;

  try {
    const rawgResponse = await fetch(
      `https://api.rawg.io/api/games/${rawgGameId}?key=${encodeURIComponent(
        rawgApiKey
      )}`,
      { cache: "no-store" }
    );

    if (!rawgResponse.ok) {
      return NextResponse.json(
        { error: "選択されたゲームを確認できませんでした。" },
        { status: 400 }
      );
    }

    const data = (await rawgResponse.json()) as RawgGameDetail;

    if (
      data.id !== rawgGameId ||
      typeof data.name !== "string" ||
      !data.name.trim()
    ) {
      return NextResponse.json(
        { error: "選択されたゲームを確認できませんでした。" },
        { status: 400 }
      );
    }

    rawgGame = data;
  } catch (error) {
    console.error("RAWGゲーム確認エラー:", error);
    return NextResponse.json(
      { error: "ゲーム情報の確認に失敗しました。" },
      { status: 502 }
    );
  }

  const { data: duplicate, error: duplicateError } =
    await supabase
      .from("bgms")
      .select("id, title")
      .eq("rawg_game_id", rawgGameId)
      .eq("normalized_title", normalizedTitle)
      .maybeSingle();

  if (duplicateError) {
    console.error("重複確認エラー:", duplicateError);
    return NextResponse.json(
      { error: "BGMの確認に失敗しました。" },
      { status: 500 }
    );
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
      game_title: rawgGame.name.trim(),
      composer: composer || null,
      image_url: rawgGame.background_image ?? null,
      rawg_game_id: rawgGameId,
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
