# WeVocalConverter
WeVocalConverterは、Webブラウザ上で音声ファイルの形式（WAV、MP3 など）を変換するためのツールである。

音声ファイルはサーバーへ送らず、処理はすべてブラウザ内で行う。<br />
画面を持たないライブラリとしても使える。

## 今の状態
[WeVocalExtractor](https://github.com/PTOM76/wevocalextractor) を写して始めた土台。中身は今のところ Extractor と同じ（曲からボーカルと伴奏を取り出す）で、これから形式の変換に置き換える。

- 使い続けるもの: ライブラリ（`src/`、UI なし）と画面（`app/`）の分け方、複数のファイルを並べて順に処理するキュー、曲ごとの保存と ZIP でのまとめての保存、PWA
- 置き換えるもの: `src/` の抽出の処理、`app/` の抽出の設定
- 要らなくなるもの: モデル（ONNX）、`dsp/`、診断
- 要件と進め方は [DEFINE.md](DEFINE.md)（要件定義書）。`docs/` の文書は、写した抽出の処理の説明

## 技術スタック
| 項目 | 内容 |
| --- | --- |
| 画面 | React + TypeScript + MUI（[PevenMUI](https://github.com/PTOM76/pevenmui)、Vite） |
| 読み込みと書き出し | [wevocal-lib](https://github.com/PTOM76/wevocal-lib)（WeVocalSynth の書き出しと同じ部品。MP3 は lamejs、Opus は WebCodecs） |

## 開発
```sh
git submodule update --init
npm install
npm run dev
```

## ライセンス
MIT（[LICENSE](LICENSE)）。使用している部品のライセンスは [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md)。
