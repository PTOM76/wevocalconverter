/**
 * WeVocalConverter: 音声ファイルの形式を変換する（UI を持たず、React にも依存しない。画面は app/）。
 * 読み込みと書き出しは wevocal-lib（WeVocalSynth の書き出しと同じ部品）。形式を増やすときは、エンコーダーとデコーダーをここに置く
 */
import { EXPORT_EXT, MP3_SAMPLE_RATES, OPUS_SAMPLE_RATE, decodeFile, exportAudio, type ExportFormat, type WavFormat } from 'wevocal-lib'

export type { ExportFormat, WavFormat } from 'wevocal-lib'

/** 出力の設定 */
export interface ConvertOptions {
  format: ExportFormat
  /** WAV のサンプル形式 */
  wavFormat: WavFormat
  /** MP3 / Opus のビットレート（kbps） */
  kbps: number
  /** 出力のサンプルレート。null なら元のまま（MP3 は扱える中で一番近いもの、Opus は常に 48kHz） */
  sampleRate: number | null
  /** モノラルにする */
  mono: boolean
  /** 進み具合（0〜1。読み込みが前半、書き出しが後半） */
  onProgress?: (p: number) => void
  signal?: AbortSignal
}

/** 変換の結果 */
export interface ConvertResult {
  blob: Blob
  /** 出力の拡張子（.wav など） */
  ext: string
}

/** 実際に書き出すサンプルレート */
export function outputRate(format: ExportFormat, source: number, wanted: number | null): number {
  if (format === 'opus') return OPUS_SAMPLE_RATE
  const rate = wanted ?? source
  if (format === 'mp3') return MP3_SAMPLE_RATES.reduce((a, b) => (Math.abs(b - rate) < Math.abs(a - rate) ? b : a))
  return rate
}

/** `file` を読み込み、設定の形式で書き出す */
export async function convert(file: File, o: ConvertOptions): Promise<ConvertResult> {
  o.signal?.throwIfAborted()
  // 読み込みの進み具合は、読み終わると -1 が来る（デコード中）
  const clip = await decodeFile(file, (p) => p >= 0 && o.onProgress?.(p * 0.5))
  o.signal?.throwIfAborted()
  o.onProgress?.(0.5)
  const blob = await exportAudio(
    clip,
    { format: o.format, wavFormat: o.wavFormat, kbps: o.kbps, sampleRate: outputRate(o.format, clip.sampleRate, o.sampleRate), mono: o.mono, range: null },
    (p) => o.onProgress?.(0.5 + p * 0.5),
  )
  o.signal?.throwIfAborted()
  o.onProgress?.(1)
  return { blob, ext: EXPORT_EXT[o.format] }
}

import { VIDEO_EXT, renderVideo, type VideoOptions } from './video'

/** `file` を読み込み、簡易な波形を付けた動画にする */
export async function convertVideo(file: File, o: VideoOptions): Promise<ConvertResult> {
  o.signal?.throwIfAborted()
  const clip = await decodeFile(file, (p) => p >= 0 && o.onProgress?.(p * 0.2))
  o.signal?.throwIfAborted()
  const blob = await renderVideo(clip, { ...o, onProgress: (p) => o.onProgress?.(0.2 + p * 0.8) })
  return { blob, ext: VIDEO_EXT[o.container] }
}

export { VIDEO_EXT, canEncodeVideo, renderFrame, renderVideo, type VideoBackground, type VideoContainer, type VideoLook, type VideoOptions, type VideoWave, type WaveStyle } from './video'
