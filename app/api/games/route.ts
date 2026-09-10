import { NextRequest, NextResponse } from "next/server";

type RawgGame = {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.RAWG_API_KEY;

  if (!apiKey) {
    console.error("RAWG_API_KEY が設定されていません");

    return NextResponse.json(
      { error: "RAWG API key is not configured" },
      { status: 500 }
    );
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      search: query,
      page_size: "6",
    });

    const response = await fetch(
      `https://api.rawg.io/api/games?${params.toString()}`,
      {
        next: {
          revalidate: 3600,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "RAWG API エラー:",
        response.status,
        response.statusText
      );

      return NextResponse.json(
        { error: "RAWG API request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = (data.results ?? []).map(
      (game: RawgGame) => ({
        id: game.id,
        name: game.name,
        image: game.background_image,
        released: game.released,
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("ゲーム検索エラー:", error);

    return NextResponse.json(
      { error: "Game search failed" },
      { status: 500 }
    );
  }
}