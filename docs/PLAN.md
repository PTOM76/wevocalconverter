# 進め方

WeVocalConverter を、Extractor を写した土台から音声ファイルの形式の変換のツールにしていく手順。(2026-10-05)

## 1. 方針
- Extractor と同じく、UI なしのライブラリ（`src/`、`exports: ./src/index.ts`）と画面（`app/`）に分ける
- 読み込み（`decodeFile`）と書き出し（`exportAudio`）は wevocal-lib のもの（WeVocalSynth の書き出しと同じ）を使う
- 複数のファイルを並べて順に変換し、1 つずつ、または ZIP でまとめて保存する（Extractor のキューと ZIP を使い続ける）
- 音声は外部に送らない

## 2. できるようにすること
| 項目 | 内容 |
| --- | --- |
| 入力 | ブラウザで読めるもの（WAV、AIFF、MP3、M4A、FLAC、OGG、Opus、WebM など。wevocal-lib の `AUDIO_ACCEPT`） |
| 出力 | WAV（16 / 24bit、32bit float）、MP3、Opus |
| 設定 | サンプルレート、ビットレート（MP3、Opus）、モノラルにする |

## 3. 手順
1. ライブラリ: `convert(file, options)` → `Blob`（`decodeFile` と `exportAudio` をつなぐ）。進み具合と中止は Extractor とそろえる
2. 画面: 抽出の設定（モデル、取り出すもの）を、出力の形式、サンプルレート、ビットレート、モノラルに置き換える。キュー、試聴、保存、ZIP はそのまま
3. 要らないものを消す: モデル（`app/models.ts`、`scripts/fetch-models.mjs`）、ONNX Runtime、`dsp/`、`src/` の抽出の処理、診断、抽出の docs
4. 出力の形式を足すか決める（FLAC、AAC など。ブラウザで作れるか調べる）

## 4. WeVocalSynth との関係
- 今のところ、Synth から追加機能としては使わない（Synth の書き出しは同じ wevocal-lib の部品で、WAV、MP3、Opus は Synth だけで作れる）
- 使うとしたら「対応する形式を増やす追加機能」にする。エンコーダーとデコーダー（wasm）は大きくなりがちなので、使う人だけが導入し、普段の Synth は軽いままにする
  - 出力を増やす: FLAC、AAC（M4A）、ALAC など。Synth の書き出しの形式の選択肢に足す
  - 入力を増やす: ブラウザが読めない形式（WMA、APE、Safari 以外での ALAC など）。Synth で開くとき、ブラウザで読めなければ追加機能で読み直す
- そのため、形式を増やすときは、エンコーダーとデコーダーを Converter のライブラリ（`src/`）に置き、Converter の画面と Synth の追加機能の両方から使える形にする
