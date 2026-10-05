# 進め方

WeVocalConverter を、Extractor を写した土台から声の変換のツールにしていく手順。(2026-10-05)

## 1. 方針
- Extractor と同じく、UI なしのライブラリ（`src/`、`exports: ./src/index.ts`）と画面（`app/`）に分ける
- WeVocalSynth からは追加機能として使う。ライブラリをビルドして配り、使う直前に導入する。Synth では、選択範囲やトラックの「声を変換」から呼び、結果は新しいトラックにする
- 入力は声だけの音声を想定する。曲のときは Extractor で先に声を取り出す（追加機能の `requires`）
- 音声は外部に送らない

## 2. 手順
1. 変換の方式を調べる（RVC 系の ONNX、話者の埋め込み、F0 の抽出に何を使うか、ブラウザで動く速さか、モデルのライセンス）。`docs/RESEARCH.md` に書く
2. ライブラリの API を決める（案: `createConverter(options)` → `convert(clip, { target, pitchShift })`。進み具合、中止、エラーの型は Extractor とそろえる）
3. `src/` と `dsp/` を変換の処理に置き換える。キュー、モデルの保存、診断は使い続ける
4. `app/` の設定とモデルの一覧を変換のものにする
5. WeVocalSynth に submodule として足し、追加機能として登録する

## 3. 共通の部品
- キューの一覧（`QueueList`、`useQueue`）とモデルの取得の画面は、Extractor と共通にする（PevenMUI へ）。取得と保存の処理は wevocal-lib/web へ
- それまでは、写したものをそのまま使う
