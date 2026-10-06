# 素材の出典・ライセンス

## 画像

- 動画内の画像（料理・器・電子レンジ・炊飯器の内なべ・手順図・背景・枠）は、すべて [`illustrations.js`](illustrations.js) と [`frame.html`](frame.html) のコードで描いたもの。写真・他者のイラスト・フリー素材は使っていない。
- 実在の商品パッケージやロゴは描いていない。缶・ボトル・袋の文字は一般名（「冷凍うどん」「サバ水煮」「ツナ」「めんつゆ」）のみ。

## フォント

| 項目 | 内容 |
|---|---|
| 書体 | M PLUS Rounded 1c（ExtraBold／Black） |
| 著作権 | Copyright 2016 The Rounded M+ Project Authors. |
| ライセンス | SIL Open Font License 1.1（[`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)） |
| 取得元 | https://github.com/google/fonts/tree/main/ofl/mplusrounded1c（`fetch_assets.sh` で取得） |

## 音声

| 項目 | 内容 |
|---|---|
| 合成エンジン | Open JTalk 1.11（Ubuntu パッケージ `open-jtalk` 1.11-5）— Copyright 2008-2013 Nagoya Institute of Technology — BSD-3-Clause |
| 辞書 | `open-jtalk-mecab-naist-jdic` 1.11-5 — Copyright 2009 Nara Institute of Science and Technology, 2008-2013 Nagoya Institute of Technology — BSD-3-Clause |
| 声（音響モデル） | HTS voice "Mei"（`mei_normal.htsvoice`、MMDAgent_Example-1.8 収録）— Copyright (c) 2009-2018 Nagoya Institute of Technology, Department of Computer Science — **CC BY 3.0（表示が必要）**（[`assets/voice/mei_COPYRIGHT.txt`](assets/voice/mei_COPYRIGHT.txt)） |
| 取得元 | https://sourceforge.net/projects/mmdagent/files/MMDAgent_Example/MMDAgent_Example-1.8/（`fetch_assets.sh` で取得） |
| 加工 | 抑揚を平らに（GV 重み 0.55）、話速 1.12（名前の行は 1.0）、+1 半音、帯域を 8kHz までに制限、一定ゲイン＋リミッターで -16 LUFS |

### 「ゆっくり音声」について

- 一般に「ゆっくりボイス」と呼ばれる声は、株式会社アクエストの音声合成エンジン AquesTalk（ライセンス製品）によるもの。この制作環境には無く、利用ライセンスも確認できないため使っていない。
- 代わりに上の Open JTalk＋Mei で、ゆっくり系の雰囲気（平らな抑揚・合成音らしい質感・速めの話速）に寄せた **「ゆっくり風」の声** にした。
- AquesTalk などのライセンスがあれば、1行ずつ書き出した録音に差し替えられる（README の「本物のゆっくりボイス等に差し替える」）。字幕と画像の切り替えは新しい声の長さに合わせて自動で付け直される。

## BGM・効果音

- 使っていない。

## 料理の作り方の確認（公式情報）

SKILL.md の「機能と使い方は公式ヘルプで確かめる」は Google 製品向けの手順なので、料理ではメーカーの公式レシピ・商品情報・FAQ で確かめた。

**確認方法**：公式ページはこの制作環境のネットワーク制限（HTTP 403）で直接開けなかったため、公式ドメインに限定した Web 検索で、検索エンジンが取得した公式ページの記載を確認した。**公開前に下の各ページを直接開いて最終確認することを推奨**。

| 料理 | 確認したこと | 出典 |
|---|---|---|
| レンジで釜玉うどん | レンジで加熱した冷凍うどんを器に盛り、卵を割り入れ、だししょうゆ等をかける（公式レシピ名は「釜玉風うどん」） | [テーブルマーク公式レシピ「釜玉風うどん」](https://www.tablemark.co.jp/recipe/udon/detail/0012.html) |
| 〃 | 釜玉風のかけだれにめんつゆを使う公式レシピがある | [テーブルマーク公式レシピ「たっぷりチーズの釜玉風うどん」](https://www.tablemark.co.jp/recipe/udon/detail/0627.html) |
| 〃 | 冷凍うどんは電子レンジ調理ができる（加熱時間は商品ごと） | [テーブルマーク公式 商品情報「カトキチさぬきうどん５食」](https://www.tablemark.co.jp/products/frozen/udon/detail/7117344.html) |
| 炊き込みサバ缶ごはん | 水と調味料を合わせて「白米」の水位目盛に合わせ、なべ底からよく混ぜる／具は米の上に平らにのせて混ぜない／具の量は米の重さの30〜50%／メニューは「炊きこみ」 | [象印公式FAQ「炊きこみ等（炊飯ジャー）」](https://faqchat.zojirushi.co.jp/inquiries/8b68412496cb276d39e7?q=%E7%82%8A%E3%81%8D%E3%81%93%E3%81%BF%E7%AD%89%EF%BC%88%E7%82%8A%E9%A3%AF%E3%82%B8%E3%83%A3%E3%83%BC%EF%BC%89&select_id=ced51f824ff9&select_sid=2195886) |
| 〃 | 「炊きこみ」はタイマー予約できない（時間が経つと具が傷む恐れ・調味料が沈殿するため） | [象印公式FAQ「予約・タイマー（炊飯ジャー）」](https://faqchat.zojirushi.co.jp/inquiries/8b68412496cb276d39e7?q=%E4%BA%88%E7%B4%84%E3%83%BB%E3%82%BF%E3%82%A4%E3%83%9E%E3%83%BC%EF%BC%88%E7%82%8A%E9%A3%AF%E3%82%B8%E3%83%A3%E3%83%BC%EF%BC%89&select_id=3906bb25720c&select_sid=2195902) |
| 〃 | 無洗米は研がずに、無洗米用カップで量って水を入れて炊ける | [象印公式FAQ「炊飯ジャーで無洗米の炊き方を教えてください」](https://faqchat.zojirushi.co.jp/inquiries/8b68412496cb276d39e7?q=%E7%82%8A%E9%A3%AF%E3%82%B8%E3%83%A3%E3%83%BC%E3%81%A7%E7%84%A1%E6%B4%97%E7%B1%B3%E3%81%AE%E7%82%8A%E3%81%8D%E6%96%B9%E3%82%92%E6%95%99%E3%81%88%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82%EF%BC%88%E3%81%8A%E7%B1%B3%E9%81%B8%E6%8A%9E%E3%80%81%E7%84%A1%E6%B4%97%E7%B1%B3%E3%80%81%E7%84%A1%E6%B4%97%E7%B1%B3%E3%81%AE%E3%83%A1%E3%83%8B%E3%83%A5%E3%83%BC%E3%81%AE%E3%81%82%E3%82%8B%E6%A9%9F%E7%A8%AE%EF%BC%89&select_id=bd5ecb0c4b9f&select_sid=2196608) |
| ツナのレンジパスタ | スパゲティ用の電子レンジ専用プラスチック容器を使い、水は必ず400mL（お湯は使用しない）。1.6mm・100gは600Wで7分（500Wで8分）。足りなければ30秒ずつ追加加熱 | [日清製粉ウェルナ公式「マ･マー 早ゆでスパゲティ FineFast 1.6mm チャック付結束タイプ」](https://www.nisshin-seifun-welna.com/index/products/4902110362411.html) |
| 〃 | 早ゆでシリーズは電子レンジ調理に対応（太さごとに水量・時間が違う） | [日清製粉ウェルナ公式「マ･マー 早ゆで FineFastシリーズ」](https://www.nisshin-seifun-welna.com/index/mama/hayayude/) |

**動画で断定していないこと**：冷凍うどん・パスタの加熱時間（商品で違うため「袋の表示どおり」）、炊き込みの水の量（「目盛りまで」）、めんつゆの量。まとめで「時間と水加減は、商品と炊飯器の表示どおりに」と伝えている。

## 検査

- [`out/qa_report.md`](out/qa_report.md)：読み（Open JTalk の解析）、聞き取り（音声認識 ReazonSpeech による照合）、文字のはみ出し（描画時の実測）、切り替えフレーム、声との同期、間
- 聞き取り検査に使ったモデル：sherpa-onnx `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01`（検査のみに使用。動画には含まれない）
