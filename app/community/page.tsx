"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { BugReportButton } from "../components/BugReportButton";

type Bgm = {
  id: number;
  title: string;
  game_title: string;
  composer: string | null;
  image_url: string | null;
};

type BgmSet = {
  creator_name?: string | null;
  id: number;
  share_id: string;
  title: string | null;
  bgm_ids: number[];
  created_at: string;
};

type CommunitySet = {
  set: BgmSet;
  bgms: Bgm[];
};

export default function CommunityPage() {
  const [sets, setSets] =
    useState<CommunitySet[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  async function loadCommunitySets() {
    setLoading(true);
    setError("");

    const [
      bgmsResult,
      setsResult,
    ] = await Promise.all([
      supabase
        .from("bgms")
        .select("*")
        .order("id", {
          ascending: true,
        }),

      supabase
        .from("bgm_sets")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (bgmsResult.error) {
      console.error(
        "BGM取得エラー:",
        bgmsResult.error
      );

      setError(
        "音楽データの読み込みに失敗しました。"
      );

      setLoading(false);
      return;
    }

    if (setsResult.error) {
      console.error(
        "公開セット取得エラー:",
        setsResult.error
      );

      setError(
        "公開された9曲の読み込みに失敗しました。"
      );

      setLoading(false);
      return;
    }

    const allBgms: Bgm[] =
      bgmsResult.data ?? [];

    const allSets: BgmSet[] =
      setsResult.data ?? [];

    const mappedSets =
      allSets
        .map((set) => {
          const setBgms: Bgm[] =
            [];

          for (
            const id of set.bgm_ids
          ) {
            const bgm =
              allBgms.find(
                (item) =>
                  item.id ===
                  Number(id)
              );

            if (bgm) {
              setBgms.push(
                bgm
              );
            }
          }

          return {
            set,
            bgms: setBgms,
          };
        })
        .filter(
          (item) =>
            item.bgms.length ===
            9
        );

    setSets(mappedSets);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCommunitySets();
  }, []);

  function getImageUrl(
    bgm: Bgm
  ) {
    if (bgm.image_url) {
      return bgm.image_url;
    }

    return `https://placehold.co/500x500?text=${encodeURIComponent(
      bgm.game_title
    )}`;
  }

  function formatDate(
    dateString: string
  ) {
    const date =
      new Date(dateString);

    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    ).format(date);
  }

  const filteredSets =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      if (!q) {
        return sets;
      }

      return sets.filter(
        ({ set, bgms }) => {
          const title =
            set.title
              ?.toLowerCase() ??
            "";

          const bgmMatch =
            bgms.some(
              (bgm) =>
                bgm.title
                  .toLowerCase()
                  .includes(q) ||
                bgm.game_title
                  .toLowerCase()
                  .includes(q)
            );

          return (
            title.includes(q) ||
            bgmMatch
          );
        }
      );
    }, [search, sets]);

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-10">
            <Link
              href="/"
              className="whitespace-nowrap font-bold tracking-[0.2em]"
            >
              🎧 My9GameMusic
            </Link>

            <nav className="hidden gap-7 text-sm font-semibold md:flex">
              <Link
                href="/"
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                作成
              </Link>

              <span className="border-b-2 border-sky-500 py-5">
                みんなの9つの音楽
              </span>

              <Link
                href="/?add=1"
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                音楽を追加
              </Link>

              <BugReportButton className="py-5 text-slate-500 hover:text-slate-900" />

              <Link
                href="/about"
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                このサイトについて
              </Link>
            </nav>
          </div>

          <Link
            href="/"
            className="hidden rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 sm:inline-flex"
          >
            ＋ 自分の9曲を作る
          </Link>
        </div>

        <nav className="grid w-full grid-cols-5 border-t border-slate-100 bg-white text-[10px] font-semibold sm:text-[11px] md:hidden">
          <Link href="/" className="min-w-0 px-1 py-3 text-center text-slate-500">作成</Link>
          <span className="min-w-0 border-b-2 border-sky-500 px-1 py-3 text-center">コミュニティ</span>
          <Link href="/?add=1" className="min-w-0 px-1 py-3 text-center text-slate-500">音楽を追加</Link>
          <BugReportButton className="min-w-0 px-1 py-3 text-center text-slate-500" />
          <Link href="/about" className="min-w-0 px-1 py-3 text-center text-slate-500">このサイト</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="mb-10">
          <p className="mb-2 text-sm font-bold tracking-[0.25em] text-sky-500">
            COMMUNITY
          </p>

          <h1 className="text-4xl font-bold">
            みんなの9つの音楽
          </h1>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="タイトル・音楽名・ゲーム名で検索..."
            className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-5 shadow-sm outline-none focus:border-sky-400 md:max-w-xl"
          />

          {!loading && (
            <p className="text-sm text-slate-400">
              {filteredSets.length}
              件のMY 9
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />

            <p className="text-slate-500">
              みんなの9曲を読み込んでいます...
            </p>
          </div>
        ) : filteredSets.length ===
          0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="text-5xl">
              🎧
            </div>

            <h2 className="mt-5 text-xl font-bold">
              まだMY 9がありません
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              最初の9曲を公開してみましょう。
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-sky-500 px-6 py-3 font-bold text-white hover:bg-sky-600"
            >
              自分の9曲を作る
            </Link>
          </div>
        ) : (
          <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {filteredSets.map(
              ({ set, bgms }) => (
                <Link
                  key={set.id}
                  href={`/set/${encodeURIComponent(
                    set.share_id
                  )}`}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="grid aspect-square grid-cols-3 grid-rows-3 overflow-hidden bg-slate-100">
                    {bgms.map(
                      (
                        bgm,
                        index
                      ) => (
                        <div
                          key={`${set.id}-${bgm.id}-${index}`}
                          className="relative min-h-0 min-w-0 overflow-hidden border border-white/20"
                        >
                          <img
                            src={getImageUrl(
                              bgm
                            )}
                            alt={
                              bgm.title
                            }
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />

                          <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-[11px] font-bold text-white backdrop-blur-sm">
                            {index + 1}
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-[0.15em] text-sky-500">
                          My9GameMusic
                        </p>

                        <h2 className="mt-1 truncate text-lg font-bold">
                          {set.title ||
                            "私を彩る9つのゲーム音楽"}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">作成者：{set.creator_name || "匿名"}</p>
                      </div>

                      <span className="flex-none text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-500">
                        →
                      </span>
                    </div>

                    <div className="mt-4 space-y-1">
                      {bgms
                        .slice(0, 3)
                        .map(
                          (
                            bgm,
                            index
                          ) => (
                            <p
                              key={`${set.id}-preview-${bgm.id}-${index}`}
                              className="truncate text-sm text-slate-500"
                            >
                              <span className="mr-2 font-bold text-slate-300">
                                {index +
                                  1}
                              </span>

                              {
                                bgm.title
                              }
                            </p>
                          )
                        )}

                      <p className="text-sm text-slate-400">
                        ＋ あと6曲
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-400">
                        {formatDate(
                          set.created_at
                        )}
                      </p>

                      <p className="text-xs font-semibold text-sky-500">
                        9曲を見る
                      </p>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </div>

      <footer className="mx-auto max-w-[1400px] px-6 pb-8 pt-6 text-center text-xs text-slate-400">
        Game data and images provided by{" "}
        <a
          href="https://rawg.io/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-600"
        >
          RAWG
        </a>{" / "}<a href="https://www.igdb.com/" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">IGDB</a>
      </footer>
    </main>
  );
}
