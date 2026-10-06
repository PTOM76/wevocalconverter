import type { Clip } from 'wevocal-lib'
import { createWavePainter } from './waves'

/** 背景（単色、または静止画） */
export interface VideoBackground {
  color: string
  /** null なら単色だけ */
  image: ImageBitmap | null
  /** cover: 画面いっぱいに切り抜く、contain: 全体を収める（余りは単色） */
  fit: 'cover' | 'contain'
}

/** 波形の種類。scope: その瞬間の波形（オシロスコープ）、overview: 全体の波形と再生位置の線、scroll: 再生位置の周りの波形が流れる、bars: 音量の棒（周波数ごと） */
export type WaveStyle = 'scope' | 'overview' | 'scroll' | 'bars'

/** 波形の見た目 */
export interface VideoWave {
  style: WaveStyle
  /** まだ再生していないところの色（音量の棒のグラデーションでは下の端の色） */
  color: string
  /** 再生したところと再生位置の線の色（音量の棒では棒の色、グラデーションなら上の端の色） */
  playedColor: string
  position: 'bottom' | 'center'
  /** 画面の高さに対する割合（0〜1） */
  height: number
  /** 音量の棒を、下の端の `color` から上の端の `playedColor` へのグラデーションにする（偽なら `playedColor` の単色） */
  gradient?: boolean
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

/** 波形の帯の位置（左右の余白は画面の幅の 5%） */
export interface WaveBox {
  left: number
  top: number
  width: number
  height: number
}

function waveBox(look: VideoLook): WaveBox {
  const h = look.height * look.wave.height
  const left = Math.round(look.width * 0.05)
  const top = look.wave.position === 'bottom' ? look.height * 0.95 - h : (look.height - h) / 2
  return { left, top, width: look.width - left * 2, height: h }
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
  ctx.fillText(look.title, look.width / 2, y, look.width * 0.9)
}

/** フレームを描く。背景と曲名は先に 1 枚に描いておき、フレームごとには重ねて波形を描くだけにする */
export class FrameRenderer {
  readonly canvas: OffscreenCanvas
  private readonly ctx: OffscreenCanvasRenderingContext2D
  private readonly base: OffscreenCanvas
  private readonly paint: (ctx: OffscreenCanvasRenderingContext2D, time: number) => void

  constructor(clip: Clip, look: VideoLook, fps: number) {
    const { width: w, height: h } = look
    this.canvas = new OffscreenCanvas(w, h)
    this.ctx = this.canvas.getContext('2d')!
    this.base = new OffscreenCanvas(w, h)
    const b = this.base.getContext('2d')!
    drawBackground(b, look)
    drawTitle(b, look)
    this.paint = createWavePainter(clip, look.wave, waveBox(look), fps)
  }

  /** 再生位置（秒）のフレームを描く */
  draw(time: number) {
    this.ctx.drawImage(this.base, 0, 0)
    this.paint(this.ctx, time)
  }
}
