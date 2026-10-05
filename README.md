# WeVocalConverter
WeVocalConverterは、Webブラウザ上で音声ファイル形式を変換するツールである。

音声ファイルはサーバーへ送らず、処理はすべてブラウザ内で行う。<br />
画面を持たないライブラリとしても使える。

## できること
| 分類 | 機能 |
| --- | --- |
| 読み込み | 複数のファイルをまとめて追加（ドラッグ＆ドロップも）。ブラウザで読める形式（WAV、AIFF、MP3、M4A、FLAC、OGG、Opus など） |
| 出力 | WAV（16 / 24bit、32bit float）、MP3、Opus。サンプルレート、ビットレート、モノラル |
| 変換 | 1曲ずつ順に変換、曲ごとの進み具合と中止、変換し直し |
| 保存 | 曲ごとの試聴と保存、すべてを ZIP でまとめて保存。閉じたあとも一覧を残す |
| その他 | PC/スマホ対応、オフライン利用（PWA）、ライト/ダーク、日本語/英語/韓国語/中国語 |

要件は [docs/REQUIREMENT.md](docs/REQUIREMENT.md)。[WeVocalExtractor](https://github.com/PTOM76/wevocalextractor) を写して始めたので、キュー、保存、設定の画面は Extractor と同じ作り。

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
