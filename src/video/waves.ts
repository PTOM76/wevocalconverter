import type { Clip } from 'wevocal-lib'
import type { VideoWave, WaveBox } from './draw'

type Painter = (ctx: OffscreenCanvasRenderingContext2D, time: number) => void

/** その瞬間の波形で、画面の幅に入れる長さ（秒） */
const SCOPE_SECONDS = 0.04
/** 流れる波形で、画面の幅に入れる長さ（秒） */
const SCROLL_SECONDS = 6
/** 音量の棒の数と、FFT の大きさ */
const BARS = 64
const FFT_SIZE = 2048
/** 音量の棒の下限と上限の周波数（Hz）と、表示する音量の幅（dB） */
const BAR_MIN_HZ = 40
const BAR_MAX_HZ = 16000
const BAR_RANGE_DB = 60

/** `block` サンプルごとの最小値と最大値（全チャンネルを通す） */
function blockPeaks(clip: Clip, block: number): { min: Float32Array; max: Float32Array } {
  const len = clip.channels[0].length
  const n = Math.ceil(len / block)
  const min = new Float32Array(n)
  const max = new Float32Array(n)
  for (let b = 0; b < n; b++) {
    const s = Math.floor(b * block)
    const e = Math.min(len, Math.floor((b + 1) * block))
    let lo = 0
    let hi = 0
    for (const ch of clip.channels) {
      for (let i = s; i < e; i++) {
        const v = ch[i]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    min[b] = lo
    max[b] = hi
  }
  return { min, max }
}

/** 縦の線を並べて波形を描く。`from` 番目の列から `count` 列 */
function drawColumns(ctx: OffscreenCanvasRenderingContext2D, box: WaveBox, peaks: { min: Float32Array; max: Float32Array }, from: number, x0: number, count: number) {
  const mid = box.top + box.height / 2
  const half = box.height / 2
  for (let c = 0; c < count; c++) {
    const i = from + c
    if (i < 0 || i >= peaks.min.length) continue
    const y0 = mid - peaks.max[i] * half
    const y1 = mid - peaks.min[i] * half
    ctx.fillRect(x0 + c, y0, 1, Math.max(1, y1 - y0))
  }
}

/** 全体の波形と再生位置の線。波形は 2 色で先に描いておき、再生した側だけを切り出して重ねる */
function overview(clip: Clip, wave: VideoWave, box: WaveBox): Painter {
  const duration = clip.channels[0].length / clip.sampleRate
  const peaks = blockPeaks(clip, clip.channels[0].length / box.width)
  const layer = (color: string) => {
    const c = new OffscreenCanvas(box.width, Math.ceil(box.top + box.height))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = color
    drawColumns(ctx, { ...box, left: 0 }, peaks, 0, 0, box.width)
    return c
  }
  const rest = layer(wave.color)
  const played = layer(wave.playedColor)
  return (ctx, time) => {
    const w = Math.round(box.width * Math.min(1, time / duration))
    ctx.drawImage(rest, box.left, 0)
    if (w > 0) ctx.drawImage(played, 0, 0, w, played.height, box.left, 0, w, played.height)
    ctx.fillStyle = wave.playedColor
    ctx.fillRect(box.left + w - 1, box.top, 2, box.height)
  }
}

/** 再生位置を中央に固定し、波形が右から左へ流れる。左半分（再生した側）は再生した色 */
function scroll(clip: Clip, wave: VideoWave, box: WaveBox): Painter {
  const block = (SCROLL_SECONDS * clip.sampleRate) / box.width
  const peaks = blockPeaks(clip, block)
  const half = Math.floor(box.width / 2)
  return (ctx, time) => {
    const at = Math.round((time * clip.sampleRate) / block)
    ctx.fillStyle = wave.playedColor
    drawColumns(ctx, box, peaks, at - half, box.left, half)
    ctx.fillStyle = wave.color
    drawColumns(ctx, box, peaks, at, box.left + half, box.width - half)
    ctx.fillStyle = wave.playedColor
    ctx.fillRect(box.left + half - 1, box.top, 2, box.height)
  }
}

/**
 * その瞬間の波形（オシロスコープ）。再生位置の前後 40ms を線で描く。
 * 毎フレーム同じ位相から描くよう、再生位置の近くで負から正へ変わるところに合わせる（合わせないと線が左右に揺れて見にくい）
 */
function scope(clip: Clip, wave: VideoWave, box: WaveBox): Painter {
  const len = clip.channels[0].length
  const span = Math.round(SCOPE_SECONDS * clip.sampleRate)
  const mono = (i: number) => {
    if (i < 0 || i >= len) return 0
    let v = 0
    for (const ch of clip.channels) v += ch[i]
    return v / clip.channels.length
  }
  const mid = box.top + box.height / 2
  const half = box.height / 2
  return (ctx, time) => {
    let start = Math.round(time * clip.sampleRate) - Math.floor(span / 2)
    // 半分の幅の中で、最初に負から正へ変わるところを探す（なければそのまま）
    for (let i = start; i < start + span / 2; i++) {
      if (mono(i - 1) < 0 && mono(i) >= 0) {
        start = i - Math.floor(span / 4)
        break
      }
    }
    ctx.strokeStyle = wave.playedColor
    ctx.lineWidth = Math.max(2, box.height / 80)
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let x = 0; x <= box.width; x++) {
      const y = mid - Math.max(-1, Math.min(1, mono(start + Math.round((x / box.width) * span)))) * half
      if (x === 0) ctx.moveTo(box.left, y)
      else ctx.lineTo(box.left + x, y)
    }
    ctx.stroke()
  }
}

/** 長さ `n`（2 の累乗）の FFT（その場で書き換える） */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/** 音量の棒。再生位置の周りの FFT を、低い音から高い音へ対数の間隔でまとめる。下がるときはゆっくり下げる */
function bars(clip: Clip, wave: VideoWave, box: WaveBox, fps: number): Painter {
  const len = clip.channels[0].length
  const hann = Float32Array.from({ length: FFT_SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)
  // 棒ごとの FFT のビンの範囲
  const nyquist = clip.sampleRate / 2
  const edges = Array.from({ length: BARS + 1 }, (_, i) => BAR_MIN_HZ * (Math.min(BAR_MAX_HZ, nyquist) / BAR_MIN_HZ) ** (i / BARS))
  const ranges = edges.slice(0, -1).map((f, i) => {
    const a = Math.max(1, Math.floor((f / nyquist) * (FFT_SIZE / 2)))
    return [a, Math.max(a + 1, Math.ceil((edges[i + 1] / nyquist) * (FFT_SIZE / 2)))]
  })
  const levels = new Float32Array(BARS)
  // 1 秒で表示の高さの 1.5 倍ぶん下がる
  const fall = 1.5 / fps
  const gap = Math.max(1, Math.round(box.width / BARS / 5))
  const barW = box.width / BARS - gap
  const grad = (ctx: OffscreenCanvasRenderingContext2D) => {
    const g = ctx.createLinearGradient(0, box.top + box.height, 0, box.top)
    g.addColorStop(0, wave.color)
    g.addColorStop(1, wave.playedColor)
    return g
  }
  return (ctx, time) => {
    const center = Math.round(time * clip.sampleRate)
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = center - FFT_SIZE / 2 + i
      if (s < 0 || s >= len) continue
      let v = 0
      for (const ch of clip.channels) v += ch[s]
      re[i] = (v / clip.channels.length) * hann[i]
    }
    fft(re, im)
    ctx.fillStyle = grad(ctx)
    for (let b = 0; b < BARS; b++) {
      const [a, e] = ranges[b]
      let sum = 0
      for (let k = a; k < e && k < FFT_SIZE / 2; k++) sum += re[k] * re[k] + im[k] * im[k]
      // 全体の大きさの正弦波が 0dB 付近になるよう、窓を掛けた FFT の振幅（N/4）で割る
      const db = 10 * Math.log10(sum / (FFT_SIZE / 4) ** 2 + 1e-12)
      const level = Math.min(1, Math.max(0, (db + BAR_RANGE_DB) / BAR_RANGE_DB))
      levels[b] = Math.max(level, levels[b] - fall)
      const h = Math.max(2, levels[b] * box.height)
      const x = box.left + b * (barW + gap) + gap / 2
      // 中央に置くときは上下に伸ばす
      const y = wave.position === 'center' ? box.top + (box.height - h) / 2 : box.top + box.height - h
      ctx.fillRect(x, y, barW, h)
    }
  }
}

/** 波形の種類ごとの描き方 */
export function createWavePainter(clip: Clip, wave: VideoWave, box: WaveBox, fps: number): Painter {
  if (wave.style === 'scope') return scope(clip, wave, box)
  if (wave.style === 'scroll') return scroll(clip, wave, box)
  if (wave.style === 'bars') return bars(clip, wave, box, fps)
  return overview(clip, wave, box)
}
