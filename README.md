# WeVocalConverter
WeVocalConverterは、Webブラウザ上で声を別の声質に変換するためのツールである（準備中）。

音声ファイルはサーバーへ送らず、処理はすべてブラウザ内で行う。<br />
画面を持たないライブラリとしても使え、[WeVocalSynth](https://github.com/PTOM76/wevocalsynth) から追加機能として使う予定。

## 今の状態
[WeVocalExtractor](https://github.com/PTOM76/wevocalextractor) を写して始めた土台。変換の方式はまだ決めていないので、中身は今のところ Extractor と同じ（曲からボーカルと伴奏を取り出す）。

- 使い続けるもの: ライブラリ（`src/`、UI なし）と画面（`app/`）の分け方、キュー、モデルの取得と保存、診断、PWA
- 置き換えるもの: `src/` の抽出の処理、`dsp/`、`app/` の抽出の設定とモデルの一覧
- 進め方は [docs/PLAN.md](docs/PLAN.md)。`docs/` のほかの文書は、写した抽出の処理の説明

## 技術スタック
| 項目 | 内容 |
| --- | --- |
| 画面 | React + TypeScript + MUI（[PevenMUI](https://github.com/PTOM76/pevenmui)、Vite） |
| 推論 | ONNX Runtime Web（Web Worker で実行） |
| 信号処理 | Rust → WebAssembly（[wevocal-lib](https://github.com/PTOM76/wevocal-lib) を使う） |

## 開発
```sh
git submodule update --init
npm install
npm run dev
```

## ライセンス
MIT（[LICENSE](LICENSE)）。使用している部品のライセンスは [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md)。
