# 有名ゲーム音楽候補の再監査

既存の「追加候補500曲.csv」を母集団とし、ユーザー要望で不足が判明した NieR Replicant の「魔王」を加えた501件を、2026-09-13時点の本番SupabaseへREAD ONLYで照合した結果です。

- `additional_candidates.csv`: 全501候補と現在の分類
- `existing_duplicates.csv`: 既存BGMまたは確定済み同一曲
- `needs_review.csv`: 初回監査で版・音源・公式曲名などに人間確認が残った159候補
- `confirmed_duplicates.csv`: 159候補の再監査で既存BGMとの同一性をhighで確定した候補
- `import_ready.csv`: 159候補の再監査で公式情報・原作IGDB IDをhighで確定した未登録候補
- `still_needs_review.csv`: 再監査後も三条件を同時に確定できなかった候補
- `new_games.csv`: import_readyのうち新規logical gameが必要な候補
- `summary.json`: 件数、DBスナップショット件数、安全確認結果

重複判定は `logical game + normalized_title` を基本とし、公式に対応が確認済みの日本語名・英語名も同一タイトルとして扱います。同名曲でもゲームが異なる場合は重複にしません。

159件の再監査結果は、既存重複0件、追加可能high 43件、未解決116件です。追加可能43件はApple Music日本向け公式配信またはメーカー公式OSTで曲名を確認し、IGDBで原作・リメイク・拡張の区分を照合しています。

初回追加候補の「魔王」はSQUARE ENIX MUSICの国内公式『ニーア ゲシュタルト ＆ レプリカント オリジナル・サウンドトラック』Disc 2 track 15で確認しました。英題 `Shadowlord` も同一曲として重複検査対象に含めています。今回再生成した `import_ready.csv` は、初回の159件だけを対象としています。
