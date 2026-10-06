import type { Clip } from 'wevocal-lib'

/** 背景（単色、または静止画） */
export interface VideoBackground {
  color: string
  /** null なら単色だけ */
  image: ImageBitmap | null
  /** cover: 画面いっぱいに切り抜く、contain: 全体を収める（余りは単色） */
  fit: 'cover' | 'contain'
}

/** 波形の見た目（今は「全体の波形と再生位置の線」だけ） */
export interface VideoWave {
  /** まだ再生していないところの色 */
  color: string
  /** 再生したところと再生位置の線の色 */
  playedColor: string
  position: 'bottom' | 'center'
  /** 画面の高さに対する割合（0〜1） */
  height: number
}

/** 描画の設定 */
export interface VideoLook {
  width: number
  height: number
  background: VideoBackground
  wave: VideoWave
  /** 空なら曲名を入れない */
  title: string
  titleColor: string
}

/** 波形の左右の余白（画面の幅に対する割合） */
const MARGIN = 0.05

/** 列ごとの最小値と最大値（全チャンネルを通す） */
function columnPeaks(clip: Clip, columns: number): { min: Float32Array; max: Float32Array } {
  const len = clip.channels[0].length
  const min = new Float32Array(columns)
  const max = new Float32Array(columns)
  for (let c = 0; c < columns; c++) {
    const s = Math.floor((c * len) / columns)
    const e = Math.max(s + 1, Math.floor(((c + 1) * len) / columns))
    let lo = 0
    let hi = 0
    for (const ch of clip.channels) {
      for (let i = s; i < e && i < len; i++) {
        const v = ch[i]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    min[c] = lo
    max[c] = hi
  }
  return { min, max }
}

function drawBackground(ctx: OffscreenCanvasRenderingContext2D, look: VideoLook) {
  const { width: w, height: h, background: bg } = look
  ctx.fillStyle = bg.color
  ctx.fillRect(0, 0, w, h)
  if (!bg.image) return
  const iw = bg.image.width
  const ih = bg.image.height
  const scale = bg.fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(bg.image, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function drawTitle(ctx: OffscreenCanvasRenderingContext2D, look: VideoLook) {
  if (!look.title) return
  const size = Math.round(Math.min(look.width, look.height) * 0.05)
  ctx.font = `bold ${size}px system-ui, sans-serif`
  ctx.fillStyle = look.titleColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 波形が下にあるときは中央、中央にあるときは上に置く
  const y = look.wave.position === 'bottom' ? look.height * 0.4 : look.height * 0.15
  ctx.fillText(look.title, look.width / 2, y, look.width * (1 - MARGIN * 2))
}

/** 波形の帯の上端と高さ */
function waveBox(look: VideoLook): { top: number; h: number } {
  const h = look.height * look.wave.height
  const top = look.wave.position === 'bottom' ? look.height * 0.95 - h : (look.height - h) / 2
  return { top, h }
}

function drawWave(ctx: OffscreenCanvasRenderingContext2D, look: VideoLook, peaks: { min: Float32Array; max: Float32Array }, color: string) {
  const { top, h } = waveBox(look)
  const left = Math.round(look.width * MARGIN)
  const mid = top + h / 2
  ctx.fillStyle = color
  for (let c = 0; c < peaks.min.length; c++) {
    const y0 = mid - peaks.max[c] * (h / 2)
    const y1 = mid - peaks.min[c] * (h / 2)
    ctx.fillRect(left + c, y0, 1, Math.max(1, y1 - y0))
  }
}

/** フレームを描く。背景と波形は先に 2 枚に描いておき、フレームごとには重ねるだけにする */
export class FrameRenderer {
  readonly canvas: OffscreenCanvas
  private readonly ctx: OffscreenCanvasRenderingContext2D
  private readonly base: OffscreenCanvas
  private readonly played: OffscreenCanvas
  private readonly look: VideoLook

  constructor(clip: Clip, look: VideoLook) {
    this.look = look
    const { width: w, height: h } = look
    this.canvas = new OffscreenCanvas(w, h)
    this.ctx = this.canvas.getContext('2d')!
    const peaks = columnPeaks(clip, Math.round(w * (1 - MARGIN * 2)))
    this.base = new OffscreenCanvas(w, h)
    const b = this.base.getContext('2d')!
    drawBackground(b, look)
    drawTitle(b, look)
    drawWave(b, look, peaks, look.wave.color)
    this.played = new OffscreenCanvas(w, h)
    drawWave(this.played.getContext('2d')!, look, peaks, look.wave.playedColor)
  }

  /** 再生位置（0〜1）のフレームを描く */
  draw(t: number) {
    const { ctx, look } = this
    const left = Math.round(look.width * MARGIN)
    const x = left + Math.round(look.width * (1 - MARGIN * 2) * t)
    ctx.drawImage(this.base, 0, 0)
    if (x > left) ctx.drawImage(this.played, left, 0, x - left, look.height, left, 0, x - left, look.height)
    const { top, h } = waveBox(look)
    ctx.fillStyle = look.wave.playedColor
    ctx.fillRect(x - 1, top, 2, h)
  }
}
