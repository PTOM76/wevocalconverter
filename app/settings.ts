import { useState } from 'react'
import type { ExportFormat, WavFormat } from 'wevocal-lib'
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
  /** 書き出す形式と、WAV のサンプル形式・MP3 / Opus のビットレート（kbps） */
  format: ExportFormat
  wavFormat: WavFormat
  kbps: number
  /** 出力のサンプルレート。0 なら元のまま */
  sampleRate: number
  /** モノラルにする */
  mono: boolean
  /** 閉じたあとも一覧を残すか（none: 残さない、undownloaded: ダウンロードしていない結果だけ、all: ダウンロードした結果も） */
  keepQueue: KeepMode
  /** ダイアログの出し方。auto は PWA かつ Chromium 系ならポップアップ、ほかはダイアログ。別窓を開けなければダイアログ */
  dialogWindow: WindowMode | 'auto'
  /** 開発版の更新（バージョンが同じでコミットだけ違う版）も知らせる */
  devUpdates: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', language: 'auto', uiScale: 1, format: 'mp3', wavFormat: 'pcm16', kbps: 192, sampleRate: 0, mono: false, dialogWindow: 'auto', keepQueue: 'undownloaded', devUpdates: false }

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
