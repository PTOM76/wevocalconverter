// アプリの定義。vite.config.ts からも読み込むので、ほかのファイルを import しない（使い方は appConfig.ts の app。WeVocalSynth と同じ形）
export const APP_INFO = {
  id: 'wevocalconverter',
  name: 'WeVocalConverter',
  description: '音声ファイルの形式を変換する Web ツール',
  author: 'PitaQ',
  repository: 'https://github.com/PTOM76/wevocalconverter',
  // ユーザーガイド（ヘルプ → ユーザーガイド）。移転したらここだけを変える
  guide: 'https://github.com/PTOM76/wevocalconverter#readme',
  site: 'https://wevocalconverter.pitan76.net/',
  lang: 'ja_jp',
}
