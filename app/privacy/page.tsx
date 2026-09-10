export const metadata = {
  title: "プライバシーポリシー",
  description: "My9GameMusicのプライバシーポリシーです。",
};

export default function PrivacyPage() {
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
            PRIVACY POLICY
          </p>
          <h1 className="mt-2 text-3xl font-bold">プライバシーポリシー</h1>
          <p className="mt-3 text-sm text-slate-500">最終更新日：2026年9月10日</p>

          <div className="mt-10 space-y-9 leading-7">
            <section>
              <h2 className="text-xl font-bold">1. 基本方針</h2>
              <p className="mt-3">
                My9GameMusic（以下「本サービス」）では、サービスの提供、維持、
                セキュリティ確保および改善のために必要な範囲で情報を取り扱います。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">2. 取得する可能性のある情報</h2>
              <p className="mt-3">
                本サービスでは、利用状況に応じて以下の情報を取得または処理する場合があります。
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>ユーザーが投稿した音楽名、ゲーム名その他の投稿情報</li>
                <li>ユーザーが作成・公開したMY 9に関する情報</li>
                <li>MY 9公開時に入力した作成者名</li>
                <li>通報理由および通報時に入力された内容</li>
                <li>アクセス日時、リクエスト情報その他サービス運用に必要な技術情報</li>
                <li>不正利用防止やアクセス制限のために処理されるIPアドレス</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold">3. IPアドレスを利用したアクセス制限</h2>
              <p className="mt-3">
                本サービスでは、スパムや大量投稿などの不正利用を防止するため、
                IPアドレスを利用して一定時間内のアクセス回数を制限する場合があります。
              </p>
              <p className="mt-3">
                この目的で保存する識別値については、IPアドレスそのものではなく、
                秘密情報を用いたハッシュ処理を行った値を使用するよう設計しています。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">4. 情報の利用目的</h2>
              <p className="mt-3">取得・処理した情報は、主に以下の目的で利用します。</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>本サービスの提供および機能の実現</li>
                <li>投稿内容や通報内容の確認・管理</li>
                <li>荒らし、スパム、不正アクセスなどの防止</li>
                <li>障害調査、セキュリティ確保およびサービス改善</li>
                <li>法令上必要な対応</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold">5. ブラウザに保存される情報</h2>
              <p className="mt-3">
                本サービスでは、選択中の音楽などの状態を保持するため、
                ブラウザのローカルストレージ等を利用する場合があります。
                これらの情報は、ブラウザの設定やデータ削除操作によって削除できる場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">6. 外部サービスの利用</h2>
              <p className="mt-3">
                本サービスでは、データ保存、ホスティング、ゲーム情報・画像の取得などのために、
                Supabase、Vercel、RAWG、IGDB等の第三者サービスを利用しています。
                これらのサービスにおける情報の取扱いについては、
                各サービス提供者のプライバシーポリシー等が適用される場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">7. 第三者提供</h2>
              <p className="mt-3">
                運営者は、法令に基づく場合、本サービスの提供に必要な外部サービスを利用する場合、
                その他法令上認められる場合を除き、取得した個人情報を本人の同意なく第三者へ提供しません。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">8. 情報の安全管理</h2>
              <p className="mt-3">
                運営者は、本サービスで取り扱う情報について、
                不正アクセス、漏えい、改ざん等を防止するために合理的な安全管理措置を講じるよう努めます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">9. 保存期間</h2>
              <p className="mt-3">
                本サービスでは、サービス提供、セキュリティ確保、通報対応その他の利用目的に必要な期間、
                情報を保存する場合があります。不要となった情報については、
                法令上保存が必要な場合を除き、適切な時期に削除または整理するよう努めます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">10. 本ポリシーの変更</h2>
              <p className="mt-3">
                本ポリシーは、サービス内容や利用する外部サービスの変更などに応じて改定することがあります。
                重要な変更を行う場合は、本サービス上で分かりやすい方法により周知するよう努めます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">11. お問い合わせ</h2>
              <p className="mt-3">
                本サービスのプライバシーに関するお問い合わせ方法については、
                運営者が本サービス上で別途案内する方法をご利用ください。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
import Link from "next/link";
