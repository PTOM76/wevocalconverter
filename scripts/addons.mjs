// 追加機能「変換」（今は動画の書き出し）を作る。アプリの scripts/build-addons.mjs から呼ぶ（WeVocalSynth と WeVocal Studio で共通）。
// アプリのフォルダーで実行する（converter/ と extractor/ はアプリの中にある。マニフェストの書き方は extractor の手順と同じもの）
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { writeManifest } from '../../extractor/scripts/addons.mjs'

/** 変換（converter）を `OUT` に作る */
export function buildConverterAddon(OUT) {
  process.env.ADDONS_OUT = OUT
  execSync('npx vite build -c converter/vite.addons.config.ts', { stdio: 'inherit' })
  writeManifest('converter', join(OUT, 'converter'), 'index.js')
}
