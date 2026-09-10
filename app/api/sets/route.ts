import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "../../../lib/rateLimit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createServerSupabaseClient() {
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

function createShareId() {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(12);

  return Array.from(bytes, (value) => chars[value % chars.length]).join("");
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    console.error(
      "Supabaseのサーバー用環境変数が設定されていません。"
    );

    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const rateLimitResponse = await enforceRateLimit({
    request,
    supabase,
    namespace: "sets-create",
    burstLimit: 8,
    burstWindowSeconds: 5 * 60,
    hourlyLimit: 40,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "送信データが正しくありません。" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("bgm_ids" in body)
  ) {
    return NextResponse.json(
      { error: "送信データが正しくありません。" },
      { status: 400 }
    );
  }

  const rawTitle =
    "title" in body ? body.title : null;
  const bgmIds = body.bgm_ids;

  if (
    rawTitle !== null &&
    rawTitle !== undefined &&
    typeof rawTitle !== "string"
  ) {
    return NextResponse.json(
      { error: "タイトルが正しくありません。" },
      { status: 400 }
    );
  }

  const title =
    typeof rawTitle === "string"
      ? rawTitle.trim()
      : "";

  if (title.length > 100) {
    return NextResponse.json(
      { error: "タイトルは100文字以内にしてください。" },
      { status: 400 }
    );
  }

  if (!Array.isArray(bgmIds) || bgmIds.length !== 9) {
    return NextResponse.json(
      { error: "公開するには9曲すべて選択してください。" },
      { status: 400 }
    );
  }

  const normalizedIds = bgmIds.map((id) =>
    typeof id === "number" ? id : Number.NaN
  );

  if (
    normalizedIds.some(
      (id) =>
        !Number.isSafeInteger(id) ||
        id <= 0
    )
  ) {
    return NextResponse.json(
      { error: "BGM情報が正しくありません。" },
      { status: 400 }
    );
  }

  if (new Set(normalizedIds).size !== 9) {
    return NextResponse.json(
      { error: "同じBGMを複数選ぶことはできません。" },
      { status: 400 }
    );
  }

  const { data: existingBgms, error: bgmCheckError } =
    await supabase
      .from("bgms")
      .select("id,is_hidden")
      .in("id", normalizedIds);

  if (bgmCheckError) {
    console.error("BGM確認エラー:", bgmCheckError);

    return NextResponse.json(
      { error: "BGM情報の確認に失敗しました。" },
      { status: 500 }
    );
  }

  if (!existingBgms || existingBgms.length !== 9) {
    return NextResponse.json(
      { error: "存在しないBGMが含まれています。" },
      { status: 400 }
    );
  }

  if (existingBgms.some((bgm) => bgm.is_hidden)) {
    return NextResponse.json(
      { error: "現在公開できないBGMが含まれています。" },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const shareId = createShareId();

    const { error } = await supabase
      .from("bgm_sets")
      .insert({
        share_id: shareId,
        title: title || null,
        bgm_ids: normalizedIds,
      });

    if (!error) {
      return NextResponse.json(
        { share_id: shareId },
        { status: 201 }
      );
    }

    if (error.code === "23505") {
      continue;
    }

    console.error("MY 9公開エラー:", error);

    return NextResponse.json(
      { error: "公開に失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "共有IDの作成に失敗しました。もう一度お試しください。" },
    { status: 500 }
  );
}
