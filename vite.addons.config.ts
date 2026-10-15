import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// 追加機能「変換」（converter/ の WeVocalConverter）を dist/addons/converter/ にビルドする（converter/scripts/addons.mjs から呼ぶ。アプリのフォルダーで実行する。WeVocalSynth と WeVocal Studio で共通）。
// 今は動画の書き出しだけを使う（memo/video-export.md）。音声の書き出しはアプリの本体にあるので入れない
export default defineConfig({
  // アプリの public/ はコピーしない
  publicDir: false,
  base: './',
  resolve: {
    alias: [{ find: /^wevocal-lib$/, replacement: fileURLToPath(new URL('../wevocal-lib/web/src/index.ts', import.meta.url)) }],
  },
  build: {
    outDir: `${process.env.ADDONS_OUT ?? 'dist/addons'}/converter`,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: 'converter/src/video/index.ts',
      // 公開している関数（renderVideo、canEncodeVideo）を消さない
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: 'index.js' },
    },
  },
})
