"use client";

import { useEffect, useId, useState } from "react";

const CATEGORIES = ["検索", "音楽の追加", "9曲の選択", "画像生成", "公開・共有", "表示崩れ", "曲名・ゲーム情報の誤り", "その他"];
const MAX_MESSAGE_LENGTH = 2000;

export function BugReportButton({ className }: { className?: string }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, sending]);

  function openModal() {
    setError("");
    setSuccess(false);
    setOpen(true);
  }

  function closeModal() {
    if (sending) return;
    setOpen(false);
    setCategory("");
    setMessage("");
    setError("");
    setSuccess(false);
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: "site_bug",
          category: category || null,
          message: content,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "不具合報告を送信できませんでした。");
      setCategory("");
      setMessage("");
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "不具合報告を送信できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openModal} className={className}>不具合報告</button>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 px-4 py-6" onMouseDown={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={event => event.stopPropagation()}
            className="max-h-full w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-white p-6 text-left text-slate-900 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-sky-500">BUG REPORT</p>
                <h2 id={titleId} className="mt-1 text-2xl font-bold">不具合を報告</h2>
              </div>
              <button type="button" onClick={closeModal} disabled={sending} aria-label="不具合報告を閉じる" className="text-2xl text-slate-400 hover:text-slate-700 disabled:opacity-40">×</button>
            </div>

            {success ? (
              <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
                <p className="font-bold">✓ ご報告ありがとうございます。</p>
                <p className="mt-2 text-sm">内容を確認させていただきます。</p>
                <button type="button" onClick={closeModal} className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-700">閉じる</button>
              </div>
            ) : (
              <form onSubmit={submitReport} className="mt-6">
                <label className="block text-sm font-semibold">
                  不具合の種類 <span className="font-normal text-slate-400">任意</span>
                  <select autoFocus value={category} onChange={event => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-400">
                    <option value="">選択してください</option>
                    {CATEGORIES.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="mt-5 block text-sm font-semibold">
                  不具合内容 <span className="text-red-500">*</span>
                  <textarea
                    required
                    rows={7}
                    maxLength={MAX_MESSAGE_LENGTH}
                    value={message}
                    onChange={event => { setMessage(event.target.value); setError(""); }}
                    placeholder="どのような操作をしたときに、どのような問題が発生したか教えてください"
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
                  />
                </label>
                <div className="mt-1 flex items-start justify-between gap-4 text-xs text-slate-400">
                  <p>現在のページ情報とブラウザ情報は自動で送信されます。</p>
                  <p className="flex-none">{message.length} / {MAX_MESSAGE_LENGTH}</p>
                </div>

                {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={closeModal} disabled={sending} className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">キャンセル</button>
                  <button type="submit" disabled={sending || !message.trim()} className="flex-1 rounded-xl bg-sky-500 py-3 font-bold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40">{sending ? "送信中..." : "送信する"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
