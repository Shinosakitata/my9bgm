import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 }
    );
  }

  try {
    const url = new URL(imageUrl);

    // RAWGの画像だけ許可
    const allowedHosts = [
      "media.rawg.io",
      "api.rawg.io",
    ];

    if (!allowedHosts.includes(url.hostname)) {
      return NextResponse.json(
        { error: "Image host is not allowed" },
        { status: 403 }
      );
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("画像取得エラー:", error);

    return NextResponse.json(
      { error: "Invalid image URL" },
      { status: 400 }
    );
  }
}