export const metadata = {
  title: "利用規約",
  description: "My9GameMusicの利用規約です。",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Link
          href="/"
          className="text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          ← My9GameMusicに戻る
        </Link>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold tracking-[0.2em] text-sky-500">
            TERMS OF SERVICE
          </p>
          <h1 className="mt-2 text-3xl font-bold">利用規約</h1>
          <p className="mt-3 text-sm text-slate-500">最終更新日：2026年9月10日</p>

          <div className="mt-10 space-y-9 leading-7">
            <section>
              <h2 className="text-xl font-bold">1. はじめに</h2>
              <p className="mt-3">
                本利用規約（以下「本規約」）は、My9GameMusic（以下「本サービス」）の利用条件を定めるものです。
                本サービスを利用する方（以下「ユーザー」）は、本規約に同意したうえで本サービスを利用するものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">2. 本サービスについて</h2>
              <p className="mt-3">
                本サービスは、好きなゲーム音楽を選択して「MY 9」を作成・共有したり、
                音楽情報を投稿したりできるサービスです。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">3. 音楽情報の投稿</h2>
              <p className="mt-3">
                ユーザーは、本サービス上で不足している音楽情報を投稿できます。
                投稿にあたっては、できる限り正確な曲名・ゲーム名その他の情報を入力してください。
              </p>
              <p className="mt-3">
                投稿された情報は、他のユーザーが利用できるデータとして本サービス上に表示される場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">4. 禁止事項</h2>
              <p className="mt-3">ユーザーは、以下の行為を行ってはなりません。</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>虚偽または明らかに不正確な情報を故意に投稿する行為</li>
                <li>同一または実質的に同一の情報を大量に投稿する行為</li>
                <li>荒らし、スパム、自動化された大量アクセスその他サービス運営を妨害する行為</li>
                <li>第三者の著作権、商標権、プライバシーその他の権利を侵害する行為</li>
                <li>法令または公序良俗に反する内容を投稿する行為</li>
                <li>本サービスのシステムやセキュリティを不正に解析、攻撃または回避しようとする行為</li>
                <li>その他、運営者が不適切と判断する行為</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold">5. 投稿内容の修正・非表示</h2>
              <p className="mt-3">
                運営者は、重複、誤情報、不適切な内容、権利侵害のおそれがある内容などを確認した場合、
                事前の通知なく投稿内容を修正または非表示にできるものとします。
              </p>
              <p className="mt-3">
                ユーザーは、本サービスの通報機能を利用して問題のある音楽情報を運営者へ知らせることができます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">6. 知的財産権</h2>
              <p className="mt-3">
                ゲーム名、楽曲名、ゲーム画像その他第三者に帰属するコンテンツの権利は、
                それぞれの権利者に帰属します。本サービスは、それらの権利を取得または主張するものではありません。
              </p>
              <p className="mt-3">
                本サービス独自のプログラム、デザイン、文章その他のコンテンツに関する権利は、
                運営者または正当な権利者に帰属します。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">7. 外部サービス</h2>
              <p className="mt-3">
                本サービスでは、ゲーム情報や画像の取得などのために第三者が提供する外部サービスを利用する場合があります。
                外部サービスの利用条件や提供状況は、それぞれの提供者が定める条件に従います。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">8. サービスの変更・停止</h2>
              <p className="mt-3">
                運営者は、保守、障害、外部サービスの変更その他の事情により、
                本サービスの全部または一部を予告なく変更、中断または終了する場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">9. 免責事項</h2>
              <p className="mt-3">
                運営者は、本サービス上の情報について、その正確性、完全性、最新性、
                特定目的への適合性を保証するものではありません。
              </p>
              <p className="mt-3">
                本サービスの利用、利用不能、データの消失、外部サービスの障害その他本サービスに関連して生じた損害について、
                運営者の故意または重過失による場合など法令上免責が認められない場合を除き、
                運営者は責任を負わないものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">10. 本規約の変更</h2>
              <p className="mt-3">
                運営者は、必要に応じて本規約を変更することがあります。
                重要な変更を行う場合は、本サービス上で分かりやすい方法により周知するよう努めます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">11. 準拠法・管轄</h2>
              <p className="mt-3">
                本規約は日本法に準拠します。本サービスに関して紛争が生じた場合は、
                法令により別段の定めがある場合を除き、運営者の所在地を管轄する日本の裁判所を
                第一審の専属的合意管轄裁判所とします。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
import Link from "next/link";
