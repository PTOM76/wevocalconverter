import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  canEncodeAudio,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type VideoCodec,
} from 'mediabunny'
import { prepareClip, type Clip } from 'wevocal-lib'
import { FrameRenderer, type VideoLook } from './draw'

export type { VideoBackground, VideoLook, VideoWave, WaveStyle } from './draw'

/** 動画の入れ物。WebM は VP9（なければ VP8）と Opus、MP4 は H.264 と AAC */
export type VideoContainer = 'webm' | 'mp4'

export const VIDEO_EXT: Record<VideoContainer, string> = { webm: '.webm', mp4: '.mp4' }

const VIDEO_CODECS: Record<VideoContainer, VideoCodec[]> = { webm: ['vp9', 'vp8'], mp4: ['avc'] }
const AUDIO_CODEC: Record<VideoContainer, AudioCodec> = { webm: 'opus', mp4: 'aac' }
/** 音声は 48kHz にそろえる（Opus は 48kHz だけ、AAC も 48kHz は使える） */
const AUDIO_RATE = 48000

/** 動画の書き出しの設定 */
export interface VideoOptions extends VideoLook {
  container: VideoContainer
  fps: number
  /** 音声のビットレート（kbps） */
  kbps: number
  onProgress?: (p: number) => void
  signal?: AbortSignal
}

/** 映像と音声の形式の組み合わせ。このブラウザで作れなければ null */
async function pickCodecs(container: VideoContainer, width: number, height: number, channels: number) {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return null
  const video = await getFirstEncodableVideoCodec(VIDEO_CODECS[container], { width, height })
  const audio = AUDIO_CODEC[container]
  if (!video || !(await canEncodeAudio(audio, { numberOfChannels: channels, sampleRate: AUDIO_RATE }))) return null
  return { video, audio }
}

/** このブラウザでその入れ物の動画を作れるか */
export async function canEncodeVideo(container: VideoContainer, width = 1280, height = 720): Promise<boolean> {
  return (await pickCodecs(container, width, height, 2)) !== null
}

/** プレビューに使う時刻（秒）。曲の 10〜90% の中で音が最も大きいところ（真ん中が無音だと波形が映らないため） */
export function previewTime(clip: Clip): number {
  const len = clip.channels[0].length
  const win = Math.min(len, 4096)
  let best = len / 2
  let bestPower = -1
  for (let k = 0; k < 64; k++) {
    const center = Math.round(len * (0.1 + (0.8 * k) / 63))
    let p = 0
    for (const ch of clip.channels) for (let i = Math.max(0, center - win / 2); i < Math.min(len, center + win / 2); i++) p += ch[i] * ch[i]
    if (p > bestPower) [bestPower, best] = [p, center]
  }
  return best / clip.sampleRate
}

/** 動画の 1 フレームを画像にする（書き出す前のプレビュー）。`time` は秒 */
export async function renderFrame(clip: Clip, look: VideoLook, time: number, fps = 30): Promise<Blob> {
  const renderer = new FrameRenderer(clip, look, fps)
  renderer.draw(time)
  return renderer.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
}

/** `clip` に簡易な波形を付けて動画にする */
export async function renderVideo(source: Clip, o: VideoOptions): Promise<Blob> {
  const clip = await prepareClip(source, { range: null, sampleRate: AUDIO_RATE, mono: source.channels.length === 1 })
  const channels = Math.min(2, clip.channels.length)
  const codecs = await pickCodecs(o.container, o.width, o.height, channels)
  if (!codecs) throw new Error(`cannot encode ${o.container}`)
  o.signal?.throwIfAborted()

  const renderer = new FrameRenderer(clip, o, o.fps)
  const output = new Output({
    format: o.container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  })
  const video = new CanvasSource(renderer.canvas, { codec: codecs.video, bitrate: o.width * o.height * o.fps * 0.1 })
  const audio = new AudioSampleSource({ codec: codecs.audio, bitrate: o.kbps * 1000 })
  output.addVideoTrack(video, { frameRate: o.fps })
  output.addAudioTrack(audio)

  const len = clip.channels[0].length
  const duration = len / AUDIO_RATE
  const frames = Math.max(1, Math.ceil(duration * o.fps))
  try {
    await output.start()
    let frame = 0
    // 1 秒ずつ音声を足し、その間のフレームを描く（映像と音声を交互に入れると、溜めずに束ねられる）
    for (let s = 0; s < len; s += AUDIO_RATE) {
      o.signal?.throwIfAborted()
      const n = Math.min(AUDIO_RATE, len - s)
      const data = new Float32Array(n * channels)
      for (let c = 0; c < channels; c++) data.set(clip.channels[c].subarray(s, s + n), c * n)
      const sample = new AudioSample({ data, format: 'f32-planar', numberOfChannels: channels, sampleRate: AUDIO_RATE, timestamp: s / AUDIO_RATE })
      await audio.add(sample)
      sample.close()
      const until = Math.min(frames, Math.ceil(((s + n) / AUDIO_RATE) * o.fps))
      for (; frame < until; frame++) {
        renderer.draw(frame / o.fps)
        await video.add(frame / o.fps, 1 / o.fps)
      }
      o.onProgress?.(frame / frames)
    }
    await output.finalize()
  } catch (e) {
    if (output.state !== 'finalized') await output.cancel()
    throw e
  }
  o.onProgress?.(1)
  return new Blob([output.target.buffer!], { type: o.container === 'mp4' ? 'video/mp4' : 'video/webm' })
}
