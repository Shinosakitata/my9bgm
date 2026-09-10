export const metadata = {
  title: "このサイトについて",
  description: "My 9 BGMについての紹介ページです。",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <a
          href="/"
          className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
        >
          ← My 9 BGMに戻る
        </a>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-8 sm:px-10 sm:py-10">
            <p className="text-xs font-bold tracking-[0.25em] text-sky-500">
              ABOUT MY 9 BGM
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              あなたを構成する、
              <br className="sm:hidden" />
              9つのゲームBGM。
            </h1>

            <p className="mt-5 leading-7 text-slate-600">
              My 9 BGMは、これまで遊んできたゲームの中から
              「自分を構成する9曲」を選び、3×3のMY 9として共有できるサービスです。
            </p>
          </div>

          <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
            <section>
              <h2 className="text-xl font-bold">My 9 BGMでできること</h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-2xl">🎧</p>
                  <h3 className="mt-3 font-bold">9曲を選ぶ</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    登録されているゲームBGMから、自分の好きな9曲を選べます。
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-2xl">🖼️</p>
                  <h3 className="mt-3 font-bold">画像にする</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    選んだ9曲を3×3の画像にして、SNSなどで共有できます。
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-2xl">🌐</p>
                  <h3 className="mt-3 font-bold">みんなに公開</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    自分のMY 9を公開し、他の人が選んだ9曲も見ることができます。
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold">聴きたいBGMが見つからないとき</h2>
              <p className="mt-3 leading-7 text-slate-600">
                My 9 BGMのデータベースは、ユーザーからのBGM追加によって少しずつ増えていきます。
                探している曲がまだ登録されていない場合は、上部メニューの
                「BGMを追加」から登録できます。
              </p>

              <div className="mt-5">
                <a
                  href="/"
                  className="inline-flex rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-600"
                >
                  EditorでBGMを探す
                </a>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold">投稿データについて</h2>
              <p className="mt-3 leading-7 text-slate-600">
                ユーザーが追加したBGMには、表記揺れ、重複、誤情報などが含まれる可能性があります。
                問題のある情報を見つけた場合は、各BGMの通報機能から知らせることができます。
                運営側で確認し、必要に応じて修正または非表示にします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">ゲーム情報・画像について</h2>
              <p className="mt-3 leading-7 text-slate-600">
                ゲーム情報や画像の一部にはRAWGが提供するデータを利用しています。
                各ゲーム、楽曲、画像その他の権利は、それぞれの権利者に帰属します。
              </p>
            </section>

            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-7 text-sm text-slate-500">
              <a href="/terms" className="hover:text-slate-900">
                利用規約
              </a>
              <a href="/privacy" className="hover:text-slate-900">
                プライバシーポリシー
              </a>
              <a href="/community" className="hover:text-slate-900">
                みんなの9つのBGM
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
