"use client";

import { FormEvent, useEffect, useState } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { type GameSearchResult } from "../lib/gameSearch";
import { matchesBgmCatalog, normalizeBgmSearchText as normalizeBgmTitle } from "../lib/bgmSearch";
import { inappropriateText, similarTitle } from "../lib/textValidation";
import { sharedSetUrl } from "../lib/site";
import { SelectionDrop } from "./components/CatalogDrag";
import { BugReportButton } from "./components/BugReportButton";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

type Bgm = {
  id: number;
  title: string;
  game_title: string;
  composer: string | null;
  image_url: string | null;
  rawg_game_id: number | null;
  igdb_game_id: number | null;
  game_id: number | null;
  normalized_title: string | null;
  is_hidden: boolean;
};

type BgmSet = {
  creator_name?: string | null;
  comments?: string[] | null;
  id: number;
  share_id: string;
  title: string | null;
  bgm_ids: number[];
  created_at: string;
};

type BgmReport = {
  id: number;
  bgm_id: number;
  reason: string;
  detail: string | null;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
};

type SortableBgmProps = {
  bgm: Bgm;
  index: number;
  removeBgm: (id: number) => void;
  getImageUrl: (bgm: Bgm, size: string) => string;
  readOnly?: boolean;
  comment?: string;
  canEditComment?: boolean;
  onEditComment?: () => void;
};

const STORAGE_KEY = "my9bgm-selected";
const BGM_PAGE_SIZE = 30;

const ADMIN_USER_ID =
  process.env.NEXT_PUBLIC_ADMIN_USER_ID;

