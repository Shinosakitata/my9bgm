"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
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
  normalized_title: string | null;
  is_hidden: boolean;
};

type RawgGame = {
  id: number;
  name: string;
  image: string | null;
  released: string | null;
};

type BgmSet = {
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
};

const STORAGE_KEY = "my9bgm-selected";

const ADMIN_USER_ID =
  process.env.NEXT_PUBLIC_ADMIN_USER_ID;

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

function SortableBgm({
  bgm,
  index,
  removeBgm,
  getImageUrl,
  readOnly = false,
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
      className={`flex h-[74px] items-center gap-3 rounded-2xl border bg-white px-3 shadow-sm ${
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
          className="flex h-10 w-7 cursor-grab touch-none items-center justify-center text-xl text-slate-300 hover:text-slate-600 active:cursor-grabbing"
          title="ドラッグして並べ替え"
        >
          ⋮⋮
        </button>
      )}

      <span className="w-6 text-center text-xl font-bold text-sky-500">
        {index + 1}
      </span>

      <img
        src={getImageUrl(bgm, "100x100")}
        alt={bgm.title}
        className="h-12 w-12 flex-none rounded-lg object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {bgm.title}
        </p>

        <p className="truncate text-xs text-slate-500">
          {bgm.game_title}
        </p>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => removeBgm(bgm.id)}
          className="flex h-9 w-9 items-center justify-center text-xl text-slate-400 transition hover:text-red-500"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const [bgms, setBgms] = useState<Bgm[]>([]);
  const [selected, setSelected] = useState<Bgm[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  const [publishing, setPublishing] =
    useState(false);

  const [publishError, setPublishError] =
    useState("");

  const [publishedUrl, setPublishedUrl] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  // =========================
  // 管理者認証
  // =========================

  const [authUser, setAuthUser] =
    useState<User | null>(null);

  const [showLoginModal, setShowLoginModal] =
    useState(false);

  const [loginEmail, setLoginEmail] =
    useState("");

  const [loginPassword, setLoginPassword] =
    useState("");

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginError, setLoginError] =
    useState("");

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

  // =========================
  // BGM追加
  // =========================

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

  const [newRawgGameId, setNewRawgGameId] =
    useState<number | null>(null);

  const [addMessage, setAddMessage] =
    useState("");

  const [gameResults, setGameResults] =
    useState<RawgGame[]>([]);

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
    useState<RawgGame[]>([]);

  const [editGameSearching, setEditGameSearching] =
    useState(false);

  const [editGameError, setEditGameError] =
    useState("");

  const [editSelectedGame, setEditSelectedGame] =
    useState<RawgGame | null>(null);

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

  useEffect(() => {
    if (isAdmin) {
      loadAdminReports();
    } else {
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

    if (
      session?.user &&
      session.user.id !== ADMIN_USER_ID
    ) {
      await supabase.auth.signOut();
      setAuthUser(null);
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

    const params =
      new URLSearchParams(
        window.location.search
      );

    const shareId =
      params.get("set");

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
        "共有セットの一部のBGMが見つかりませんでした。"
      );

      return false;
    }

    setSharedSet(bgmSet);
    setSelected(restored);
    setStorageLoaded(true);

    return true;
  }

  // =========================
  // 管理者ログイン
  // =========================

  async function handleAdminLogin(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoginError("");

    if (!ADMIN_USER_ID) {
      setLoginError(
        "管理者UIDが設定されていません。"
      );
      return;
    }

    if (
      !loginEmail.trim() ||
      !loginPassword
    ) {
      setLoginError(
        "メールアドレスとパスワードを入力してください。"
      );
      return;
    }

    setLoginLoading(true);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

    if (error) {
      console.error(
        "ログインエラー:",
        error
      );

      setLoginError(
        "メールアドレスまたはパスワードが違います。"
      );

      setLoginLoading(false);
      return;
    }

    if (
      !data.user ||
      data.user.id !== ADMIN_USER_ID
    ) {
      await supabase.auth.signOut();

      setAuthUser(null);

      setLoginError(
        "このアカウントには管理者権限がありません。"
      );

      setLoginLoading(false);
      return;
    }

    setAuthUser(data.user);

    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    setLoginLoading(false);
    setShowLoginModal(false);
  }

  async function handleAdminLogout() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "ログアウトエラー:",
        error
      );

      alert(
        "ログアウトに失敗しました。"
      );

      return;
    }

    setAuthUser(null);
    closeGameInfoEditor();
  }

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
  // RAWG検索
  // =========================

  async function fetchGames(
    query: string
  ): Promise<RawgGame[]> {
    const response = await fetch(
      `/api/games?q=${encodeURIComponent(
        query
      )}`
    );

    if (!response.ok) {
      throw new Error(
        "ゲーム検索に失敗しました"
      );
    }

    const data =
      await response.json();

    return data.results ?? [];
  }

  // =========================
  // 新規BGM用ゲーム検索
  // =========================

  useEffect(() => {
    if (!showAddForm) return;

    if (newRawgGameId !== null) {
      return;
    }

    const query =
      newGameTitle.trim();

    if (query.length < 2) {
      setGameResults([]);
      setGameSearchError("");
      return;
    }

    const timer =
      setTimeout(
        async () => {
          setGameSearching(true);
          setGameSearchError("");

          try {
            const results =
              await fetchGames(
                query
              );

            setGameResults(
              results
            );
          } catch (error) {
            console.error(error);

            setGameResults([]);

            setGameSearchError(
              "ゲーム検索に失敗しました。"
            );
          } finally {
            setGameSearching(false);
          }
        },
        500
      );

    return () =>
      clearTimeout(timer);
  }, [
    newGameTitle,
    newRawgGameId,
    showAddForm,
  ]);

  // =========================
  // 管理者編集用ゲーム検索
  // =========================

  useEffect(() => {
    if (!editingBgm) {
      return;
    }

    if (!isAdmin) {
      return;
    }

    if (editSelectedGame) {
      return;
    }

    const query =
      editGameQuery.trim();

    if (query.length < 2) {
      setEditGameResults([]);
      setEditGameError("");
      return;
    }

    const timer =
      setTimeout(
        async () => {
          setEditGameSearching(true);
          setEditGameError("");

          try {
            const results =
              await fetchGames(
                query
              );

            setEditGameResults(
              results
            );
          } catch (error) {
            console.error(error);

            setEditGameResults([]);

            setEditGameError(
              "ゲーム検索に失敗しました。"
            );
          } finally {
            setEditGameSearching(false);
          }
        },
        500
      );

    return () =>
      clearTimeout(timer);
  }, [
    editGameQuery,
    editSelectedGame,
    editingBgm,
    isAdmin,
  ]);

  // =========================
  // 一覧検索
  // =========================

  const filtered =
    bgms.filter((bgm) => {
      // 非表示BGMは一般ユーザーの検索一覧には出さない。
      // 管理者には表示し、再表示できるようにする。
      if (bgm.is_hidden && !isAdmin) {
        return false;
      }

      const q =
        search
          .trim()
          .toLowerCase();

      if (!q) return true;

      return (
        bgm.title
          .toLowerCase()
          .includes(q) ||
        bgm.game_title
          .toLowerCase()
          .includes(q) ||
        (bgm.composer
          ?.toLowerCase()
          .includes(q) ??
          false)
      );
    });

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
        "選べるBGMは9曲までです"
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
    setPublishedUrl("");
    setCopied(false);
    setShowPublishModal(true);
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
            bgm_ids: selected.map(
              (bgm) => bgm.id
            ),
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

      const url =
        `${window.location.origin}/?set=${result.share_id}`;

      setPublishedUrl(url);
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

  function returnToMyEditor() {
    window.location.href =
      window.location.origin +
      window.location.pathname;
  }

  // =========================
  // 新規BGM
  // =========================

  function selectGameForNewBgm(
    game: RawgGame
  ) {
    setNewGameTitle(
      game.name
    );

    setNewRawgGameId(
      game.id
    );

    setNewImageUrl(
      game.image
    );

    setGameResults([]);
    setGameSearchError("");
    setAddMessage("");
  }

  function clearSelectedGame() {
    setNewRawgGameId(null);
    setNewImageUrl(null);
    setGameResults([]);
    setAddMessage("");
  }

  function resetAddForm() {
    setNewTitle("");
    setNewGameTitle("");
    setNewComposer("");
    setNewImageUrl(null);
    setNewRawgGameId(null);
    setGameResults([]);
    setGameSearchError("");
    setAddMessage("");
  }

  function closeAddForm() {
    setShowAddForm(false);
    resetAddForm();
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
        "BGM名を入力してください。"
      );
      return;
    }

    if (newRawgGameId === null) {
      setAddMessage(
        "ゲーム名を入力したあと、検索結果からゲームを選択してください。"
      );
      return;
    }

    const normalizedTitle =
      normalizeBgmTitle(title);

    if (!normalizedTitle) {
      setAddMessage(
        "BGM名を正しく入力してください。"
      );
      return;
    }

    const duplicate =
      bgms.find(
        (bgm) =>
          bgm.rawg_game_id ===
            newRawgGameId &&
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
            rawg_game_id: newRawgGameId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setAddMessage(
          typeof result?.error === "string"
            ? result.error
            : "BGMの追加に失敗しました。"
        );
        return;
      }

      const addedBgm = result?.bgm as
        | Bgm
        | undefined;

      if (!addedBgm) {
        setAddMessage(
          "BGMの追加結果を取得できませんでした。"
        );
        return;
      }

      setBgms((current) => [
        ...current,
        addedBgm,
      ]);

      setAddMessage(
        "BGMを追加しました！"
      );

      setTimeout(() => {
        closeAddForm();
      }, 800);
    } catch (error) {
      console.error(
        "BGM追加APIエラー:",
        error
      );

      setAddMessage(
        "BGMの追加に失敗しました。通信状態を確認してください。"
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
    game: RawgGame
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
    if (
      !editingBgm ||
      !editSelectedGame ||
      !isAdmin
    ) {
      return;
    }

    setSavingGameInfo(true);
    setEditSaveError("");

    const normalizedTitle =
      normalizeBgmTitle(
        editingBgm.title
      );

    const nextImageUrl =
      editSelectedGame.image ??
      editingBgm.image_url;

    const { data, error } =
      await supabase
        .from("bgms")
        .update({
          game_title:
            editSelectedGame.name,
          rawg_game_id:
            editSelectedGame.id,
          normalized_title:
            normalizedTitle,
          image_url:
            nextImageUrl,
        })
        .eq(
          "id",
          editingBgm.id
        )
        .select()
        .single();

    if (error) {
      console.error(
        "ゲーム情報更新エラー:",
        error
      );

      if (
        error.code === "23505"
      ) {
        setEditSaveError(
          "同じゲームに同じBGMがすでに登録されています。重複しているBGMを確認してください。"
        );
      } else {
        setEditSaveError(
          "ゲーム情報の保存に失敗しました。"
        );
      }

      setSavingGameInfo(false);
      return;
    }

    const updatedBgm =
      data as Bgm;

    setBgms((current) =>
      current.map((bgm) =>
        bgm.id ===
        updatedBgm.id
          ? updatedBgm
          : bgm
      )
    );

    setSelected((current) =>
      current.map((bgm) =>
        bgm.id ===
        updatedBgm.id
          ? updatedBgm
          : bgm
      )
    );

    setSavingGameInfo(false);
    closeGameInfoEditor();
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
      wrong_title: "BGM名が間違っている",
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
        "対象BGMが見つかりません。"
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
        "対象BGMが見つかりません。"
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
      alert("BGMの再表示に失敗しました。");
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

  async function generateShareImage() {
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

        if (bgm.image_url) {
          try {
            const proxyUrl =
              `/api/image-proxy?url=${encodeURIComponent(
                bgm.image_url
              )}`;

            const image =
              await loadCanvasImage(
                proxyUrl
              );

            drawImageCover(
              ctx,
              image,
              x,
              y,
              tileSize,
              tileSize
            );
          } catch (error) {
            console.error(
              "画像描画失敗:",
              error
            );

            ctx.fillStyle =
              "#334155";

            ctx.fillRect(
              x,
              y,
              tileSize,
              tileSize
            );
          }
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

        ctx.fillStyle =
          "rgba(255,255,255,0.95)";

        ctx.beginPath();

        ctx.arc(
          x + 58,
          y + 58,
          35,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
          "#0f172a";

        ctx.font =
          "bold 32px sans-serif";

        ctx.textAlign =
          "center";

        ctx.textBaseline =
          "middle";

        ctx.fillText(
          String(index + 1),
          x + 58,
          y + 59
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
        "MY 9 BGM",
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

      setShowShareModal(
        true
      );
    } catch (error) {
      console.error(
        "画像生成エラー:",
        error
      );

      alert(
        "画像の生成に失敗しました。"
      );
    } finally {
      setGeneratingImage(
        false
      );
    }
  }

  function downloadShareImage() {
    if (!generatedImage) {
      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href =
      generatedImage;

    link.download =
      "my9bgm.png";

    link.click();
  }

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-10">
            <button
              type="button"
              onClick={returnToMyEditor}
              className="whitespace-nowrap font-bold tracking-[0.2em]"
            >
              🎧 MY 9 BGM
            </button>

            <nav className="hidden gap-7 text-sm font-semibold md:flex">
              <button
                type="button"
                onClick={returnToMyEditor}
                className={`py-5 ${
                  !isViewingSharedSet
                    ? "border-b-2 border-sky-500 text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Editor
              </button>

              <a
                href="/community"
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                みんなの9つのBGM
              </a>

              <button
                type="button"
                onClick={() =>
                  setShowAddForm(true)
                }
                className="py-5 text-slate-500 hover:text-slate-900"
              >
                BGMを追加
              </button>

              <span className="cursor-pointer py-5 text-slate-500 hover:text-slate-900">
                このサイトについて
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <>
                <div className="hidden text-right md:block">
                  <p className="text-xs font-bold text-emerald-600">
                    ADMIN
                  </p>

                  <p className="max-w-[200px] truncate text-xs text-slate-400">
                    {authUser?.email}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openReportManager}
                  className="relative rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                >
                  ⚠ 通報管理
                  {adminReports.filter((report) => report.status === "pending").length > 0 && (
                    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {adminReports.filter((report) => report.status === "pending").length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={
                    handleAdminLogout
                  }
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoginError("");
                  setShowLoginModal(
                    true
                  );
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                管理者ログイン
              </button>
            )}
          </div>
        </div>
      </header>

      {isAdmin && (
        <div className="border-b border-emerald-200 bg-emerald-50">
          <div className="mx-auto max-w-[1400px] px-6 py-2 text-center text-xs font-semibold text-emerald-700">
            管理者モードでログイン中です。BGM編集・非表示・再表示・通報管理を利用できます。
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
                  "共有された9つのBGM"}
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

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="mb-9">
          <p className="mb-2 text-sm font-bold tracking-[0.25em] text-sky-500">
            MY 9 GAME BGM
          </p>

          <h1 className="text-4xl font-bold">
            {isViewingSharedSet
              ? sharedSet.title ||
                "共有された9つのゲームBGM"
              : "私を構成する9つのゲームBGM"}
          </h1>

          <p className="mt-3 text-slate-500">
            {isViewingSharedSet
              ? "誰かが選んだ、忘れられない9つのゲームBGM。"
              : "ゲームの中で出会った、忘れられない9つの音を選ぼう。"}
          </p>
        </div>

        {sharedSetError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {sharedSetError}
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_520px]">
          <section>
            <input
              type="text"
              placeholder="BGM名・ゲーム名・作曲者で検索..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="mb-6 h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-5 shadow-sm outline-none focus:border-sky-400"
            />

            {loading ? (
              <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
                BGMを読み込んでいます...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center">
                BGMが見つかりませんでした
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {filtered.map(
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
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="relative aspect-square">
                          <img
                            src={getImageUrl(
                              bgm,
                              "600x600"
                            )}
                            alt={bgm.title}
                            className="h-full w-full object-cover"
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

                        <div className="p-4">
                          <p className="truncate font-bold">
                            {bgm.title}
                          </p>

                          <p className="mt-1 truncate text-sm text-slate-500">
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
                            className="mt-3 text-xs font-semibold text-slate-400 transition hover:text-amber-600"
                          >
                            ⚠ このBGMを通報
                          </button>

                          {isAdmin && (
                            <>
                              <div className="mt-3">
                                {bgm.rawg_game_id ? (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                    <span>
                                      ✓
                                    </span>
                                    <span>
                                      RAWG連携済み
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                                    <span>
                                      ⚠
                                    </span>
                                    <span>
                                      RAWG未設定
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
                                  bgm.rawg_game_id
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                {bgm.rawg_game_id
                                  ? "🛠 ゲーム情報・画像を変更"
                                  : "🛠 ゲーム情報を設定"}
                              </button>

                              {bgm.is_hidden ? (
                                <>
                                  <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-500">
                                    🙈 現在このBGMは非表示です
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => restoreBgm(bgm)}
                                    className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                  >
                                    👁 このBGMを再表示
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
                                  🙈 このBGMを非表示
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {!isViewingSharedSet && (
              <div className="mt-8 rounded-2xl border border-sky-100 bg-sky-50 p-6">
                <p className="font-bold">
                  探しているBGMが見つかりませんか？
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  みんなでBGMデータベースを育てていきます。
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddForm(
                      true
                    )
                  }
                  className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-sm"
                >
                  ＋ 新しいBGMを追加
                </button>
              </div>
            )}
          </section>

          <section>
            <div className="sticky top-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold tracking-[0.18em]">
                  SELECTED BGM ·{" "}
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

              <DndContext
                sensors={sensors}
                collisionDetection={
                  closestCenter
                }
                onDragEnd={
                  handleDragEnd
                }
              >
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
                            className="flex h-[74px] items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5"
                          >
                            <span className="text-xl font-bold text-slate-300">
                              {index + 1}
                            </span>

                            <span className="ml-5 text-sm text-slate-400">
                              BGMを選択
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={
                  generateShareImage
                }
                disabled={
                  selected.length !== 9 ||
                  generatingImage
                }
                className="mt-5 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {generatingImage
                  ? "画像を作成しています..."
                  : "9つのBGM画像を作成"}
              </button>

              {!isViewingSharedSet && (
                <button
                  type="button"
                  onClick={
                    openPublishModal
                  }
                  disabled={
                    selected.length !== 9
                  }
                  className="mt-3 w-full rounded-2xl bg-sky-500 py-4 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  🌐 みんなに公開する
                </button>
              )}

              {isViewingSharedSet && (
                <button
                  type="button"
                  onClick={
                    returnToMyEditor
                  }
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-4 font-bold text-slate-700 hover:bg-slate-50"
                >
                  自分の9曲を作る
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

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
                  9つのBGMを公開
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
                  placeholder="例：私を構成する9つのBGM"
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

                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block w-full rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  共有ページを開いて確認 →
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* 管理者ログイン */}

      {showLoginModal && (
        <div
          onClick={() =>
            setShowLoginModal(
              false
            )
          }
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
          >
            <h2 className="mb-5 text-2xl font-bold">
              管理者ログイン
            </h2>

            <form
              onSubmit={
                handleAdminLogin
              }
            >
              <input
                type="email"
                value={loginEmail}
                onChange={(e) =>
                  setLoginEmail(
                    e.target.value
                  )
                }
                placeholder="メールアドレス"
                className="mb-4 w-full rounded-xl border px-4 py-3"
              />

              <input
                type="password"
                value={loginPassword}
                onChange={(e) =>
                  setLoginPassword(
                    e.target.value
                  )
                }
                placeholder="パスワード"
                className="w-full rounded-xl border px-4 py-3"
              />

              {loginError && (
                <p className="mt-4 text-sm text-red-500">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  loginLoading
                }
                className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white"
              >
                {loginLoading
                  ? "ログイン中..."
                  : "ログイン"}
              </button>
            </form>
          </div>
        </div>
      )}

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
                  ADD BGM
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  新しいBGMを追加
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
                BGM名
              </label>

              <input
                value={newTitle}
                onChange={(e) =>
                  setNewTitle(
                    e.target.value
                  )
                }
                className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="例：星に駆られて"
                maxLength={150}
              />

              <label className="mb-2 block text-sm font-semibold">
                ゲーム
              </label>

              {newRawgGameId === null ? (
                <>
                  <input
                    value={newGameTitle}
                    onChange={(e) => {
                      setNewGameTitle(
                        e.target.value
                      );

                      setNewRawgGameId(
                        null
                      );

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
                              selectGameForNewBgm(
                                game
                              )
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
                              <p className="truncate font-semibold">
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
                        RAWG ID:{" "}
                        {
                          newRawgGameId
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
                placeholder="例：牧野忠義"
                maxLength={150}
              />

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
                  adding ||
                  newRawgGameId ===
                    null
                }
                className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {adding
                  ? "追加しています..."
                  : newRawgGameId ===
                      null
                    ? "ゲームを選択してください"
                    : "BGMを追加"}
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
                    BGM：
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
                  RAWG ID：
                  <span
                    className={
                      editingBgm.rawg_game_id
                        ? "font-semibold text-emerald-600"
                        : "font-semibold text-amber-600"
                    }
                  >
                    {editingBgm.rawg_game_id ??
                      "未設定"}
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
                    RAWGでゲームを検索
                  </label>

                  <input
                    value={
                      editGameQuery
                    }
                    onChange={(e) =>
                      setEditGameQuery(
                        e.target.value
                      )
                    }
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
                              <p className="truncate font-semibold">
                                {
                                  game.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                RAWG ID:{" "}
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
                        RAWG ID:{" "}
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
                      game_title / rawg_game_id / normalized_title / image_url
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
                  REPORT BGM
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  BGMを通報
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
                  <option value="wrong_title">BGM名が間違っている</option>
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
                  placeholder="例：同じゲーム・同じBGMが別名で登録されています。"
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
                  未対応の通報を確認し、BGMの修正・非表示や対応状況の変更ができます。
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
                                  {getReportReasonLabel(report.reason)}
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
                                {targetBgm ? (
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
                                    対象BGMが見つかりません (BGM ID: {report.bgm_id})
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                                {report.detail || "詳細コメントなし"}
                              </div>
                            </div>

                            <div className="flex min-w-[190px] flex-col gap-2">
                              {targetBgm && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openReportedBgmEditor(report)}
                                    disabled={isUpdating}
                                    className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                                  >
                                    🛠 BGM情報を確認・編集
                                  </button>

                                  {targetBgm.is_hidden ? (
                                    <button
                                      type="button"
                                      onClick={() => restoreBgm(targetBgm)}
                                      disabled={isUpdating}
                                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                    >
                                      👁 BGMを再表示
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
                  HIDE BGM
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  このBGMを非表示にしますか？
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
              一般ユーザーのBGM検索一覧から非表示になります。
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
                9つのBGMが完成しました
              </h2>

              <img
                src={generatedImage}
                alt="私を構成する9つのゲームBGM"
                className="mx-auto w-full max-w-[650px] rounded-2xl shadow-lg"
              />

              <button
                type="button"
                onClick={
                  downloadShareImage
                }
                className="mt-6 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white"
              >
                ↓ PNG画像を保存
              </button>
            </div>
          </div>
        )}

      <footer className="mx-auto max-w-[1400px] px-6 pb-8 pt-6 text-center text-xs text-slate-400">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a
            href="/terms"
            className="underline underline-offset-4 hover:text-slate-600"
          >
            利用規約
          </a>
          <a
            href="/privacy"
            className="underline underline-offset-4 hover:text-slate-600"
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
          </a>
        </p>
      </footer>
    </main>
  );
}