import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// 単体のサイト（app/）のビルド設定。ライブラリ（src/）は React に依存しないまま、app/ から使う
const root = dirname(fileURLToPath(import.meta.url))

/**
 * submodule（`name/`）の場所。`env` を指定するか、WeVocalSynth の submodule として隣にあればそちらを使う
 * （両方を直しながら開発できるように。こちらの submodule は todo setup:nested で隠す）
 */
function submodule(name: string, entry: string, env: string | undefined) {
  const sibling = resolve(root, '..', name)
  return env ?? (existsSync(resolve(sibling, entry)) ? sibling : resolve(root, name))
}
// PevenMUI（UI 部品）と wevocal-lib（音声ファイルの読み込み・書き出し。TypeScript 側は web/）
const pevenmui = submodule('pevenmui', 'src/index.ts', process.env.PEVENMUI_PATH)
const wevocalLib = submodule('wevocal-lib', 'web/src/index.ts', process.env.WEVOCAL_LIB_PATH)

// 開発サーバーで、依存パッケージのファイル（フォントなど）を配れるようにする。WeVocalSynth の submodule として開発するときは親の node_modules も許可する
const nodeModules = [resolve(root, 'node_modules'), resolve(root, '../node_modules')].filter((p) => existsSync(p))

/**
 * ビルドしたコミットの短いハッシュ。バージョン番号を上げずにデプロイしても、どの版か分かるようにする
 * （CI では GITHUB_SHA、手元では git から。取れなければ dev）
 */
function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}
const commit = commitHash()

/** OGP に使う配信先の絶対 URL（末尾 /）。CI から SITE_URL で指定する。無ければ公開中の URL */
const siteUrl = (process.env.SITE_URL ?? 'https://wevocalconverter.pitan76.net/').replace(/\/?$/, '/')

export default defineConfig({
  root: resolve(root, 'app'),
  // 配信先のサブパス（GitHub Pages など）は BASE_PATH で指定する
  base: process.env.BASE_PATH ?? '/',
  // 「このアプリについて」と設定に出すバージョン（package.json の version）とコミット
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_COMMIT__: JSON.stringify(commit) },
  publicDir: resolve(root, 'public'),
  resolve: {
    alias: [
      { find: /^pevenmui$/, replacement: resolve(pevenmui, 'src/index.ts') },
      { find: /^pevenmui\/pwa$/, replacement: resolve(pevenmui, 'src/pwa/index.ts') },
      { find: /^pevenmui\/web$/, replacement: resolve(pevenmui, 'src/web/index.ts') },
      { find: /^wevocal-lib$/, replacement: resolve(wevocalLib, 'web/src/index.ts') },
    ],
    // 外にある pevenmui から読み込む React・MUI も、このアプリと同じものにする（2つになると動かない）
    dedupe: ['react', 'react-dom', '@mui/material', '@emotion/react', '@emotion/styled', '@fortawesome/react-fontawesome'],
  },
  server: { fs: { allow: [root, pevenmui, wevocalLib, ...nodeModules] } },
  plugins: [
    react(),
    // OGP のメタタグは絶対 URL が要るので、index.html の %SITE_URL% を置き換える
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    },
    // 更新の通知で「どの版が来たか」を出すため、配信中の版を version.json に書く（オフライン用のキャッシュには入れない）
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, commit }) })
      },
    },
    VitePWA({
      // 新しい版は利用者が「更新」を押したときに切り替える（抽出中に勝手に再読み込みしない。UpdatePrompt 参照）
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'WeVocalConverter',
        short_name: 'WeVocalConverter',
        description: '音声ファイルの形式を変換する Web ツール',
        lang: 'ja',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        inlineWorkboxRuntime: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
    }),
  ],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
  },
  // MP3 のエンコーダは Worker で動く（wevocal-lib）
  worker: { format: 'es' },
})
