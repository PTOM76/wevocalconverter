import { useState } from 'react'
import type { ExportFormat, WavFormat } from 'wevocal-lib'
import type { VideoContainer, WaveStyle } from '../src/index'
import type { WindowMode } from 'pevenmui'
import type { LangSetting } from './i18n'
import type { KeepMode } from './persist'
import { app } from './appConfig'

export type ThemeSetting = 'system' | 'light' | 'dark'

/** アプリの設定（localStorage に保存する） */
export interface Settings {
  theme: ThemeSetting
  language: LangSetting
  /** 画面の大きさ（倍率。文字や入力欄などをまとめて拡大縮小する） */
  uiScale: number
  /** 書き出す形式（webm、mp4 は動画）と、WAV のサンプル形式・MP3 / Opus のビットレート（kbps） */
  format: ExportFormat | VideoContainer
  wavFormat: WavFormat
  kbps: number
  /** 出力のサンプルレート。0 なら元のまま */
  sampleRate: number
  /** モノラルにする */
  mono: boolean
  /** 動画の大きさ（幅x高さ） */
  videoSize: VideoSize
  /** 動画の背景の色、波形の色、再生したところの色 */
  videoBg: string
  videoWave: string
  videoPlayed: string
  /** 波形の種類 */
  videoWaveStyle: WaveStyle
  videoWavePosition: 'bottom' | 'center'
  /** 背景の画像の合わせ方 */
  videoFit: 'cover' | 'contain'
  /** ファイル名を曲名として入れる */
  videoTitle: boolean
  /** 閉じたあとも一覧を残すか（none: 残さない、undownloaded: ダウンロードしていない結果だけ、all: ダウンロードした結果も） */
  keepQueue: KeepMode
  /** ダイアログの出し方。auto は PWA かつ Chromium 系ならポップアップ、ほかはダイアログ。別窓を開けなければダイアログ */
  dialogWindow: WindowMode | 'auto'
  /** 開発版の更新（バージョンが同じでコミットだけ違う版）も知らせる */
  devUpdates: boolean
}

export type VideoSize = '1280x720' | '1920x1080' | '1080x1920' | '1080x1080'

export const DEFAULT_SETTINGS: Settings = { theme: 'system', language: 'auto', uiScale: 1, format: 'mp3', wavFormat: 'pcm16', kbps: 192, sampleRate: 0, mono: false, videoSize: '1280x720', videoBg: '#101418', videoWave: '#5c6b7a', videoPlayed: '#4fc3f7', videoWaveStyle: 'overview', videoWavePosition: 'bottom', videoFit: 'cover', videoTitle: false, dialogWindow: 'auto', keepQueue: 'undownloaded', devUpdates: false }

const KEY = app.key('settings')

function load(): Settings {
  try {
    // 古い設定に無い項目は既定値で埋める
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** 設定と、一部を変えて保存する関数 */
export function useSettings() {
  const [settings, setSettings] = useState(load)
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // 保存できなくても、このセッション中は使う
      }
      return next
    })
  return [settings, update] as const
}
