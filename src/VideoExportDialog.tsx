// 動画の書き出しのダイアログ（WeVocalSynth と WeVocal Studio で共通。訳文はアプリの t、作る手順は host を渡す）
import { useEffect, useRef, useState } from 'react'
import { Box, Button, Checkbox, DialogActions, DialogContent, FormControlLabel, LinearProgress, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { enterToSubmit, WindowDialog, pevenFont } from 'pevenmui'
import { VIDEO_EXT, videoLook, type VideoContainer, type VideoExportPrefs, type VideoHost } from './host'
import type { Clip } from 'wevocal-lib'
import { LabeledSelect as Choice } from 'wevocal-lib/react'

/** ダイアログで選んだもの（覚えるもの以外） */
export interface VideoExportSettings {
  fileName: string
  selectionOnly: boolean
  mix: boolean
  /** 背景の画像（なければ単色） */
  image: ImageBitmap | null
  /** 実際に使う形式（覚えたものが作れなければ、もう一方） */
  container: VideoContainer
}

/** このダイアログが使う訳文のキー（アプリの訳文に同じキーを置く） */
export type VideoDialogKey =
  | 'common.cancel'
  | 'video.bars64'
  | 'video.bars512'
  | 'video.bars32'
  | 'video.bars256'
  | 'video.bars128'
  | 'common.selection'
  | 'common.whole'
  | 'export.fileName'
  | 'export.folderBrowse'
  | 'export.folderLabel'
  | 'export.folderUnset'
  | 'export.range'
  | 'export.run'
  | 'export.target'
  | 'export.targetActive'
  | 'export.targetMix'
  | 'video.bars'
  | 'video.bg'
  | 'video.bgImage'
  | 'video.bgImageClear'
  | 'video.bgImageNone'
  | 'video.fit'
  | 'video.fitContain'
  | 'video.fitCover'
  | 'video.gap'
  | 'video.gapNarrow'
  | 'video.gapNormal'
  | 'video.gapWide'
  | 'video.gapWider'
  | 'video.gradient'
  | 'video.played'
  | 'video.posBottom'
  | 'video.posCenter'
  | 'video.position'
  | 'video.preview'
  | 'video.showTitle'
  | 'video.size'
  | 'video.sizePortrait'
  | 'video.sizeSquare'
  | 'video.style'
  | 'video.styleBars'
  | 'video.styleNone'
  | 'video.styleOverview'
  | 'video.styleScope'
  | 'video.styleScroll'
  | 'video.title'
  | 'video.unsupported'
  | 'video.wave'

interface Props {
  /** アプリの訳文（VideoDialogKey のキーを持つ） */
  t: (key: VideoDialogKey, vars?: Record<string, string | number>) => string
  /** 作る手順（createVideoHost） */
  host: VideoHost
  open: boolean
  onClose: () => void
  baseName: string
  hasSelection: boolean
  trackCount: number
  busy: boolean
  progress: number
  /** プレビューに使う音声（選んでいるトラック） */
  previewClip: Clip
  prefs: VideoExportPrefs
  onPrefsChange: (p: VideoExportPrefs) => void
  onExport: (s: VideoExportSettings, win?: Window | null) => void
  /** 保存先のフォルダー（音声の書き出しと同じもの） */
  folder?: { name: string | null; choose: (win: Window | null) => void }
}

/** 色を選ぶ欄 */
function ColorField(p: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
      <input type="color" value={p.value} onChange={(e) => p.onChange(e.target.value)} style={{ width: 32, height: 24, padding: 0, border: 'none', background: 'none' }} />
      <Typography sx={{ fontSize: pevenFont('base') }}>{p.label}</Typography>
    </Box>
  )
}

