import { useEffect, useRef, useState } from 'react'
import { Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faXmark } from '@fortawesome/free-solid-svg-icons'
import { canEncodeVideo, type VideoContainer, type VideoLook } from '../src/index'
import { t, type MessageKey } from './i18n'
import type { Settings, VideoSize } from './settings'
import { OptionSelect } from './OptionSelect'

export const isVideo = (f: Settings['format']): f is VideoContainer => f === 'webm' || f === 'mp4'

/** 設定と背景の画像から、動画の見た目を作る。曲名はファイル名（拡張子を除く） */
export function videoLook(s: Settings, image: ImageBitmap | null, fileName: string): VideoLook {
  const [width, height] = s.videoSize.split('x').map(Number)
  return {
    width,
    height,
    background: { color: s.videoBg, image, fit: s.videoFit },
    wave: { style: s.videoWaveStyle, color: s.videoWave, playedColor: s.videoPlayed, position: s.videoWavePosition, height: 0.25, gradient: s.videoGradient, bars: s.videoBars },
    title: s.videoTitle ? fileName.replace(/\.[^.]+$/, '') : '',
    titleColor: '#ffffff',
  }
}

/** このブラウザで作れる動画の入れ物（調べ終わるまでは null） */
export function useVideoSupport(): Record<VideoContainer, boolean> | null {
  const [support, setSupport] = useState<Record<VideoContainer, boolean> | null>(null)
  useEffect(() => {
    void Promise.all([canEncodeVideo('webm'), canEncodeVideo('mp4')]).then(([webm, mp4]) => setSupport({ webm, mp4 }))
  }, [])
  return support
}

/** 背景の画像。ページを閉じると消える（設定には残さない） */
export function useBackgroundImage() {
  const [image, setImage] = useState<{ bitmap: ImageBitmap; name: string } | null>(null)
  const pick = async (file: File) => {
    const bitmap = await createImageBitmap(file)
    setImage((old) => {
      old?.bitmap.close()
      return { bitmap, name: file.name }
    })
  }
  const clear = () =>
    setImage((old) => {
      old?.bitmap.close()
      return null
    })
  return { image, pick, clear }
}

const SIZE_OPTIONS: [VideoSize, MessageKey][] = [
  ['1280x720', 'video.size720'],
  ['1920x1080', 'video.size1080'],
  ['1080x1920', 'video.sizePortrait'],
  ['1080x1080', 'video.sizeSquare'],
]
const STYLE_OPTIONS: [Settings['videoWaveStyle'], MessageKey][] = [
  ['scope', 'video.styleScope'],
  ['overview', 'video.styleOverview'],
  ['scroll', 'video.styleScroll'],
  ['bars', 'video.styleBars'],
]
type BarsOption = '32' | '64' | '128'
const BARS_OPTIONS: [BarsOption, MessageKey][] = [
  ['32', 'video.bars32'],
  ['64', 'video.bars64'],
  ['128', 'video.bars128'],
]
const POSITION_OPTIONS: [Settings['videoWavePosition'], MessageKey][] = [
  ['bottom', 'video.posBottom'],
  ['center', 'video.posCenter'],
]
const FIT_OPTIONS: [Settings['videoFit'], MessageKey][] = [
  ['cover', 'video.fitCover'],
  ['contain', 'video.fitContain'],
]

/** 色を選ぶ欄（ラベル付き） */
function ColorInput(p: { label: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>{p.label}</Typography>
      <input type="color" value={p.value} disabled={p.disabled} onChange={(e) => p.onChange(e.target.value)} style={{ width: 32, height: 24, padding: 0, border: 'none', background: 'none' }} />
    </Box>
  )
}

/** 形式が動画のときの設定の帯 */
export function VideoOptionsBar(p: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  disabled: boolean
  bg: ReturnType<typeof useBackgroundImage>
}) {
  const { settings: s, update, disabled, bg } = p
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <OptionSelect label={t('video.size')} value={s.videoSize} disabled={disabled} options={SIZE_OPTIONS} onChange={(videoSize) => update({ videoSize })} />
      <OptionSelect label={t('video.style')} value={s.videoWaveStyle} disabled={disabled} options={STYLE_OPTIONS} onChange={(videoWaveStyle) => update({ videoWaveStyle })} />
      <OptionSelect label={t('video.position')} value={s.videoWavePosition} disabled={disabled} options={POSITION_OPTIONS} onChange={(videoWavePosition) => update({ videoWavePosition })} />
      <ColorInput label={t('video.bg')} value={s.videoBg} disabled={disabled} onChange={(videoBg) => update({ videoBg })} />
      <ColorInput label={t('video.wave')} value={s.videoWave} disabled={disabled} onChange={(videoWave) => update({ videoWave })} />
      <ColorInput label={t('video.played')} value={s.videoPlayed} disabled={disabled} onChange={(videoPlayed) => update({ videoPlayed })} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void bg.pick(f)
            e.target.value = ''
          }}
        />
        <Button size="small" disabled={disabled} startIcon={<FontAwesomeIcon icon={faImage} />} onClick={() => input.current?.click()} sx={{ maxWidth: 200 }}>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bg.image ? bg.image.name : t('video.bgImage')}
          </Box>
        </Button>
        {bg.image && (
          <>
            <Button size="small" disabled={disabled} onClick={bg.clear} aria-label={t('video.bgImageClear')} sx={{ minWidth: 0 }}>
              <FontAwesomeIcon icon={faXmark} />
            </Button>
            <OptionSelect label="" value={s.videoFit} disabled={disabled} options={FIT_OPTIONS} onChange={(videoFit) => update({ videoFit })} />
          </>
        )}
      </Box>
      {s.videoWaveStyle === 'bars' && (
        <OptionSelect label={t('video.bars')} value={String(s.videoBars) as BarsOption} disabled={disabled} options={BARS_OPTIONS} onChange={(v) => update({ videoBars: Number(v) })} />
      )}
      {s.videoWaveStyle === 'bars' && (
        <FormControlLabel
          control={<Checkbox size="small" checked={s.videoGradient} disabled={disabled} onChange={(e) => update({ videoGradient: e.target.checked })} />}
          label={t('video.gradient')}
          slotProps={{ typography: { sx: { fontSize: 13 } } }}
          sx={{ mr: 0 }}
        />
      )}
      <FormControlLabel
        control={<Checkbox size="small" checked={s.videoTitle} disabled={disabled} onChange={(e) => update({ videoTitle: e.target.checked })} />}
        label={t('video.title')}
        slotProps={{ typography: { sx: { fontSize: 13 } } }}
        sx={{ mr: 0 }}
      />
    </>
  )
}
