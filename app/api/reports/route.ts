import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "../../../lib/rateLimit";

const ALLOWED_REASONS = new Set([
  "duplicate",
  "not_exist",
  "wrong_title",
  "wrong_game",
  "inappropriate",
  "other",
]);
const BUG_REPORT_CATEGORIES = new Set(["検索", "音楽の追加", "9曲の選択", "画像生成", "公開・共有", "表示崩れ", "曲名・ゲーム情報の誤り", "その他"]);
const MAX_BUG_MESSAGE_LENGTH = 2000;

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
    namespace: "reports-create",
    burstLimit: 5,
    burstWindowSeconds: 5 * 60,
    hourlyLimit: 20,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
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

  if (payload.report_type === "site_bug") {
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const pageUrl = typeof payload.page_url === "string" ? payload.page_url.trim() : "";
    const userAgent = typeof payload.user_agent === "string" ? payload.user_agent.trim() : "";

    if (category && !BUG_REPORT_CATEGORIES.has(category)) return NextResponse.json({ error: "不具合の種類が正しくありません。" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "不具合内容を入力してください。" }, { status: 400 });
    if (message.length > MAX_BUG_MESSAGE_LENGTH) return NextResponse.json({ error: `不具合内容は${MAX_BUG_MESSAGE_LENGTH}文字以内で入力してください。` }, { status: 400 });
    if (pageUrl.length > 2048 || !isHttpUrl(pageUrl)) return NextResponse.json({ error: "発生ページの情報が正しくありません。" }, { status: 400 });
    if (userAgent.length > 512) return NextResponse.json({ error: "ブラウザ情報が長すぎます。" }, { status: 400 });

    const { data: reportTarget, error: targetError } = await supabase.from("bgms").select("id").eq("is_hidden", false).order("id").limit(1).maybeSingle();
    if (targetError || !reportTarget) return NextResponse.json({ error: "不具合報告を送信できませんでした。" }, { status: 500 });

    const detail = ["[サイト不具合]", "", "[種類]", category || "未選択", "", "[内容]", message, "", "[URL]", pageUrl, "", "[User Agent]", userAgent || "取得できませんでした"].join("\n");
    const { error } = await supabase.from("bgm_reports").insert({ bgm_id: reportTarget.id, reason: "other", detail, status: "pending" });
    if (error) {
      console.error("不具合報告保存エラー:", error);
      return NextResponse.json({ error: "不具合報告を送信できませんでした。時間をおいてもう一度お試しください。" }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const bgmId =
    typeof payload.bgm_id === "number"
      ? payload.bgm_id
      : Number(payload.bgm_id);

  const reason =
    typeof payload.reason === "string"
      ? payload.reason.trim()
      : "";

  const detail =
    typeof payload.detail === "string"
      ? payload.detail.trim()
      : "";

  if (!Number.isSafeInteger(bgmId) || bgmId <= 0) {
    return NextResponse.json(
      { error: "通報対象の音楽が正しくありません。" },
      { status: 400 }
    );
  }

  if (!ALLOWED_REASONS.has(reason)) {
    return NextResponse.json(
      { error: "通報理由を選択してください。" },
      { status: 400 }
    );
  }

  if (detail.length > 500) {
    return NextResponse.json(
      { error: "詳細は500文字以内で入力してください。" },
      { status: 400 }
    );
  }

  const { data: bgm, error: bgmError } = await supabase
    .from("bgms")
    .select("id")
    .eq("id", bgmId)
    .maybeSingle();

  if (bgmError) {
    console.error("通報対象BGM確認エラー:", bgmError);
    return NextResponse.json(
      { error: "通報対象の確認に失敗しました。" },
      { status: 500 }
    );
  }

  if (!bgm) {
    return NextResponse.json(
      { error: "通報対象の音楽が見つかりません。" },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("bgm_reports")
    .insert({
      bgm_id: bgmId,
      reason,
      detail: detail || null,
      status: "pending",
    });

  if (error) {
    console.error("通報保存エラー:", error);
    return NextResponse.json(
      { error: "通報の送信に失敗しました。" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 201 }
  );
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
