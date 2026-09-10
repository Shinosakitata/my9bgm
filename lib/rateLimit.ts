import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitOptions = {
  request: NextRequest;
  supabase: SupabaseClient;
  namespace: string;
  burstLimit: number;
  burstWindowSeconds: number;
  hourlyLimit: number;
};

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const cloudflareIp = request.headers
    .get("cf-connecting-ip")
    ?.trim();

  if (cloudflareIp) {
    return cloudflareIp;
  }

  // ローカル開発などでIPヘッダーが無い場合。
  return "unknown";
}

function createClientHash(request: NextRequest) {
  const secret = process.env.RATE_LIMIT_SECRET;

  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret)
    .update(getClientIp(request))
    .digest("hex");
}

async function consumeLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number
) {
  const { data, error } = await supabase.rpc(
    "check_rate_limit",
    {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }
  );

  if (error) {
    console.error("レート制限チェックエラー:", error);
    return { ok: false as const, unavailable: true as const };
  }

  return {
    ok: data === true,
    unavailable: false as const,
  };
}

/**
 * 書き込みAPI用のIPベースレート制限。
 *
 * 戻り値が null なら続行可能。
 * NextResponse が返った場合は、そのままAPIレスポンスとして返す。
 */
export async function enforceRateLimit({
  request,
  supabase,
  namespace,
  burstLimit,
  burstWindowSeconds,
  hourlyLimit,
}: RateLimitOptions): Promise<NextResponse | null> {
  const clientHash = createClientHash(request);

  if (!clientHash) {
    console.error("RATE_LIMIT_SECRET が設定されていません。");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const burst = await consumeLimit(
    supabase,
    `${namespace}:burst:${clientHash}`,
    burstLimit,
    burstWindowSeconds
  );

  if (burst.unavailable) {
    return NextResponse.json(
      {
        error:
          "現在リクエストを受け付けられません。少し時間をおいてお試しください。",
      },
      { status: 503 }
    );
  }

  if (!burst.ok) {
    return NextResponse.json(
      {
        error:
          "短時間に操作が集中しています。少し時間をおいてお試しください。",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(burstWindowSeconds),
        },
      }
    );
  }

  const hourly = await consumeLimit(
    supabase,
    `${namespace}:hour:${clientHash}`,
    hourlyLimit,
    60 * 60
  );

  if (hourly.unavailable) {
    return NextResponse.json(
      {
        error:
          "現在リクエストを受け付けられません。少し時間をおいてお試しください。",
      },
      { status: 503 }
    );
  }

  if (!hourly.ok) {
    return NextResponse.json(
      {
        error:
          "この操作の利用回数が上限に達しました。時間をおいてお試しください。",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "3600",
        },
      }
    );
  }

  return null;
}
