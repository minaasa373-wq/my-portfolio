# 下ごしらえ不要！ズボラ飯3選（縦型ショート）

**完成動画：[`out/zubora-meshi-3sen.mp4`](out/zubora-meshi-3sen.mp4)**（1080×1920・30fps・47.1秒・H.264＋AAC・3.0MB）

`make-five-shorts` の手順で作成。台本は「テーマ＋3品＋まとめ」の5項目で、各項目は「名前＋短いコメント2つ」です（タイトルが3選なので料理は3品）。

## 入っているもの

| ファイル | 内容 |
|---|---|
| `out/zubora-meshi-3sen.mp4` | 完成動画 |
| [`SCRIPT.md`](SCRIPT.md) | 台本全文（切り替え秒数・読み上げ文・確認済みの読み・公式情報の確認つき） |
| [`SOURCES.md`](SOURCES.md) | 素材の出典・ライセンス・公式情報の確認方法 |
| `script.json` | 台本の元データ。**ここを直して作り直す** |
| `out/timeline.csv` | 切り替え表（項目・秒・フレーム・音声ファイル・字幕） |
| `out/captions.srt` | 字幕ファイル（YouTube に字幕としてアップロードできる） |
| `audio/*.wav` | 1行ずつの音声（48kHz、本編と同じ音量に調整済み） |
| `out/narration.wav` | ナレーション1本（動画と同じ長さ） |
| `frames/*.png` | 各カットの画像（1080×1920、15枚） |
| `out/qa_report.md` | 検査レポート（読み・聞き取り・はみ出し・切り替え・同期・間） |
| `out/video_contact.png` | 完成動画から各カットの中央フレームを取り出した一覧 |
| `build.py` / `render_frames.js` / `frame.html` / `illustrations.js` | 制作プログラム（音声・画像・動画・検査） |
| `fetch_assets.sh` | フォントと音声モデルの取得（チェックサム確認つき） |

## 構成と見た目のルール

- 5項目：テーマ → 1品目 → 2品目 → 3品目 → まとめ（順位は付けず、番号は数えるためだけ）
- 青のコメント＝使う場面、ピンクのコメント＝操作の入口。読み上げに合わせて青 → ピンクの順に出て、その項目の終わりまで残る
- 全項目で同じテンプレート（番号の札・大見出し・絵のカード・コメント2枠）。項目が変わっても演出は足さない
- 切り替えは声の実際の長さから自動で計算し、フレーム単位でそろえる。字幕・画像は声の 0.03〜0.05 秒前に切り替わる
- 文字は YouTube ショートの右側ボタン・下部の説明欄にかからない範囲（横 943px 以内、上下 150〜1476px）に収める

## 作り直し方

```bash
# 準備（1回だけ）
sudo apt install ffmpeg open-jtalk open-jtalk-mecab-naist-jdic
pip install numpy pillow
npm install -g playwright && npx playwright install chromium
./fetch_assets.sh          # フォント（M PLUS Rounded 1c）と音声モデル（Mei）を取得

# 作る（読み確認 → 音声 → フレーム → 動画 → 聞き取り検査 → 総合検査）
python3 build.py all
```

工程ごとにも実行できます：`readings` / `audio` / `frames` / `video` / `hear` / `qa` / `script`

## 直し方

- **文言**：`script.json` の `text`（画面の文字）と `say`（読み上げ文）を直す。`python3 build.py readings` で実際の読みを表示 → 正しければその読みを `expect` に入れる（誤読なら `say` をかな書きにする等で直す。`expect` と違うと作り直しが止まります）
- **間**：`timing`（`lead_in` 冒頭、`gap_line` 行間、`gap_section` 項目間、`tail` 締め）
- **声**：`voice`（`speed` 話速、`half_tone` 高さ、`gv_weight_f0` 抑揚、`lofi_rate` 帯域）。行ごとに `"voice": {"speed": 1.0}` のように上書きできる
- **本物のゆっくりボイス等に差し替える**：ゆっくりMovieMaker・SofTalk・VOICEVOX などで1行ずつ書き出し、`voice_in/<cue>.wav`（cue 名は `out/timeline.csv` の1列目）に置いて `script.json` の `voice.engine` を `"files"` にする → `python3 build.py audio frames video qa` で字幕と画像の切り替えも新しい声の長さに合わせて付け直される
- **見た目**：`frame.html`（色・文字の大きさ・配置）、**画像**：`illustrations.js`（すべてコードで描画）
- **動画編集ソフトで組み直す**：`frames/*.png` と `audio/*.wav` を `out/timeline.csv` の秒数どおりに並べる（音声は `out/narration.wav` を1本置いてもよい）。字幕は `out/captions.srt`

## 聞き取り検査（任意）

動画の音声を日本語音声認識にかけ、台本どおりに聞こえるかを確かめます（モデル約713MB）。

```bash
pip install sherpa-onnx
curl -L -o m.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2
tar xjf m.tar.bz2 --wildcards '*int8.onnx' '*tokens.txt'
ASR_MODEL_DIR=./sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01 python3 build.py hear qa
```

## 最後まで見て直したこと

| 気づいたこと | 直し方 |
|---|---|
| 「1品目」を「イチヒンモク」、「釜玉」を「カマダマ」と誤読 | 読み上げ文をかな書きに（いっぴんめ・かまたま） |
| 「釜玉風うどん」の「ふう・うどん」が続いて聞き取りにくい | 料理名を「レンジで釜玉うどん」に（公式レシピ名は SCRIPT.md に記載） |
| 「サバ缶炊き込みご飯」が「佐賀県炊き込みご飯」に聞こえる | 料理名を「炊き込みサバ缶ごはん」に |
| 「レンジでツナパスタ」が「レンジでつなぎました」に聞こえる | 料理名を「ツナのレンジパスタ」に |
| 帯域を狭めすぎて「ザル」が「じゃれ」に聞こえる | ゆっくり風の帯域制限を 11kHz → 16kHz に、名前の行は話速を少し落とす |
| まだ読まれていないコメント枠が空の色付き枠で表示 | 読み上げ前は点線の空き枠に |
| 行末の読点で字幕の中央がずれる | 画面の字幕から行末の読点を外す（読み上げの間はそのまま） |
| 音量の自動調整で声の大きさが揺れる設定（dynamic）になっていた | 一定のゲイン＋ピークだけ抑えるリミッターに（-16 LUFS） |
| 炊き込みの手順で「混ぜない」の対象があいまい | 「水を目盛りまで入れて混ぜる」「サバは上にのせるだけ（混ぜない）」に分けた |

## 投稿するとき

説明欄に音声のクレジットを入れてください（音声モデル Mei は CC BY 3.0 で、表示が必要です）。例：

```
疲れた日でも包丁・まな板いらず！下ごしらえ不要のズボラ飯を3つ紹介します。
加熱時間と水加減は、商品と炊飯器の表示どおりにしてください。

音声：Open JTalk／HTS voice "Mei"（© 2009-2018 Nagoya Institute of Technology, CC BY 3.0 https://creativecommons.org/licenses/by/3.0/）
フォント：M PLUS Rounded 1c（SIL Open Font License 1.1）
#ズボラ飯 #下ごしらえ不要 #時短レシピ #Shorts
```