/** 音声に簡易な波形を付けて動画として書き出す（追加機能「変換」） */
export default function VideoExportDialog(p: Props) {
  const t = p.t
  const { canEncodeVideo, renderPreview } = p.host
  const [s, setS] = useState<Omit<VideoExportSettings, 'image' | 'container'>>({ fileName: '', selectionOnly: false, mix: true })
  const [image, setImage] = useState<{ bitmap: ImageBitmap; name: string } | null>(null)
  const [support, setSupport] = useState<Record<VideoContainer, boolean> | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const pr = p.prefs
  const setPr = (patch: Partial<VideoExportPrefs>) => p.onPrefsChange({ ...pr, ...patch })
  const [width, height] = pr.size.split('x').map(Number)
  const [preview, setPreview] = useState<string | null>(null)

  // 選んだものが変わるたびに、音の大きいところのフレームをプレビューとして描き直す（続けて変えたときは最後の 1 回だけ）
  useEffect(() => {
    if (!p.open) return
    let url: string | null = null
    let cancelled = false
    const timer = setTimeout(() => {
      void renderPreview(p.previewClip, videoLook(pr, image?.bitmap ?? null, s.fileName.trim())).then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (url) URL.revokeObjectURL(url)
    }
  }, [p.open, p.previewClip, pr, image, s.fileName])

  // 開くたびにファイル名と範囲を今の状態に合わせる
  useEffect(() => {
    if (!p.open) return
    setS((v) => ({ ...v, fileName: p.baseName, selectionOnly: p.hasSelection }))
  }, [p.open, p.baseName, p.hasSelection])
  // 作れる形式を調べる（大きさで変わることがある）
  useEffect(() => {
    if (!p.open) return
    void Promise.all([canEncodeVideo('mp4', width, height), canEncodeVideo('webm', width, height)]).then(([mp4, webm]) => setSupport({ mp4, webm }))
  }, [p.open, width, height])
  // 選んでいる形式が作れなければ、もう一方にする
  const container: VideoContainer = support && !support[pr.container] && support[pr.container === 'mp4' ? 'webm' : 'mp4'] ? (pr.container === 'mp4' ? 'webm' : 'mp4') : pr.container
  const ok = !!support?.[container]

  const pickImage = async (f: File) => {
    const bitmap = await createImageBitmap(f)
    setImage((old) => (old?.bitmap.close(), { bitmap, name: f.name }))
  }
  const run = (win?: Window | null) => p.onExport({ ...s, image: image?.bitmap ?? null, container }, win)
  const canRun = !p.busy && ok && !!s.fileName.trim()

  return (
    <WindowDialog
      open={p.open}
      onClose={p.busy ? undefined : p.onClose}
      title={t('video.title')}
      name="exportVideo"
      width={444}
      height={860}
      dialogProps={{ fullWidth: true, maxWidth: 'xs' }}
      onKeyDown={(e) => enterToSubmit(() => run(e.currentTarget.ownerDocument.defaultView), canRun)(e)}
    >
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* プレビュー（音の大きいところのフレーム。縦長の動画は高さを抑える） */}
          <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden', aspectRatio: '16 / 9' }}>
            {preview && <Box component="img" src={preview} alt={t('video.preview')} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
          </Box>
          <ToggleButtonGroup exclusive fullWidth size="small" value={container} onChange={(_, v: VideoContainer | null) => v && setPr({ container: v })}>
            <ToggleButton value="mp4" disabled={!support?.mp4}>
              MP4
            </ToggleButton>
            <ToggleButton value="webm" disabled={!support?.webm}>
              WebM
            </ToggleButton>
          </ToggleButtonGroup>
          {support && !ok && (
            <Typography className="selectable" variant="caption" color="text.secondary" sx={{ mt: '4px !important' }}>
              {t('video.unsupported')}
            </Typography>
          )}
          <Choice
            label={t('video.size')}
            value={pr.size}
            onChange={(size) => setPr({ size })}
            options={[
              ['1280x720', '1280×720'],
              ['1920x1080', '1920×1080'],
              ['1080x1920', t('video.sizePortrait')],
              ['1080x1080', t('video.sizeSquare')],
            ]}
          />
          <Stack direction="row" spacing={1}>
            <Choice
              label={t('video.style')}
              value={pr.style}
              onChange={(style) => setPr({ style })}
              options={[
                ['none', t('video.styleNone')],
                ['scope', t('video.styleScope')],
                ['overview', t('video.styleOverview')],
                ['scroll', t('video.styleScroll')],
                ['bars', t('video.styleBars')],
              ]}
            />
            <Choice
              label={t('video.position')}
              value={pr.position}
              onChange={(position) => setPr({ position })}
              options={[
                ['bottom', t('video.posBottom')],
                ['center', t('video.posCenter')],
              ]}
            />
          </Stack>
          {pr.style === 'bars' && (
            <Choice
              label={t('video.bars')}
              value={pr.bars ?? 64}
              onChange={(bars) => setPr({ bars })}
              options={[
                [32, t('video.bars32')],
                [64, t('video.bars64')],
                [128, t('video.bars128')],
                [256, t('video.bars256')],
                [512, t('video.bars512')],
              ]}
            />
          )}
          {pr.style === 'bars' && (
            <Choice
              label={t('video.gap')}
              value={pr.gap ?? 0.2}
              onChange={(gap) => setPr({ gap })}
              options={[
                [0.05, t('video.gapNarrow')],
                [0.2, t('video.gapNormal')],
                [0.4, t('video.gapWide')],
                [0.6, t('video.gapWider')],
              ]}
            />
          )}
          {pr.style === 'bars' && (
            <FormControlLabel
              sx={{ m: 0 }}
              control={<Checkbox size="small" checked={!!pr.gradient} onChange={(e) => setPr({ gradient: e.target.checked })} />}
              label={<Typography sx={{ fontSize: pevenFont('base') }}>{t('video.gradient')}</Typography>}
            />
          )}
          <Stack direction="row" spacing={1}>
            <ColorField label={t('video.bg')} value={pr.bg} onChange={(bg) => setPr({ bg })} />
            <ColorField label={t('video.wave')} value={pr.wave} onChange={(wave) => setPr({ wave })} />
            <ColorField label={t('video.played')} value={pr.played} onChange={(played) => setPr({ played })} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <input
              ref={input}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void pickImage(f)
                e.target.value = ''
              }}
            />
            <TextField size="small" fullWidth label={t('video.bgImage')} value={image?.name ?? t('video.bgImageNone')} slotProps={{ input: { readOnly: true } }} />
            {image ? (
              <Button variant="outlined" onClick={() => setImage((old) => (old?.bitmap.close(), null))} sx={{ flexShrink: 0 }}>
                {t('video.bgImageClear')}
              </Button>
            ) : (
              <Button variant="outlined" onClick={() => input.current?.click()} sx={{ flexShrink: 0 }}>
                {t('export.folderBrowse')}
              </Button>
            )}
          </Stack>
          {image && (
            <Choice
              label={t('video.fit')}
              value={pr.fit}
              onChange={(fit) => setPr({ fit })}
              options={[
                ['cover', t('video.fitCover')],
                ['contain', t('video.fitContain')],
              ]}
            />
          )}
          {p.trackCount > 1 && (
            <Choice
              label={t('export.target')}
              value={s.mix ? 'mix' : 'active'}
              onChange={(v) => setS({ ...s, mix: v === 'mix' })}
              options={[
                ['mix', t('export.targetMix')],
                ['active', t('export.targetActive')],
              ]}
            />
          )}
          <Choice
            label={t('export.range')}
            value={s.selectionOnly ? 'selection' : 'whole'}
            onChange={(v) => setS({ ...s, selectionOnly: v === 'selection' })}
            options={[
              ['whole', t('common.whole')],
              ['selection', t('common.selection')],
            ]}
            disabled={!p.hasSelection}
          />
          {p.folder && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField size="small" fullWidth label={t('export.folderLabel')} value={p.folder.name ?? t('export.folderUnset')} slotProps={{ input: { readOnly: true } }} />
              <Button variant="outlined" disabled={p.busy} onClick={(e) => p.folder?.choose(e.currentTarget.ownerDocument.defaultView)} sx={{ flexShrink: 0 }}>
                {t('export.folderBrowse')}
              </Button>
            </Stack>
          )}
          <TextField
            size="small"
            label={t('export.fileName')}
            value={s.fileName}
            onChange={(e) => setS({ ...s, fileName: e.target.value })}
            slotProps={{ input: { endAdornment: <Typography color="text.secondary">{VIDEO_EXT[container]}</Typography> } }}
          />
          <FormControlLabel
            sx={{ m: 0 }}
            control={<Checkbox size="small" checked={pr.title} onChange={(e) => setPr({ title: e.target.checked })} />}
            label={<Typography sx={{ fontSize: pevenFont('base') }}>{t('video.showTitle')}</Typography>}
          />
          {p.busy && <LinearProgress variant="determinate" value={p.progress * 100} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={p.onClose} disabled={p.busy}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!canRun} onClick={(e) => run(e.currentTarget.ownerDocument.defaultView)}>
          {t('export.run')}
        </Button>
      </DialogActions>
    </WindowDialog>
  )
}