function SortableBgm({
  bgm,
  index,
  removeBgm,
  getImageUrl,
  readOnly = false,
  comment = "",
  canEditComment = false,
  onEditComment,
}: SortableBgmProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bgm.id,
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex w-full min-w-0 gap-2 rounded-2xl border bg-white px-2.5 shadow-sm sm:gap-3 sm:px-3 ${comment ? "min-h-[88px] items-start py-3" : "h-[74px] items-center"} ${
        isDragging
          ? "border-sky-400 shadow-lg"
          : "border-slate-200"
      }`}
    >
      {!readOnly && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-12 w-6 flex-none cursor-grab touch-none items-center justify-center text-lg text-slate-300 hover:text-slate-600 active:cursor-grabbing sm:w-7 sm:text-xl"
          title="ドラッグして並べ替え"
        >
          ⋮⋮
        </button>
      )}

      <span className={`w-5 flex-none text-center text-base font-bold text-sky-500 sm:w-6 sm:text-xl ${comment ? "pt-3" : ""}`}>
        {index + 1}
      </span>

      <NextImage
        src={getImageUrl(bgm, "100x100")}
        alt={bgm.title}
        width={48}
        height={48}
        sizes="(max-width: 640px) 40px, 48px"
        className="h-10 w-10 flex-none rounded-lg object-cover sm:h-12 sm:w-12"
      />

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex min-w-0 items-start gap-2 pr-1">
        <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold sm:text-base">
          {bgm.title}
        </p>

        <p className="truncate text-[11px] text-slate-500 sm:text-xs">
          {bgm.game_title}
        </p>
        </div>
        {canEditComment && (
          <button type="button" onClick={onEditComment} className="flex-none pt-0.5 text-[11px] font-semibold text-slate-400 hover:text-sky-600 sm:text-xs">
            {comment ? "コメントを編集" : "＋コメント"}
          </button>
        )}
        </div>
        {comment && <p className="mt-2 border-l-2 border-sky-200 pl-2 text-xs leading-relaxed text-slate-600 sm:text-sm">{comment}</p>}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => removeBgm(bgm.id)}
          className="flex h-8 w-8 flex-none items-center justify-center text-lg text-slate-400 transition hover:text-red-500 sm:h-9 sm:w-9 sm:text-xl"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [bgms, setBgms] = useState<Bgm[]>([]);
  const [selected, setSelected] = useState<Bgm[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [commentingBgm, setCommentingBgm] = useState<Bgm | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");
  const [search, setSearch] = useState("");
  const [visibleBgmCount, setVisibleBgmCount] = useState(BGM_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [previewBgm, setPreviewBgm] = useState<Bgm | null>(null);

  const [storageLoaded, setStorageLoaded] =
    useState(false);

  // =========================
  // 共有セット
  // =========================

  const [sharedSet, setSharedSet] =
    useState<BgmSet | null>(null);

  const [sharedSetError, setSharedSetError] =
    useState("");

  const [showPublishModal, setShowPublishModal] =
    useState(false);

  const [publishTitle, setPublishTitle] =
    useState("");

  const [creatorName, setCreatorName] =
    useState(() => typeof window === "undefined" ? "" : localStorage.getItem("my9bgm-creator-name") ?? "");

  const [publishing, setPublishing] =
    useState(false);

  const [publishError, setPublishError] =
    useState("");

  const [publishedUrl, setPublishedUrl] =
    useState("");

  const [publishedSelectionFingerprint, setPublishedSelectionFingerprint] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  // =========================
  // 管理者認証
  // =========================

  const [authUser, setAuthUser] =
    useState<User | null>(null);

  const isAdmin =
    Boolean(authUser) &&
    Boolean(ADMIN_USER_ID) &&
    authUser?.id === ADMIN_USER_ID;

  const isViewingSharedSet =
    sharedSet !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    if (!previewBgm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewBgm]);

  // =========================
  // BGM追加
  // =========================

  const [chosenGame, setChosenGame] = useState<GameSearchResult | null>(null);
  const [gameBgms, setGameBgms] = useState<Bgm[]>([]);
  const [gameListStatus, setGameListStatus] = useState("");
  const [gameListReady, setGameListReady] = useState(false);
  const [popularity, setPopularity] = useState<Record<number, number>>({});
  const [confirmedTitle, setConfirmedTitle] = useState("");
  const [gameComposing, setGameComposing] = useState(false);
  const [editGameComposing, setEditGameComposing] = useState(false);

  const [showAddForm, setShowAddForm] =
    useState(false);

  const [adding, setAdding] =
    useState(false);

  const [newTitle, setNewTitle] =
    useState("");

  const [newGameTitle, setNewGameTitle] =
    useState("");

  const [newComposer, setNewComposer] =
    useState("");

  const [newImageUrl, setNewImageUrl] =
    useState<string | null>(null);

  const [newIgdbGameId, setNewIgdbGameId] =
    useState<number | null>(null);

  const [newGameId, setNewGameId] =
    useState<number | null>(null);

  const [addMessage, setAddMessage] =
    useState("");

  const [gameResults, setGameResults] =
    useState<GameSearchResult[]>([]);

  const [gameSearching, setGameSearching] =
    useState(false);

  const [gameSearchError, setGameSearchError] =
    useState("");

  // =========================
  // 管理者用ゲーム情報編集
  // =========================

  const [editingBgm, setEditingBgm] =
    useState<Bgm | null>(null);

  const [editGameQuery, setEditGameQuery] =
    useState("");

  const [editGameResults, setEditGameResults] =
    useState<GameSearchResult[]>([]);

  const [editGameSearching, setEditGameSearching] =
    useState(false);

  const [editGameError, setEditGameError] =
    useState("");

  const [editSelectedGame, setEditSelectedGame] =
    useState<GameSearchResult | null>(null);

  const [savingGameInfo, setSavingGameInfo] =
    useState(false);

  const [editSaveError, setEditSaveError] =
    useState("");

  // =========================
  // 管理者BGM非表示
  // =========================

  const [deletingBgm, setDeletingBgm] =
    useState<Bgm | null>(null);

  const [deleting, setDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  // =========================
  // BGM通報
  // =========================

  const [reportingBgm, setReportingBgm] =
    useState<Bgm | null>(null);

  const [reportReason, setReportReason] =
    useState("");

  const [reportDetail, setReportDetail] =
    useState("");

  const [reportSending, setReportSending] =
    useState(false);

  const [reportError, setReportError] =
    useState("");

  const [reportSuccess, setReportSuccess] =
    useState(false);

  // =========================
  // 管理者用 通報管理
  // =========================

  const [showReportManager, setShowReportManager] =
    useState(false);

  const [adminReports, setAdminReports] =
    useState<BgmReport[]>([]);

  const [adminReportsLoading, setAdminReportsLoading] =
    useState(false);

  const [adminReportsError, setAdminReportsError] =
    useState("");

  const [updatingReportId, setUpdatingReportId] =
    useState<number | null>(null);

  const [reportStatusFilter, setReportStatusFilter] =
    useState<"pending" | "all">("pending");

  // =========================
  // 3×3画像生成
  // =========================

  const [showShareModal, setShowShareModal] =
    useState(false);

  const [generatedImage, setGeneratedImage] =
    useState<string | null>(null);

  const [generatingImage, setGeneratingImage] =
    useState(false);

  // =========================
  // 初期読み込み
  // =========================

  useEffect(() => {
    loadBgms();
    loadAdminSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function updateCreatorName(value: string) {
    setCreatorName(value);
    localStorage.setItem("my9bgm-creator-name", value);
  }

  useEffect(() => {
    if (isAdmin) {
      loadAdminReports();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdminReports([]);
      setShowReportManager(false);
    }
  }, [isAdmin]);

  async function loadAdminSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error(
        "セッション取得エラー:",
        error
      );
      return;
    }

    setAuthUser(session?.user ?? null);
  }

  async function loadBgms() {
    setLoading(true);
    setSharedSetError("");

    const { data, error } = await supabase
      .from("bgms")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error(
        "BGM取得エラー:",
        error
      );

      setLoading(false);
      return;
    }

    const loadedBgms: Bgm[] =
      data ?? [];

    setBgms(loadedBgms);
    const counts: Record<number, number> = {};
    for (let offset = 0; ; offset += 1000) {
      const { data: sets, error: countError } = await supabase.from("bgm_sets").select("bgm_ids").order("id").range(offset, offset + 999);
      if (countError) { console.error("人気順の取得に失敗しました", countError); break; }
      for (const set of sets ?? []) for (const id of new Set<number>(set.bgm_ids ?? [])) counts[id] = (counts[id] ?? 0) + 1;
      if (!sets || sets.length < 1000) break;
    }
    setPopularity(counts);

    const params =
      new URLSearchParams(
        window.location.search
      );

    const shareId =
      params.get("set") ||
      (window.location.pathname.startsWith("/set/")
        ? decodeURIComponent(window.location.pathname.split("/")[2] ?? "")
        : "");

    if (shareId) {
      const loaded =
        await loadSharedSet(
          shareId,
          loadedBgms
        );

      if (!loaded) {
        restoreSelectedFromStorage(
          loadedBgms
        );
      }
    } else {
      restoreSelectedFromStorage(
        loadedBgms
      );

      if (params.get("add") === "1") {
        openAddForm();
      }
    }

    setLoading(false);
  }

  async function loadSharedSet(
    shareId: string,
    loadedBgms: Bgm[]
  ) {
    const { data, error } =
      await supabase
        .from("bgm_sets")
        .select("*")
        .eq("share_id", shareId)
        .maybeSingle();

    if (error) {
      console.error(
        "共有セット取得エラー:",
        error
      );

      setSharedSetError(
        "共有された9曲の読み込みに失敗しました。"
      );

      return false;
    }

    if (!data) {
      setSharedSetError(
        "この共有セットは見つかりませんでした。"
      );

      return false;
    }

    const bgmSet =
      data as BgmSet;

    const restored: Bgm[] = [];

    for (const id of bgmSet.bgm_ids) {
      const found =
        loadedBgms.find(
          (bgm) =>
            bgm.id === Number(id)
        );

      if (found) {
        restored.push(found);
      }
    }

    if (restored.length !== 9) {
      setSharedSetError(
        "共有セットの一部の音楽が見つかりませんでした。"
      );

      return false;
    }

    setSharedSet(bgmSet);
    setSelected(restored);
    const loadedComments = Array.isArray(bgmSet.comments) ? bgmSet.comments : [];
    setComments(Object.fromEntries(bgmSet.bgm_ids.map((id, index) => [Number(id), typeof loadedComments[index] === "string" ? loadedComments[index] : ""])));
    setStorageLoaded(true);

    return true;
  }

  // =========================
  // 管理者セッション（既存の管理機能用）
  // =========================

  // =========================
  // localStorage
  // =========================

  function restoreSelectedFromStorage(
    loadedBgms: Bgm[]
  ) {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!saved) {
        setStorageLoaded(true);
        return;
      }

      const savedIds =
        JSON.parse(saved);

      if (!Array.isArray(savedIds)) {
        setStorageLoaded(true);
        return;
      }

      const restored: Bgm[] = [];

      for (const id of savedIds) {
        const found =
          loadedBgms.find(
            (bgm) =>
              bgm.id === Number(id)
          );

        if (found) {
          restored.push(found);
        }
      }

      setSelected(
        restored.slice(0, 9)
      );
    } catch (error) {
      console.error(
        "localStorage読み込みエラー:",
        error
      );
    } finally {
      setStorageLoaded(true);
    }
  }

  useEffect(() => {
    if (!storageLoaded) {
      return;
    }

    if (isViewingSharedSet) {
      return;
    }

    try {
      const selectedIds =
        selected.map(
          (bgm) => bgm.id
        );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(selectedIds)
      );
    } catch (error) {
      console.error(
        "localStorage保存エラー:",
        error
      );
    }
  }, [
    selected,
    storageLoaded,
    isViewingSharedSet,
  ]);

  // =========================
  // ゲーム検索（IGDB）
  // =========================

  async function fetchGames(
    query: string,
    signal?: AbortSignal
  ): Promise<GameSearchResult[]> {
    const response = await fetch(
      `/api/games?q=${encodeURIComponent(
        query
      )}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(
        "ゲーム検索に失敗しました"
      );
    }

    const data =
      await response.json();

    return (data.results ?? []).filter((game: GameSearchResult) => game.source === "igdb" && Number.isSafeInteger(game.id));
  }

  // =========================
  // 新規BGM用ゲーム検索
  // =========================

  useEffect(() => {
    const controller = new AbortController();
    const query = newGameTitle.trim();
    const enabled = showAddForm && !gameComposing && newIgdbGameId === null && query.length >= 2;
    const timer = setTimeout(async () => {
      setGameResults([]);
      setGameSearchError("");
      setGameSearching(enabled);
      if (!enabled) return;
      try {
        const results = await fetchGames(query, controller.signal);
        if (!controller.signal.aborted) {
          setGameResults(results);
          if (!results.length) setGameSearchError("候補がありません。正式名称や英語名もお試しください。");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setGameSearchError("ゲーム検索に失敗しました。");
        }
      } finally {
        if (!controller.signal.aborted) setGameSearching(false);
      }
    }, enabled ? 500 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [newGameTitle, newIgdbGameId, showAddForm, gameComposing]);

  useEffect(() => {
    const controller = new AbortController();
    const query = editGameQuery.trim();
    const enabled = Boolean(editingBgm && isAdmin && !editGameComposing && !editSelectedGame && query.length >= 2);
    const timer = setTimeout(async () => {
      setEditGameResults([]);
      setEditGameError("");
      setEditGameSearching(enabled);
      if (!enabled) return;
      try {
        const results = await fetchGames(query, controller.signal);
        if (!controller.signal.aborted) {
          setEditGameResults(results);
          if (!results.length) setEditGameError("候補がありません。正式名称や英語名もお試しください。");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setEditGameError("ゲーム検索に失敗しました。");
        }
      } finally {
        if (!controller.signal.aborted) setEditGameSearching(false);
      }
    }, enabled ? 500 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editGameQuery, editSelectedGame, editingBgm, isAdmin, editGameComposing]);

  // =========================
  // 一覧検索
  // =========================

  useEffect(() => {
    if (!chosenGame) return;
    const controller = new AbortController();
    fetch(`/api/bgms?igdb_game_id=${chosenGame.id}${chosenGame.game_id ? `&game_id=${chosenGame.game_id}` : ""}`, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (!controller.signal.aborted) { setGameBgms(data.bgms); setGameListStatus(""); setGameListReady(true); } })
      .catch(error => { if (!controller.signal.aborted) setGameListStatus(error.message || "音楽の取得に失敗しました。"); });
    return () => controller.abort();
  }, [chosenGame]);

  function chooseGame(game: GameSearchResult) {
    setChosenGame(game); setGameBgms([]); setGameListReady(false);
    setGameListStatus("登録済みの音楽を読み込んでいます...");
    selectGameForNewBgm(game); setConfirmedTitle("");
  }

  const visibleGameBgms = bgms;
  const filtered = visibleGameBgms.filter(bgm => (!bgm.is_hidden || isAdmin) && matchesBgmCatalog(bgm, search))
    .sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0) || a.id - b.id);
  const registrationBgms = [...gameBgms].sort((a, b) => Number(similarTitle(b.title, newTitle)) - Number(similarTitle(a.title, newTitle)) || a.id - b.id);

  // =========================
  // 9曲選択
  // =========================

  function addBgmToSelection(
    bgm: Bgm
  ) {
    if (isViewingSharedSet) {
      return;
    }

    if (
      selected.some(
        (item) =>
          item.id === bgm.id
      )
    ) {
      return;
    }

    if (
      selected.length >= 9
    ) {
      alert(
        "選べる音楽は9曲までです"
      );

      return;
    }

    setSelected(
      (current) => [
        ...current,
        bgm,
      ]
    );
  }

  function removeBgm(
    id: number
  ) {
    if (isViewingSharedSet) {
      return;
    }

    setSelected(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
    );
  }

  function clearSelected() {
    if (isViewingSharedSet) {
      return;
    }

    setSelected([]);
    setComments({});
  }

  function openCommentEditor(bgm: Bgm) {
    setCommentingBgm(bgm);
    setCommentDraft(comments[bgm.id] ?? "");
    setCommentError("");
  }

  function saveComment() {
    if (!commentingBgm) return;
    const value = commentDraft.normalize("NFKC").trim();
    if (value.length > 200 || inappropriateText(value)) { setCommentError("コメントは200文字以内で、不適切な表現を含めず入力してください。"); return; }
    const nextComments = { ...comments, [commentingBgm.id]: value };
    if (isViewingSharedSet) return;
    setComments(nextComments);
    setCommentingBgm(null);
  }

  function handleDragEnd(
    event: DragEndEvent
  ) {
    if (isViewingSharedSet) {
      return;
    }

    const { active, over } =
      event;

    if (!over) return;
    if (active.data.current?.bgmId) {
      if (over.id === "selection-drop" || selected.some(bgm => bgm.id === over.id)) {
        const bgm = [...bgms, ...gameBgms].find(item => item.id === active.data.current?.bgmId);
        if (bgm && !bgm.is_hidden) addBgmToSelection(bgm);
      }
      return;
    }

    if (
      active.id === over.id
    ) {
      return;
    }

    setSelected(
      (current) => {
        const oldIndex =
          current.findIndex(
            (bgm) =>
              bgm.id ===
              active.id
          );

        const newIndex =
          current.findIndex(
            (bgm) =>
              bgm.id ===
              over.id
          );

        if (
          oldIndex === -1 ||
          newIndex === -1
        ) {
          return current;
        }

        return arrayMove(
          current,
          oldIndex,
          newIndex
        );
      }
    );
  }

  function getImageUrl(
    bgm: Bgm,
    size: string
  ) {
    if (bgm.image_url) {
      return bgm.image_url;
    }

    return `https://placehold.co/${size}?text=${encodeURIComponent(
      bgm.game_title
    )}`;
  }

  // =========================
  // 公開
  // =========================

  function openPublishModal() {
    if (
      selected.length !== 9
    ) {
      alert(
        "公開するには9曲すべて選択してください。"
      );

      return;
    }

    setPublishTitle("");
    setPublishError("");
    if (publishedSelectionFingerprint !== getSelectionFingerprint()) {
      setPublishedUrl("");
    }
    setCopied(false);
    setShowPublishModal(true);
  }

  function getSelectionFingerprint() {
    return JSON.stringify({
      ids: selected.map((bgm) => bgm.id),
      comments: selected.map((bgm) => comments[bgm.id] ?? ""),
      creatorName: creatorName.trim(),
    });
  }

  function closePublishModal() {
    if (publishing) {
      return;
    }

    setShowPublishModal(false);
    setPublishError("");
    setCopied(false);
  }

  async function publishBgmSet() {
    if (
      selected.length !== 9
    ) {
      setPublishError(
        "9曲すべて選択してください。"
      );
      return;
    }

    setPublishing(true);
    setPublishError("");
    setCopied(false);

    try {
      const response = await fetch(
        "/api/sets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title:
              publishTitle.trim() ||
              null,
            creator_name:
              creatorName.trim() ||
              null,
            bgm_ids: selected.map(
              (bgm) => bgm.id
            ),
            comments: selected.map((bgm) => comments[bgm.id] ?? ""),
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setPublishError(
          result.error ||
            "公開に失敗しました。もう一度お試しください。"
        );
        return;
      }

      if (!result.share_id) {
        setPublishError(
          "共有IDの取得に失敗しました。もう一度お試しください。"
        );
        return;
      }

      const url = sharedSetUrl(result.share_id);

      setPublishedUrl(url);
      setPublishedSelectionFingerprint(getSelectionFingerprint());
    } catch (error) {
      console.error(
        "公開エラー:",
        error
      );

      setPublishError(
        "公開に失敗しました。通信状態を確認して、もう一度お試しください。"
      );
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishedUrl() {
    if (!publishedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        publishedUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "URLコピーエラー:",
        error
      );

      alert(
        "URLのコピーに失敗しました。"
      );
    }
  }

  function sharePublishedSetOnX() {
    if (!publishedUrl) return;
    const text = [
      "私を彩る9つのゲーム音楽",
      "#My9GameMusic #私を彩る9つのゲーム音楽",
      publishedUrl,
    ].join("\n");
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function returnToMyEditor() {
    router.push("/");
  }

  // =========================
  // 新規BGM
  // =========================

  function selectGameForNewBgm(
    game: GameSearchResult
  ) {
    setNewGameTitle(
      game.name
    );

    setNewIgdbGameId(
      game.id
    );

    setNewGameId(game.game_id ?? null);

    setNewImageUrl(
      game.image
    );

    setGameResults([]);
    setGameSearchError("");
    setAddMessage("");
  }

  function clearSelectedGame() {
    setNewIgdbGameId(null);
    setNewGameId(null);
    setNewImageUrl(null);
    setGameResults([]);
    setAddMessage("");
  }

  function resetAddForm() {
    setChosenGame(null);
    setGameBgms([]);
    setGameListStatus("");
    setGameListReady(false);
    setConfirmedTitle("");
    setNewTitle("");
    setNewGameTitle("");
    setNewComposer("");
    setNewImageUrl(null);
    setNewIgdbGameId(null);
    setNewGameId(null);
    setGameResults([]);
    setGameSearchError("");
    setAddMessage("");
  }

  function closeAddForm() {
    setShowAddForm(false);
    resetAddForm();
  }

  function openAddForm() {
    resetAddForm();
    setShowAddForm(true);
  }

  async function handleAddBgm(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setAddMessage("");

    const title =
      newTitle.trim();

    const composer =
      newComposer.trim();

    if (!title) {
      setAddMessage(
        "音楽名を入力してください。"
      );
      return;
    }

    if (newIgdbGameId === null) {
      setAddMessage(
        "ゲーム名を入力したあと、検索結果からゲームを選択してください。"
      );
      return;
    }

    const normalizedTitle =
      normalizeBgmTitle(title);

    if (!normalizedTitle) {
      setAddMessage(
        "音楽名を正しく入力してください。"
      );
      return;
    }

    const duplicate =
      bgms.find(
        (bgm) =>
          ((newGameId != null && bgm.game_id === newGameId) ||
            (newGameId == null && bgm.igdb_game_id === newIgdbGameId)) &&
          (
            bgm.normalized_title ??
            normalizeBgmTitle(
              bgm.title
            )
          ) === normalizedTitle
      );

    if (duplicate) {
      setAddMessage(
        `「${duplicate.title}」はすでに登録されています。`
      );
      return;
    }

    if (inappropriateText(title) || inappropriateText(composer)) {
      setAddMessage("不適切な表現が含まれています。入力内容を確認してください。"); return;
    }
    if (confirmedTitle !== `${newIgdbGameId}:${title}:${composer}`) {
      setAddMessage("ゲーム名・曲名・作曲者名を確認し、確認欄にチェックしてください。"); return;
    }
    setAdding(true);

    try {
      const response = await fetch(
        "/api/bgms",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            composer,
            igdb_game_id: newIgdbGameId,
            game_id: newGameId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setAddMessage(
          typeof result?.error === "string"
            ? result.error
            : "音楽の追加に失敗しました。"
        );
        return;
      }

      const addedBgm = result?.bgm as
        | Bgm
        | undefined;

      if (!addedBgm) {
        setAddMessage(
          "音楽の追加結果を取得できませんでした。"
        );
        return;
      }

      setBgms((current) => [
        ...current,
        addedBgm,
      ]);

      setGameBgms(current => [...current, addedBgm]);
      setAddMessage("音楽を追加しました！");
      setConfirmedTitle("");

      setTimeout(() => {
        closeAddForm();
      }, 800);
    } catch (error) {
      console.error(
        "BGM追加APIエラー:",
        error
      );

      setAddMessage(
        "音楽の追加に失敗しました。通信状態を確認してください。"
      );
    } finally {
      setAdding(false);
    }
  }

  // =========================
  // 管理者ゲーム情報編集
  // =========================

  function openGameInfoEditor(
    bgm: Bgm
  ) {
    if (!isAdmin) {
      return;
    }

    setEditingBgm(bgm);
    setEditGameQuery(
      bgm.game_title
    );
    setEditGameResults([]);
    setEditGameError("");
    setEditSelectedGame(null);
    setEditSaveError("");
  }

  function closeGameInfoEditor() {
    setEditingBgm(null);
    setEditGameQuery("");
    setEditGameResults([]);
    setEditGameError("");
    setEditSelectedGame(null);
    setEditSaveError("");
    setSavingGameInfo(false);
  }

  function selectGameForEdit(
    game: GameSearchResult
  ) {
    setEditSelectedGame(game);
    setEditGameQuery(game.name);
    setEditGameResults([]);
    setEditGameError("");
    setEditSaveError("");
  }

  function searchAgainForEdit() {
    setEditSelectedGame(null);
    setEditGameResults([]);
    setEditGameError("");
    setEditSaveError("");
  }

  async function saveGameInfo() {
    if (!editingBgm || !editSelectedGame || !isAdmin) return;
    setSavingGameInfo(true);
    setEditSaveError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("管理者ログインが必要です。");
      const response = await fetch("/api/bgms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bgm_id: editingBgm.id, igdb_game_id: editSelectedGame.id, game_id: editSelectedGame.game_id ?? null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ゲーム情報の保存に失敗しました。");
      const updatedBgm = result.bgm as Bgm;
      setBgms(current => current.map(bgm => bgm.id === updatedBgm.id ? updatedBgm : bgm));
      setGameBgms(current => current.flatMap(bgm => bgm.id !== updatedBgm.id ? [bgm] :
        ((chosenGame?.game_id != null && updatedBgm.game_id === chosenGame.game_id) ||
          (chosenGame?.game_id == null && updatedBgm.igdb_game_id === chosenGame?.id)) ? [updatedBgm] : []));
      setSelected(current => current.map(bgm => bgm.id === updatedBgm.id ? updatedBgm : bgm));
      closeGameInfoEditor();
    } catch (error) {
      setEditSaveError(error instanceof Error ? error.message : "ゲーム情報の保存に失敗しました。");
    } finally {
      setSavingGameInfo(false);
    }
  }

  // =========================
  // BGM通報
  // =========================

  function openReportModal(bgm: Bgm) {
    setReportingBgm(bgm);
    setReportReason("");
    setReportDetail("");
    setReportError("");
    setReportSuccess(false);
  }

  function closeReportModal() {
    if (reportSending) return;

    setReportingBgm(null);
    setReportReason("");
    setReportDetail("");
    setReportError("");
    setReportSuccess(false);
  }

  async function submitReport() {
    if (!reportingBgm) return;

    if (!reportReason) {
      setReportError("通報理由を選択してください。");
      return;
    }

    if (reportDetail.length > 500) {
      setReportError("詳細は500文字以内で入力してください。");
      return;
    }

    setReportSending(true);
    setReportError("");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bgm_id: reportingBgm.id,
          reason: reportReason,
          detail: reportDetail.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setReportError(
          typeof result?.error === "string"
            ? result.error
            : "通報の送信に失敗しました。しばらくしてからもう一度お試しください。"
        );
        setReportSending(false);
        return;
      }

      setReportSending(false);
      setReportSuccess(true);
    } catch (error) {
      console.error("通報送信エラー:", error);
      setReportError(
        "通報の送信に失敗しました。しばらくしてからもう一度お試しください。"
      );
      setReportSending(false);
    }
  }

  // =========================
  // 管理者用 通報管理
  // =========================

  async function loadAdminReports() {
    if (!isAdmin) return;

    setAdminReportsLoading(true);
    setAdminReportsError("");

    const { data, error } = await supabase
      .from("bgm_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("通報一覧取得エラー:", error);
      setAdminReportsError(
        "通報一覧の読み込みに失敗しました。RLS設定を確認してください。"
      );
      setAdminReportsLoading(false);
      return;
    }

    setAdminReports((data ?? []) as BgmReport[]);
    setAdminReportsLoading(false);
  }

  async function openReportManager() {
    if (!isAdmin) return;

    setShowReportManager(true);
    setReportStatusFilter("pending");
    await loadAdminReports();
  }

  function closeReportManager() {
    if (updatingReportId !== null) return;
    setShowReportManager(false);
    setAdminReportsError("");
  }

  async function updateReportStatus(
    reportId: number,
    status: "resolved" | "dismissed"
  ) {
    if (!isAdmin) return;

    setUpdatingReportId(reportId);
    setAdminReportsError("");

    const { data, error } = await supabase
      .from("bgm_reports")
      .update({ status })
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) {
      console.error("通報ステータス更新エラー:", error);
      setAdminReportsError(
        "通報ステータスの更新に失敗しました。"
      );
      setUpdatingReportId(null);
      return;
    }

    const updated = data as BgmReport;

    setAdminReports((current) =>
      current.map((report) =>
        report.id === updated.id ? updated : report
      )
    );

    setUpdatingReportId(null);
  }

  function getReportReasonLabel(reason: string) {
    const labels: Record<string, string> = {
      duplicate: "重複している",
      not_exist: "存在しない曲",
      wrong_title: "音楽名が間違っている",
      wrong_game: "ゲームが間違っている",
      inappropriate: "不適切な内容",
      other: "その他",
    };

    return labels[reason] ?? reason;
  }

  function formatReportDate(value: string) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function openReportedBgmEditor(report: BgmReport) {
    const target = bgms.find((bgm) => bgm.id === report.bgm_id);

    if (!target) {
      setAdminReportsError(
        "対象の音楽が見つかりません。"
      );
      return;
    }

    setShowReportManager(false);
    openGameInfoEditor(target);
  }

  function openReportedBgmHide(report: BgmReport) {
    const target = bgms.find((bgm) => bgm.id === report.bgm_id);

    if (!target) {
      setAdminReportsError(
        "対象の音楽が見つかりません。"
      );
      return;
    }

    setShowReportManager(false);
    openDeleteModal(target);
  }

  // =========================
  // 管理者用 BGM非表示
  // =========================

  function openDeleteModal(bgm: Bgm) {
    if (!isAdmin) return;

    setDeletingBgm(bgm);
    setDeleteError("");
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeletingBgm(null);
    setDeleteError("");
  }

  async function deleteBgm() {
    if (!deletingBgm || !isAdmin) return;

    setDeleting(true);
    setDeleteError("");

    const { data, error } = await supabase
      .from("bgms")
      .update({ is_hidden: true })
      .eq("id", deletingBgm.id)
      .select("*")
      .single();

    if (error) {
      console.error("BGM非表示エラー:", error);

      setDeleteError(
        "非表示にできませんでした。管理者のUPDATE権限とRLS設定を確認してください。"
      );

      setDeleting(false);
      return;
    }

    const updatedBgm = data as Bgm;

    setGameBgms(current => current.map(bgm => bgm.id === updatedBgm.id ? updatedBgm : bgm));

    setBgms((current) =>
      current.map((bgm) =>
        bgm.id === updatedBgm.id ? updatedBgm : bgm
      )
    );

    // 自分で編集中の9曲に入っていた場合だけ外す。
    // 共有セット閲覧中は過去のMY 9を壊さないため、そのまま表示する。
    if (!isViewingSharedSet) {
      setSelected((current) =>
        current.filter((bgm) => bgm.id !== updatedBgm.id)
      );
    }

    setDeleting(false);
    setDeletingBgm(null);
  }

  async function restoreBgm(bgm: Bgm) {
    if (!isAdmin) return;

    const { data, error } = await supabase
      .from("bgms")
      .update({ is_hidden: false })
      .eq("id", bgm.id)
      .select("*")
      .single();

    if (error) {
      console.error("BGM再表示エラー:", error);
      alert("音楽の再表示に失敗しました。");
      return;
    }

    const updatedBgm = data as Bgm;

    setBgms((current) =>
      current.map((item) =>
        item.id === updatedBgm.id ? updatedBgm : item
      )
    );
  }

  // =========================
  // Canvas
  // =========================

  function loadCanvasImage(
    url: string
  ): Promise<HTMLImageElement> {
    return new Promise(
      (resolve, reject) => {
        const image =
          new Image();

        image.onload = () =>
          resolve(image);

        image.onerror = () =>
          reject(
            new Error(
              "画像の読み込みに失敗しました"
            )
          );

        image.src = url;
      }
    );
  }

  function drawImageCover(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const imageRatio =
      image.width /
      image.height;

    const boxRatio =
      width / height;

    let sourceWidth =
      image.width;

    let sourceHeight =
      image.height;

    let sourceX = 0;
    let sourceY = 0;

    if (
      imageRatio > boxRatio
    ) {
      sourceWidth =
        image.height *
        boxRatio;

      sourceX =
        (image.width -
          sourceWidth) /
        2;
    } else {
      sourceHeight =
        image.width /
        boxRatio;

      sourceY =
        (image.height -
          sourceHeight) /
        2;
    }

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height
    );
  }

  function fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    minSize: number
  ) {
    let size =
      startSize;

    while (
      size > minSize
    ) {
      ctx.font =
        `bold ${size}px sans-serif`;

      if (
        ctx.measureText(text)
          .width <= maxWidth
      ) {
        break;
      }

      size -= 2;
    }

    return size;
  }

  // =========================
  // 3×3画像生成
  // =========================

  async function generateShareImage(openModal = true) {
    if (
      selected.length !== 9
    ) {
      return;
    }

    setGeneratingImage(true);
    setGeneratedImage(null);

    try {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width = 1800;
      canvas.height = 1800;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        throw new Error(
          "Canvasを使用できません"
        );
      }

      const tileSize =
        600;

      ctx.fillStyle =
        "#0f172a";

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const loadedImages = await Promise.all(
        selected.map(async (bgm) => {
          if (!bgm.image_url) return null;

          try {
            const proxyUrl =
              `/api/image-proxy?url=${encodeURIComponent(
                bgm.image_url
              )}`;

            return await loadCanvasImage(
              proxyUrl
            );
          } catch (error) {
            console.error(
              "画像読み込み失敗:",
              error
            );

            return null;
          }
        })
      );

      for (
        let index = 0;
        index < 9;
        index++
      ) {
        const bgm =
          selected[index];

        const col =
          index % 3;

        const row =
          Math.floor(
            index / 3
          );

        const x =
          col * tileSize;

        const y =
          row * tileSize;

        const image =
          loadedImages[index];

        if (image) {
          drawImageCover(
            ctx,
            image,
            x,
            y,
            tileSize,
            tileSize
          );
        } else {
          ctx.fillStyle =
            "#334155";

          ctx.fillRect(
            x,
            y,
            tileSize,
            tileSize
          );
        }

        const gradient =
          ctx.createLinearGradient(
            0,
            y + 300,
            0,
            y + 600
          );

        gradient.addColorStop(
          0,
          "rgba(0,0,0,0)"
        );

        gradient.addColorStop(
          1,
          "rgba(0,0,0,0.92)"
        );

        ctx.fillStyle =
          gradient;

        ctx.fillRect(
          x,
          y + 250,
          tileSize,
          350
        );

        ctx.textAlign =
          "left";

        ctx.textBaseline =
          "alphabetic";

        ctx.fillStyle =
          "#ffffff";

        const titleSize =
          fitText(
            ctx,
            bgm.title,
            520,
            44,
            26
          );

        ctx.font =
          `bold ${titleSize}px sans-serif`;

        ctx.fillText(
          bgm.title,
          x + 38,
          y + 510
        );

        ctx.fillStyle =
          "rgba(255,255,255,0.75)";

        const gameSize =
          fitText(
            ctx,
            bgm.game_title,
            520,
            27,
            19
          );

        ctx.font =
          `${gameSize}px sans-serif`;

        ctx.fillText(
          bgm.game_title,
          x + 38,
          y + 558
        );

        ctx.strokeStyle =
          "rgba(255,255,255,0.18)";

        ctx.lineWidth = 2;

        ctx.strokeRect(
          x,
          y,
          tileSize,
          tileSize
        );
      }

      ctx.fillStyle =
        "rgba(255,255,255,0.8)";

      ctx.textAlign =
        "right";

      ctx.font =
        "bold 22px sans-serif";

      ctx.fillText(
        "My9GameMusic",
        1765,
        1765
      );

      const dataUrl =
        canvas.toDataURL(
          "image/png"
        );

      setGeneratedImage(
        dataUrl
      );

      if (openModal) {
        setShowShareModal(true);
      }
      return dataUrl;
    } catch (error) {
      console.error(
        "画像生成エラー:",
        error
      );

      alert(
        "画像の生成に失敗しました。"
      );
      return null;
    } finally {
      setGeneratingImage(
        false
      );
    }
  }

  useEffect(() => {
    if (isViewingSharedSet && selected.length === 9) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void generateShareImage(false);
    }
  }, [isViewingSharedSet, selected]);

  function downloadShareImage(imageUrl = generatedImage) {
    if (!imageUrl) {
      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href =
      imageUrl;

    link.download =
      "my9bgm.png";

    link.click();
  }

  async function downloadPublishedImage() {
    if (!publishedUrl || generatingImage) return;
    const imageUrl = await generateShareImage(false);
    if (imageUrl) downloadShareImage(imageUrl);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={args => args.active.data.current?.bgmId ? pointerWithin(args) : closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(item => item.id !== "selection-drop") })} onDragEnd={handleDragEnd}>
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f5f8fc] text-slate-900">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
          <div className="flex items-center gap-10">
            <button
              type="button"
              onClick={returnToMyEditor}
              className="whitespace-nowrap text-sm font-bold tracking-[0.18em] sm:text-base sm:tracking-[0.2em]"
            >
              🎧 My9GameMusic
            </button>

            <nav className="hidden gap-7 text-sm font-semibold md:flex">
              <button
                type="button"
                onClick={returnToMyEditor}
                className={`py-5 ${
                  !loading && !isViewingSharedSet
                    ? "border-b-2 border-sky-500 text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                作成
              </button>

              <a
                href="/community"
                className={`py-5 ${!loading && isViewingSharedSet ? "border-b-2 border-sky-500 text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
              >
                みんなの9つの音楽
              </a>

              <button
                type="button"
                onClick={() => openAddForm()}
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                音楽を追加
              </button>

              <BugReportButton className="py-5 text-slate-500 hover:text-slate-900" />

              <a
                href="/about"
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                このサイトについて
              </a>
            </nav>
          </div>

          {isAdmin && (
            <button type="button" onClick={openReportManager} className="relative rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">
              ⚠ 通報管理
              {adminReports.filter(report => report.status === "pending").length > 0 && <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{adminReports.filter(report => report.status === "pending").length}</span>}
            </button>
          )}
        </div>

        <nav className="grid w-full grid-cols-5 border-t border-slate-100 bg-white text-[11px] font-semibold md:hidden">
          <button
            type="button"
            onClick={returnToMyEditor}
            className={`min-w-0 px-1 py-3 text-center ${
              !loading && !isViewingSharedSet
                ? "border-b-2 border-sky-500 text-slate-900"
                : "text-slate-500"
            }`}
          >
            作成
          </button>

          <a
            href="/community"
            className={`min-w-0 px-1 py-3 text-center ${!loading && isViewingSharedSet ? "border-b-2 border-sky-500 text-slate-900" : "text-slate-500"}`}
          >
            みんなの音楽
          </a>

          <button
            type="button"
            onClick={() => openAddForm()}
            className="min-w-0 px-1 py-3 text-center text-slate-500"
          >
            音楽を追加
          </button>

          <BugReportButton className="min-w-0 px-1 py-3 text-center text-slate-500" />

          <a
            href="/about"
            className="min-w-0 px-1 py-3 text-center text-slate-500"
          >
            このサイト
          </a>
        </nav>
      </header>

      {loading && (
        <div className="mx-auto flex min-h-[55vh] max-w-[1400px] items-center justify-center px-6 text-sm text-slate-500">
          ページを読み込んでいます...
        </div>
      )}

      {isAdmin && (
        <div className="border-b border-emerald-200 bg-emerald-50">
          <div className="mx-auto max-w-[1400px] px-6 py-2 text-center text-xs font-semibold text-emerald-700">
            管理者モードでログイン中です。音楽の編集・非表示・再表示・通報管理を利用できます。
          </div>
        </div>
      )}

      {isViewingSharedSet && (
        <div className="border-b border-sky-200 bg-sky-50">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
            <div>
              <p className="text-xs font-bold tracking-[0.15em] text-sky-500">
                SHARED MY 9
              </p>

              <p className="font-semibold text-slate-700">
                {sharedSet.title ||
                  "共有された9つの音楽"}
              </p>
            </div>

            <button
              type="button"
              onClick={returnToMyEditor}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-sky-600 shadow-sm"
            >
              自分の9曲を作る
            </button>
          </div>
        </div>
      )}

      <div className={`mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 sm:py-10 ${loading ? "hidden" : ""}`}>
        <div className="mb-7 sm:mb-9">
          <p className="mb-2 text-xs font-bold tracking-[0.25em] text-sky-500 sm:text-sm">
            {isViewingSharedSet ? "MY 9 BY" : "MY9 GAME MUSIC"}
          </p>

          <h1 className="text-2xl font-bold leading-tight sm:text-4xl">
            {isViewingSharedSet
              ? sharedSet.creator_name || "匿名"
              : "私を彩る9つのゲーム音楽"}
          </h1>

          {isViewingSharedSet && (
            <p className="mt-3 text-sm text-slate-500 sm:text-base">
              {sharedSet.title || "私を彩る9つのゲーム音楽"}
            </p>
          )}
        </div>

        {sharedSetError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {sharedSetError}
          </div>
        )}

        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-10">
          <section className="min-w-0">
            {isViewingSharedSet && (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                {generatedImage ? (
                  <img src={generatedImage} alt="9つの音楽共有画像" className="aspect-square w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
                    9つの音楽画像を作成しています...
                  </div>
                )}
              </div>
            )}

            {!isViewingSharedSet && (<>
            <div className="mb-6 rounded-2xl border border-sky-100 bg-white p-4">
              <label className="block text-sm font-bold">
                名前
                <input value={creatorName} onChange={e => updateCreatorName(e.target.value)} maxLength={30} placeholder="" className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-sky-400" />
              </label>
            </div>
            <p className="mb-3 text-xs text-slate-500"></p>
            <input
              type="text"
              placeholder="音楽名・ゲーム名・作曲者で検索..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleBgmCount(BGM_PAGE_SIZE);
              }}
              className="mb-6 h-[52px] w-full max-w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none focus:border-sky-400 sm:px-5 sm:text-base"
            />

            {loading ? (
              <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
                音楽を読み込んでいます...
              </div>
         ) : filtered.length === 0 ? (
  <div className="rounded-2xl bg-white p-10 text-center">
    <p className="font-medium text-slate-700">
      音楽が見つかりませんでした。
    </p>
    <p className="mt-2 text-sm text-slate-500">
      日本語、英語等表記を変えて検索するか、
      <br className="sm:hidden" />
      未登録の場合は「新しい音楽を追加」から登録できます。
    </p>
  </div>
) : (
              <>
              <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {filtered.slice(0, visibleBgmCount).map(
                  (bgm) => {
                    const alreadySelected =
                      selected.some(
                        (item) =>
                          item.id ===
                          bgm.id
                      );

                    return (
                      <div
                        key={bgm.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${bgm.title}を拡大表示`}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("button, summary, details, a")) return;
                          if (window.getSelection()?.toString()) return;
                          setPreviewBgm(bgm);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPreviewBgm(bgm);
                          }
                        }}
                        className="min-w-0 cursor-pointer overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <div className="relative aspect-square">
                          <NextImage
                            src={getImageUrl(
                              bgm,
                              "600x600"
                            )}
                            alt={bgm.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
                            className="object-cover"
                          />

                          {!isViewingSharedSet && (
                            <button
                              type="button"
                              onClick={() =>
                                addBgmToSelection(
                                  bgm
                                )
                              }
                              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-sky-500 shadow"
                            >
                              {alreadySelected
                                ? "✓"
                                : "+"}
                            </button>
                          )}

                          {isViewingSharedSet &&
                            alreadySelected && (
                              <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-white shadow">
                                ✓
                              </div>
                            )}
                        </div>

                        <div className="min-w-0 p-3 sm:p-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">
                              {bgm.title}
                            </p>

                            <details className="group/menu relative flex-none">
                              <summary aria-label={`${bgm.title}のメニュー`} className="flex h-6 w-6 list-none items-center justify-center rounded-full font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 [&::-webkit-details-marker]:hidden">⋯</summary>
                              <div className="absolute right-0 top-7 z-20 w-52 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">

                          <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm">
                            {bgm.game_title}
                          </p>

                          {bgm.composer && (
                            <p className="mt-1 truncate text-xs text-slate-400">
                              {bgm.composer}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              openReportModal(bgm)
                            }
                            className="mt-3 text-[11px] font-semibold text-slate-400 transition hover:text-amber-600 sm:text-xs"
                          >
                            ⚠ この音楽を通報
                          </button>

                          {isAdmin && (
                            <>
                              <div className="mt-3">
                                {(bgm.igdb_game_id || bgm.rawg_game_id) ? (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                    <span>
                                      ✓
                                    </span>
                                    <span>
                                      ゲーム連携済み
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                                    <span>
                                      ⚠
                                    </span>
                                    <span>
                                      ゲーム未設定
                                    </span>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  openGameInfoEditor(
                                    bgm
                                  )
                                }
                                className={`mt-2 w-full rounded-xl border px-3 py-2 text-xs font-semibold ${
                                  (bgm.igdb_game_id || bgm.rawg_game_id)
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                {(bgm.igdb_game_id || bgm.rawg_game_id)
                                  ? "🛠 ゲーム情報・画像を変更"
                                  : "🛠 ゲーム情報を設定"}
                              </button>

                              {bgm.is_hidden ? (
                                <>
                                  <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-500">
                                    🙈 現在この音楽は非表示です
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => restoreBgm(bgm)}
                                    className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                  >
                                    👁 この音楽を再表示
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDeleteModal(bgm)
                                  }
                                  className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                                >
                                  🙈 この音楽を非表示
                                </button>
                              )}
                            </>
                          )}
                              </div>
                            </details>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {visibleBgmCount < filtered.length && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleBgmCount((count) => count + BGM_PAGE_SIZE)}
                    className="rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    さらに表示（残り{filtered.length - visibleBgmCount}曲）
                  </button>
                </div>
              )}
              </>
            )}

            {!isViewingSharedSet && (
              <div className="mt-8 rounded-2xl border border-sky-100 bg-sky-50 p-6">
                <p className="font-bold">
                  探している音楽が見つかりませんか？
                </p>

                <button
                  type="button"
                  onClick={() =>
                    openAddForm()
                  }
                  className="mt-4 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-100 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  ＋ 新しい音楽を追加
                </button>
              </div>
            )}
            </>)}
          </section>

          {!loading && (
            <section className="min-w-0">
              <div className="sticky top-8 w-full min-w-0">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="min-w-0 text-sm font-bold tracking-[0.14em] sm:text-base sm:tracking-[0.18em]">
                  SELECTED MUSIC ·{" "}
                  {selected.length} / 9
                </h2>

                {!isViewingSharedSet && (
                  <button
                    type="button"
                    onClick={
                      clearSelected
                    }
                    className="text-sm text-slate-400 hover:text-red-500"
                  >
                    クリア
                  </button>
                )}
              </div>

              <SelectionDrop disabled={isViewingSharedSet}>
                <SortableContext
                  items={selected.map(
                    (bgm) => bgm.id
                  )}
                  strategy={
                    verticalListSortingStrategy
                  }
                >
                  <div className="space-y-3">
                    {selected.map(
                      (
                        bgm,
                        index
                      ) => (
                        <SortableBgm
                          key={bgm.id}
                          bgm={bgm}
                          index={index}
                          removeBgm={
                            removeBgm
                          }
                          getImageUrl={
                            getImageUrl
                          }
                          readOnly={
                            isViewingSharedSet
                          }
                          comment={comments[bgm.id] ?? ""}
                          canEditComment={!isViewingSharedSet}
                          onEditComment={() => openCommentEditor(bgm)}
                        />
                      )
                    )}

                    {Array.from({
                      length:
                        9 -
                        selected.length,
                    }).map(
                      (
                        _,
                        emptyIndex
                      ) => {
                        const index =
                          selected.length +
                          emptyIndex;

                        return (
                          <div
                            key={`empty-${index}`}
                            className="flex h-[74px] w-full min-w-0 items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-3 sm:px-5"
                          >
                            <span className="text-lg font-bold text-slate-300 sm:text-xl">
                              {index + 1}
                            </span>

                            <span className="ml-3 text-sm text-slate-400 sm:ml-5">
                              音楽を選択
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </SortableContext>
              </SelectionDrop>

              {!isViewingSharedSet && (
                <button
                  type="button"
                  onClick={
                    openPublishModal
                  }
                  disabled={
                    selected.length !== 9
                  }
                  className="mt-5 w-full max-w-full rounded-2xl bg-sky-500 px-3 py-4 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-30 sm:text-base"
                >
                  {publishedUrl && publishedSelectionFingerprint === getSelectionFingerprint()
                    ? "公開済みの共有を見る"
                    : "この9曲を公開する"}
                </button>
              )}

              {isViewingSharedSet && (
                <button
                  type="button"
                  onClick={
                    returnToMyEditor
                  }
                  className="mt-3 w-full max-w-full rounded-2xl border border-slate-200 bg-white px-3 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:text-base"
                >
                  自分の9曲を作る
                </button>
              )}
              </div>
            </section>
          )}
        </div>
      </div>

      {previewBgm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${previewBgm.title}の拡大表示`}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-5 outline-none sm:p-8"
        >
          <button
            type="button"
            autoFocus
            aria-label="拡大表示を閉じる"
            onClick={() => setPreviewBgm(null)}
            className="absolute inset-0 cursor-default"
          />
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl"
          >
            <div className="relative aspect-square w-full bg-slate-100">
              <NextImage
                src={getImageUrl(previewBgm, "900x900")}
                alt={previewBgm.title}
                fill
                priority
                sizes="(max-width: 640px) calc(100vw - 40px), 448px"
                className="object-cover"
              />
            </div>
            <div className="p-5 sm:p-6">
              <p className="break-words text-xl font-bold leading-snug text-slate-950 sm:text-2xl">
                {previewBgm.title}
              </p>
              <p className="mt-2 break-words text-sm text-slate-600 sm:text-base">
                {previewBgm.game_title}
              </p>
              {previewBgm.composer && (
                <p className="mt-2 break-words text-xs text-slate-400 sm:text-sm">
                  {previewBgm.composer}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {commentingBgm && (
        <div onClick={() => setCommentingBgm(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold tracking-[0.18em] text-sky-500">COMMENT</p><h2 className="mt-1 text-xl font-bold">{comments[commentingBgm.id] ? "コメントを編集" : "コメントを追加"}</h2></div>
              <button type="button" onClick={() => setCommentingBgm(null)} className="text-2xl text-slate-400">×</button>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">{commentingBgm.title}</p>
            <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={200} rows={4} placeholder="この音楽への思い出や感想を入力" className="mt-3 w-full resize-none rounded-2xl border border-slate-300 p-3 text-sm outline-none focus:border-sky-400" />
            <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{commentError}</span><span>{commentDraft.length}/200</span></div>
            <button type="button" onClick={saveComment} className="mt-4 w-full rounded-2xl bg-sky-500 px-4 py-3 font-bold text-white">保存</button>
          </div>
        </div>
      )}

      {/* 公開モーダル */}

      {showPublishModal && (
        <div
          onClick={
            closePublishModal
          }
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4"
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-sky-500">
                  PUBLISH MY 9
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  9つの音楽を公開
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closePublishModal
                }
                className="text-2xl text-slate-400"
              >
                ×
              </button>
            </div>

            {!publishedUrl ? (
              <>
                <p className="mb-5 text-sm leading-6 text-slate-500">
                  選んだ9曲と並び順を公開します。
                </p>
                <p className="mb-4 text-sm text-slate-600">作成者：{creatorName.trim() || "匿名"}</p>

                <label className="mb-2 block text-sm font-semibold">
                  タイトル
                  <span className="ml-2 font-normal text-slate-400">
                    任意
                  </span>
                </label>

                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) =>
                    setPublishTitle(
                      e.target.value
                    )
                  }
                  maxLength={100}
                  placeholder="例：私を彩る9つのゲーム音楽"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
                />

                {publishError && (
                  <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {publishError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={
                    publishBgmSet
                  }
                  disabled={
                    publishing
                  }
                  className="mt-6 w-full rounded-xl bg-sky-500 py-3.5 font-bold text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {publishing
                    ? "公開しています..."
                    : "この9曲を公開する"}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-emerald-50 p-5">
                  <p className="font-bold text-emerald-700">
                    ✓ 公開しました！
                  </p>
                </div>

                <div className="mt-5 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publishedUrl}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />

                  <button
                    type="button"
                    onClick={
                      copyPublishedUrl
                    }
                    className="whitespace-nowrap rounded-xl bg-slate-900 px-5 font-bold text-white"
                  >
                    {copied
                      ? "コピー済み ✓"
                      : "コピー"}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={sharePublishedSetOnX} className="rounded-xl bg-black px-3 py-3 text-sm font-bold text-white hover:bg-slate-800">
                    Xにポストする
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPublishedImage()}
                    disabled={generatingImage}
                    className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingImage ? "画像を作成しています..." : "画像を保存"}
                  </button>
                </div>

                <div className="mt-2">
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700"
                  >
                    共有ページを開いて確認 →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 管理者ログイン */}

      {/* BGM追加 */}

      {showAddForm && (
        <div
          onClick={
            closeAddForm
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-sky-500">
                  ADDMusic
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  新しい音楽を追加
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeAddForm
                }
                className="text-2xl text-slate-400"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleAddBgm
              }
            >
              <label className="mb-2 block text-sm font-semibold">
                ゲーム
              </label>

              {newIgdbGameId === null ? (
                <>
                  <input
                    value={newGameTitle}
                    onCompositionStart={() => setGameComposing(true)}
                    onCompositionEnd={() => setGameComposing(false)}
                    onChange={(e) => {
                      setGameResults([]);
                      setNewGameTitle(
                        e.target.value
                      );

                      setNewIgdbGameId(
                        null
                      );

                      setNewGameId(null);

                      setNewImageUrl(
                        null
                      );

                      setAddMessage(
                        ""
                      );
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
                    placeholder="ゲーム名を検索..."
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    検索結果からゲームを選択してください。
                  </p>

                  {gameSearching && (
                    <p className="mt-3 text-sm text-slate-500">
                      ゲームを検索しています...
                    </p>
                  )}

                  {gameSearchError && (
                    <p className="mt-3 text-sm text-red-500">
                      {gameSearchError}
                    </p>
                  )}

                  {gameResults.length >
                    0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      {gameResults.map(
                        (game) => (
                          <button
                            key={game.id}
                            type="button"
                            onClick={() =>
                              chooseGame(game)
                            }
                            className="flex w-full items-center gap-4 border-b border-slate-100 p-3 text-left transition last:border-b-0 hover:bg-sky-50"
                          >
                            {game.image ? (
                              <img
                                src={
                                  game.image
                                }
                                alt={
                                  game.name
                                }
                                className="h-16 w-24 flex-none rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-24 flex-none items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                                NO IMAGE
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold sm:text-base">
                                {
                                  game.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {game.released ??
                                  "発売日不明"}
                              </p>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
                  {newImageUrl && (
                    <img
                      src={newImageUrl}
                      alt={
                        newGameTitle
                      }
                      className="aspect-video w-full object-cover"
                    />
                  )}

                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-sky-500">
                        選択したゲーム
                      </p>

                      <p className="truncate font-bold">
                        {
                          newGameTitle
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        IGDB ID:{" "}
                        {
                          newIgdbGameId
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        clearSelectedGame
                      }
                      className="flex-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      変更
                    </button>
                  </div>
                </div>
              )}

              {newIgdbGameId !== null && <div className="mt-5 rounded-xl border p-4">
                <h3 className="font-bold">このゲームに登録されている音楽</h3>
                <p role="status" className="my-2 text-sm text-slate-500">{gameListStatus || (gameBgms.length ? "同じ曲があれば一覧から選択してください。曲名の表記も確認できます。" : "まだ音楽がありません。下から登録できます。")}</p>
                <div className="max-h-48 space-y-2 overflow-y-auto">{registrationBgms.map(bgm => <button type="button" key={bgm.id} onClick={() => { addBgmToSelection(bgm); closeAddForm(); }} className="block w-full rounded-lg bg-slate-50 p-3 text-left hover:bg-sky-50">{bgm.title}<span className="ml-2 text-xs text-slate-400">{bgm.composer}</span></button>)}</div>
                {!gameListReady && !gameListStatus.includes("読み込んで") && chosenGame && <button type="button" onClick={() => chooseGame({ ...chosenGame })}>再読み込み</button>}
              </div>}
              {newIgdbGameId !== null && gameListReady && <>
              <p className="my-4 text-sm text-slate-500">探している曲がなければ登録してください。別ゲームの同名曲は別々に登録できます。</p>
              <label className="mb-2 block text-sm font-semibold">
                音楽名
              </label>

              <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
                <p className="font-semibold text-sky-700">正式な曲名が分からなくても大丈夫です。</p>
                <p className="mt-1">「○○のテーマ」「オープニング」「エンドロール」など、分かる範囲の名前で追加できます。</p>
              </div>

              <input
                value={newTitle}
                onChange={(e) =>
                  setNewTitle(
                    e.target.value
                  )
                }
                className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="曲名（例：英雄の証 / ○○のテーマ / エンドロール）"
                maxLength={150}
              />


              <label className="mb-2 mt-5 block text-sm font-semibold">
                作曲者
                <span className="ml-2 font-normal text-slate-400">
                  任意
                </span>
              </label>

              <input
                value={newComposer}
                onChange={(e) =>
                  setNewComposer(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder=""
                maxLength={100}
              />

              {newTitle.trim() && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">
                <p>{newGameTitle} ／ {newTitle} {newComposer && `／ ${newComposer}`}</p>
                {gameBgms.some(bgm => similarTitle(bgm.title, newTitle)) && <p className="mt-2 font-semibold">似た曲名があります。一覧で同じ曲がないか確認してください。</p>}
                <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={confirmedTitle === `${newIgdbGameId}:${newTitle.trim()}:${newComposer.trim()}`} onChange={e => setConfirmedTitle(e.target.checked ? `${newIgdbGameId}:${newTitle.trim()}:${newComposer.trim()}` : "")} />表記・誤字と登録済みの曲を確認しました</label>
              </div>}
              </>}
              {addMessage && (
                <div
                  className={`mt-5 rounded-xl px-4 py-3 text-sm ${
                    addMessage.includes(
                      "追加しました"
                    )
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {addMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  adding || !gameListReady || !newTitle.trim() || confirmedTitle !== `${newIgdbGameId}:${newTitle.trim()}:${newComposer.trim()}` ||
                  newIgdbGameId ===
                    null
                }
                className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {adding
                  ? "追加しています..."
                  : newIgdbGameId ===
                      null
                    ? "ゲームを選択してください"
                    : "音楽を追加"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 管理者用ゲーム情報編集 */}

      {editingBgm &&
        isAdmin && (
          <div
            onClick={
              closeGameInfoEditor
            }
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4"
          >
            <div
              onClick={(e) =>
                e.stopPropagation()
              }
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl"
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-emerald-600">
                    ADMIN EDIT
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    ゲーム情報を設定
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    音楽：
                    <span className="font-semibold text-slate-700">
                      {
                        editingBgm.title
                      }
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeGameInfoEditor
                  }
                  className="text-2xl text-slate-400"
                >
                  ×
                </button>
              </div>

              <div className="mb-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  現在の情報
                </p>

                <p className="mt-2 text-sm">
                  ゲーム：
                  <span className="font-semibold">
                    {
                      editingBgm.game_title
                    }
                  </span>
                </p>

                <p className="mt-1 text-sm">
                  ゲームID：
                  <span
                    className={
                      (editingBgm.igdb_game_id || editingBgm.rawg_game_id)
                        ? "font-semibold text-emerald-600"
                        : "font-semibold text-amber-600"
                    }
                  >
                    {editingBgm.igdb_game_id ? `IGDB: ${editingBgm.igdb_game_id}` : editingBgm.rawg_game_id ? `RAWG: ${editingBgm.rawg_game_id}` : "未設定"}
                  </span>
                </p>

                <p className="mt-1 text-sm">
                  重複判定名：
                  <span className="font-semibold">
                    {editingBgm.normalized_title ??
                      "未設定"}
                  </span>
                </p>
              </div>

              {!editSelectedGame ? (
                <>
                  <label className="mb-2 block text-sm font-semibold">
                    ゲームを検索
                  </label>

                  <input
                    value={
                      editGameQuery
                    }
                    onCompositionStart={() => setEditGameComposing(true)}
                    onCompositionEnd={() => setEditGameComposing(false)}
                    onChange={(e) => {
                      setEditGameResults([]);
                      setEditGameQuery(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-400"
                    placeholder="ゲーム名を入力..."
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    正しいゲームを検索結果から選択してください。
                  </p>

                  {editGameSearching && (
                    <p className="mt-4 text-sm text-slate-500">
                      ゲームを検索しています...
                    </p>
                  )}

                  {editGameError && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      {editGameError}
                    </p>
                  )}

                  {editGameResults.length >
                    0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      {editGameResults.map(
                        (game) => (
                          <button
                            key={game.id}
                            type="button"
                            onClick={() =>
                              selectGameForEdit(
                                game
                              )
                            }
                            className="flex w-full items-center gap-4 border-b border-slate-100 p-3 text-left transition last:border-b-0 hover:bg-emerald-50"
                          >
                            {game.image ? (
                              <img
                                src={
                                  game.image
                                }
                                alt={
                                  game.name
                                }
                                className="h-16 w-24 flex-none rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-24 flex-none items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                                NO IMAGE
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold sm:text-base">
                                {
                                  game.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                IGDB ID:{" "}
                                {
                                  game.id
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {game.released ??
                                  "発売日不明"}
                              </p>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50">
                    {editSelectedGame.image ? (
                      <img
                        src={
                          editSelectedGame.image
                        }
                        alt={
                          editSelectedGame.name
                        }
                        className="aspect-video w-full object-cover"
                      />
                    ) : editingBgm.image_url ? (
                      <img
                        src={
                          editingBgm.image_url
                        }
                        alt={
                          editSelectedGame.name
                        }
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-slate-100 text-sm text-slate-400">
                        画像なし
                      </div>
                    )}

                    <div className="p-5">
                      <p className="text-xs font-bold text-emerald-600">
                        選択したゲーム
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {
                          editSelectedGame.name
                        }
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        IGDB ID:{" "}
                        {
                          editSelectedGame.id
                        }
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        重複判定名:{" "}
                        <span className="font-semibold">
                          {normalizeBgmTitle(
                            editingBgm.title
                          )}
                        </span>
                      </p>

                      <button
                        type="button"
                        onClick={
                          searchAgainForEdit
                        }
                        className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        ← 別のゲームを選ぶ
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-700">
                    保存すると、
                    <strong>
                      ゲーム情報・画像
                    </strong>
                    が更新されます。
                  </div>

                  {editSaveError && (
                    <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      {editSaveError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={
                      saveGameInfo
                    }
                    disabled={
                      savingGameInfo
                    }
                    className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingGameInfo
                      ? "保存しています..."
                      : "このゲーム情報を保存"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      {/* BGM通報モーダル */}

      {reportingBgm && (
        <div
          onClick={closeReportModal}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-amber-500">
                  REPORT MUSIC
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  音楽を通報
                </h2>
              </div>

              <button
                type="button"
                onClick={closeReportModal}
                disabled={reportSending}
                className="text-2xl text-slate-400 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="font-bold">
                {reportingBgm.title}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {reportingBgm.game_title}
              </p>
            </div>

            {reportSuccess ? (
              <>
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="font-bold text-emerald-700">
                    ✓ 通報を送信しました
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-700/80">
                    内容を確認し、必要に応じて修正・非表示にします。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeReportModal}
                  className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white hover:bg-slate-700"
                >
                  閉じる
                </button>
              </>
            ) : (
              <>
                <label className="mb-2 mt-5 block text-sm font-semibold">
                  通報理由
                </label>

                <select
                  value={reportReason}
                  onChange={(e) => {
                    setReportReason(e.target.value);
                    setReportError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-amber-400"
                >
                  <option value="">理由を選択してください</option>
                  <option value="duplicate">重複している</option>
                  <option value="not_exist">存在しない曲</option>
                  <option value="wrong_title">音楽名が間違っている</option>
                  <option value="wrong_game">ゲームが間違っている</option>
                  <option value="inappropriate">不適切な内容</option>
                  <option value="other">その他</option>
                </select>

                <label className="mb-2 mt-5 block text-sm font-semibold">
                  詳細
                  <span className="ml-2 font-normal text-slate-400">
                    任意
                  </span>
                </label>

                <textarea
                  value={reportDetail}
                  onChange={(e) =>
                    setReportDetail(e.target.value)
                  }
                  maxLength={500}
                  rows={5}
                  placeholder="例：同じゲーム・同じ音楽が別名で登録されています。"
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {reportDetail.length} / 500
                </p>

                {reportError && (
                  <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {reportError}
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={closeReportModal}
                    disabled={reportSending}
                    className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    キャンセル
                  </button>

                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={reportSending || !reportReason}
                    className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {reportSending
                      ? "送信中..."
                      : "通報を送信"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 管理者用 通報管理モーダル */}

      {showReportManager && isAdmin && (
        <div
          onClick={closeReportManager}
          className="fixed inset-0 z-[98] flex items-center justify-center bg-black/50 px-4 py-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-7 py-6">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-amber-500">
                  REPORT MANAGEMENT
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  通報管理
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  未対応の通報を確認し、音楽の修正・非表示や対応状況の変更ができます。
                </p>
              </div>

              <button
                type="button"
                onClick={closeReportManager}
                disabled={updatingReportId !== null}
                className="text-2xl text-slate-400 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-7 py-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportStatusFilter("pending")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    reportStatusFilter === "pending"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  未対応 ({adminReports.filter((report) => report.status === "pending").length})
                </button>

                <button
                  type="button"
                  onClick={() => setReportStatusFilter("all")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    reportStatusFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  すべて ({adminReports.length})
                </button>
              </div>

              <button
                type="button"
                onClick={loadAdminReports}
                disabled={adminReportsLoading || updatingReportId !== null}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {adminReportsLoading ? "更新中..." : "↻ 再読み込み"}
              </button>
            </div>

            {adminReportsError && (
              <div className="mx-7 mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {adminReportsError}
              </div>
            )}

            <div className="overflow-y-auto px-7 py-5">
              {adminReportsLoading && adminReports.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  通報を読み込んでいます...
                </div>
              ) : adminReports.filter((report) =>
                  reportStatusFilter === "pending"
                    ? report.status === "pending"
                    : true
                ).length === 0 ? (
                <div className="rounded-2xl bg-slate-50 py-12 text-center">
                  <p className="font-semibold text-slate-600">
                    {reportStatusFilter === "pending"
                      ? "未対応の通報はありません 🎉"
                      : "通報はまだありません"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adminReports
                    .filter((report) =>
                      reportStatusFilter === "pending"
                        ? report.status === "pending"
                        : true
                    )
                    .map((report) => {
                      const targetBgm = bgms.find(
                        (bgm) => bgm.id === report.bgm_id
                      );
                      const isSiteBugReport = report.detail?.startsWith("[サイト不具合]") ?? false;

                      const isUpdating = updatingReportId === report.id;

                      return (
                        <div
                          key={report.id}
                          className="rounded-2xl border border-slate-200 p-5"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                  {isSiteBugReport ? "サイト不具合" : getReportReasonLabel(report.reason)}
                                </span>

                                {report.status === "pending" ? (
                                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                                    未対応
                                  </span>
                                ) : report.status === "resolved" ? (
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    対応済み
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                    却下
                                  </span>
                                )}

                                <span className="text-xs text-slate-400">
                                  {formatReportDate(report.created_at)}
                                </span>
                              </div>

                              <div className="mt-3">
                                {isSiteBugReport ? (
                                  <p className="font-bold text-slate-900">サイト全体の不具合報告</p>
                                ) : targetBgm ? (
                                  <>
                                    <p className="font-bold text-slate-900">
                                      {targetBgm.title}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                      {targetBgm.game_title}
                                    </p>
                                  </>
                                ) : (
                                  <p className="font-semibold text-red-500">
                                    対象の音楽が見つかりません (音楽 ID: {report.bgm_id})
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                                {report.detail || "詳細コメントなし"}
                              </div>
                            </div>

                            <div className="flex min-w-[190px] flex-col gap-2">
                              {targetBgm && !isSiteBugReport && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openReportedBgmEditor(report)}
                                    disabled={isUpdating}
                                    className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                                  >
                                    🛠 音楽情報を確認・編集
                                  </button>

                                  {targetBgm.is_hidden ? (
                                    <button
                                      type="button"
                                      onClick={() => restoreBgm(targetBgm)}
                                      disabled={isUpdating}
                                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                    >
                                      👁 音楽を再表示
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openReportedBgmHide(report)}
                                      disabled={isUpdating}
                                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                                    >
                                      🙈 非表示確認へ
                                    </button>
                                  )}
                                </>
                              )}

                              {report.status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateReportStatus(report.id, "resolved")
                                    }
                                    disabled={isUpdating}
                                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {isUpdating ? "更新中..." : "✓ 対応済みにする"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateReportStatus(report.id, "dismissed")
                                    }
                                    disabled={isUpdating}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    却下する
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 管理者BGM非表示モーダル */}

      {deletingBgm && isAdmin && (
        <div
          onClick={closeDeleteModal}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-red-500">
                  HIDE MUSIC
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  この音楽を非表示にしますか？
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
                className="text-2xl text-slate-400"
              >
                ×
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <img
                src={getImageUrl(deletingBgm, "600x300")}
                alt={deletingBgm.title}
                className="h-40 w-full object-cover"
              />

              <div className="p-4">
                <p className="font-bold">
                  {deletingBgm.title}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {deletingBgm.game_title}
                </p>

                {deletingBgm.composer && (
                  <p className="mt-1 text-xs text-slate-400">
                    {deletingBgm.composer}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-600">
              一般ユーザーの音楽検索一覧から非表示になります。
              データ自体は削除しないため、過去に公開されたMY 9では引き続き表示できます。
              管理者はいつでも再表示できます。
            </div>

            {deleteError && (
              <div className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={deleteBgm}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting
                  ? "非表示にしています..."
                  : "非表示にする"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 共有画像 */}

      {showShareModal &&
        generatedImage && (
          <div
            onClick={() =>
              setShowShareModal(
                false
              )
            }
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8"
          >
            <div
              onClick={(e) =>
                e.stopPropagation()
              }
              className="max-h-full w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6"
            >
              <h2 className="mb-5 text-2xl font-bold">
                9つの音楽が完成しました
              </h2>

              <img
                src={generatedImage}
                alt="私を彩る9つのゲーム音楽"
                className="mx-auto w-full max-w-[650px] rounded-2xl shadow-lg"
              />

              <button
                type="button"
                onClick={() => downloadShareImage()}
                className="mt-6 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white"
              >
                ↓ PNG画像を保存
              </button>
            </div>
          </div>
        )}

      <footer className="mx-auto w-full max-w-[1400px] px-4 pb-8 pt-6 text-center text-xs text-slate-400 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a
            href="/terms"
            className="transition hover:text-slate-600"
          >
            利用規約
          </a>
          <a
            href="/privacy"
            className="transition hover:text-slate-600"
          >
            プライバシーポリシー
          </a>
        </div>

        <p>
          Game data and images provided by{" "}
          <a
            href="https://rawg.io/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-slate-600"
          >
            RAWG
          </a>{" / "}<a href="https://www.igdb.com/" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">IGDB</a>
        </p>
      </footer>
    </main>
    </DndContext>
  );
}
