// アプリから使うための手順（動画の書き出し。読み込み、既定値、見た目の組み立て）。WeVocalSynth と WeVocal Studio で共通。
// 本体（video/）は追加機能として配り、アプリは導入したものを loadAddon で読み込む
import type * as Video from './video/index'
import type { VideoContainer, VideoLook, WaveStyle } from './video/index'

export type { VideoContainer, VideoLook, WaveStyle, VideoOptions } from './video/index'

/** 追加機能の id */
export const CONVERTER_ADDON = 'converter'

/** アプリの追加機能の読み込み方で、動画の書き出しの手順を作る */
export function createVideoHost(loadAddon: <T>(id: string) => Promise<T>) {
  let mod: typeof Video | null = null
  const load = async () => (mod ??= await loadAddon<typeof Video>(CONVERTER_ADDON))
  return {
    /** このブラウザでその入れ物の動画を作れるか */
    canEncodeVideo: async (container: VideoContainer, width: number, height: number) => (await load()).canEncodeVideo(container, width, height),
    /** 動画の 1 フレームを画像にする（プレビュー）。曲の中ほどで音が最も大きいところを描く */
    renderPreview: async (clip: Parameters<typeof Video.renderFrame>[0], look: VideoLook) => {
      const m = await load()
      return m.renderFrame(clip, look, m.previewTime(clip))
    },
    /** 音声に簡易な波形を付けて動画にする */
    renderVideo: async (clip: Parameters<typeof Video.renderVideo>[0], options: Video.VideoOptions) => (await load()).renderVideo(clip, options),
  }
}
export type VideoHost = ReturnType<typeof createVideoHost>

export const VIDEO_MIME: Record<VideoContainer, string> = { webm: 'video/webm', mp4: 'video/mp4' }
export const VIDEO_EXT: Record<VideoContainer, string> = { webm: '.webm', mp4: '.mp4' }

/** 動画の書き出しで選んだもの（設定に覚える。背景の画像は覚えない） */
export interface VideoExportPrefs {
  container: VideoContainer
  /** 幅x高さ */
  size: '1280x720' | '1920x1080' | '1080x1920' | '1080x1080'
  style: WaveStyle
  position: 'bottom' | 'center'
  /** 背景、波形、再生したところの色 */
  bg: string
  wave: string
  played: string
  /** 背景の画像の合わせ方 */
  fit: 'cover' | 'contain'
  /** ファイル名を曲名として入れる */
  title: boolean
  /** 音量波形をグラデーションにする */
  gradient: boolean
  /** 音量波形の棒の数（細かさ） */
  bars: 32 | 64 | 128 | 256 | 512
  /** 音量波形の棒の間の隙間の割合 */
  gap: 0.05 | 0.2 | 0.4 | 0.6
}

export const DEFAULT_VIDEO_PREFS: VideoExportPrefs = {
  container: 'mp4',
  size: '1280x720',
  style: 'bars',
  position: 'center',
  bg: '#101418',
  wave: '#5c6b7a',
  played: '#4fc3f7',
  fit: 'cover',
  title: false,
  gradient: false,
  bars: 64,
  gap: 0.2,
}

/** 選んだものから動画の見た目を作る（書き出しとプレビューで同じものを使う）。`title` は空なら曲名を入れない */
export function videoLook(pr: VideoExportPrefs, image: ImageBitmap | null, title: string): VideoLook {
  const [width, height] = pr.size.split('x').map(Number)
  return {
    width,
    height,
    background: { color: pr.bg, image, fit: pr.fit },
    wave: { style: pr.style, color: pr.wave, playedColor: pr.played, position: pr.position, height: 0.25, gradient: pr.gradient, bars: pr.bars ?? 64, gap: pr.gap ?? 0.2 },
    title: pr.title ? title : '',
    titleColor: '#ffffff',
  }
}
