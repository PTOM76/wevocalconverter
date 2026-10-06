# Third-party notices
WeVocalConverter は MIT ライセンスで公開している。以下の部品は別のライセンスに従う。

## lamejs（@breezystack/lamejs）
- 用途: MP3 の書き出し
- ライセンス: LGPL-3.0（全文は `node_modules/@breezystack/lamejs/LICENSE`、配布元 https://github.com/nicktindall/lamejs の派生）
- 組み込み方: MP3 を書き出すときだけ読み込む Worker（`assets/mp3Worker-*.js`）に入れ、Web ツールだけが使う（ライブラリの `src/` は使わない）。このファイルを差し替えれば、改変したエンコーダを使える

MP3 以外（WAV / Opus）の書き出しと、アプリのほかの部分は lamejs に依存しない。

## Mediabunny
- 用途: 動画（WebM、MP4）の書き出しで、映像と音声を 1 つのファイルにまとめる
- ライセンス: MPL-2.0（全文は `node_modules/mediabunny/LICENSE`、配布元 https://github.com/Vanilagy/mediabunny）
- 組み込み方: 改変せずに使用している。MPL-2.0 はファイル単位の条件のため、アプリのほかの部分には及ばない
