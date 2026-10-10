import { useEffect, useState } from 'react'
import { Box, Button, Link, Paper, Snackbar, Stack, Typography, useColorScheme } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileArrowUp, faFolderOpen, faPlus } from '@fortawesome/free-solid-svg-icons'
import { AboutDialog, AppHeader, LicensesDialog, PevenLabels, ShortcutsDialog, useFilesDrop, useFilesPicker, setUiScale, FULL_HEIGHT, useLeaveGuard, useMobileLayout, WindowModeContext, autoWindowMode, type MenuGroup } from 'pevenmui'
import { UpdatePrompt, checkForUpdate, formatBuild, promptUpdate } from 'pevenmui/pwa'
import { configureFileAccess } from 'pevenmui/web'
import { AUDIO_ACCEPT, canEncodeAac, canEncodeOpus, downloadBlob, isLossy, type ExportFormat } from 'wevocal-lib'
import type { VideoContainer } from '../src/index'
import { openExternal, USER_GUIDE_URL } from './links'
import { licenseEntries } from './licenses'
import { i18n, LangContext, resolveLang, setLang, t, type MessageKey } from './i18n'
import { QueueList } from './QueueList'
import SettingsDialog from './SettingsDialog'
import { useSettings } from './settings'
import { useQueue, type QueueItem } from './useQueue'
import { makeZip } from './zip'
import { OptionSelect } from './OptionSelect'
import { VideoOptionsBar, VideoPreview, isVideo, useBackgroundImage, useVideoSupport } from './video'
import { app } from './appConfig'

/** 今動いている版（バージョンとコミット） */
const APP_BUILD = formatBuild(__APP_VERSION__, __APP_COMMIT__)

/** アプリのアイコン（public/icon.svg）。GitHub Pages ではサブパスで配信されるため BASE_URL から組み立てる */
const AppIcon = ({ size }: { size: number }) => <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={size} height={size} style={{ display: 'block' }} />

const FORMAT_OPTIONS: [ExportFormat | VideoContainer, MessageKey][] = [
  ['wav', 'opt.formatWav'],
  ['flac', 'opt.formatFlac'],
  ['mp3', 'opt.formatMp3'],
  ['opus', 'opt.formatOpus'],
  ['aac', 'opt.formatAac'],
  ['webm', 'opt.formatWebm'],
  ['mp4', 'opt.formatMp4'],
]
/** サンプルレートの選択肢（0 は元のまま） */
const RATE_OPTIONS: ['0' | '22050' | '32000' | '44100' | '48000', MessageKey][] = [
  ['0', 'opt.rateOriginal'],
  ['22050', 'opt.rate22050'],
  ['32000', 'opt.rate32000'],
  ['44100', 'opt.rate44100'],
  ['48000', 'opt.rate48000'],
]
/** ファイルの大きさの上限の選択肢（MB。0 は指定しない） */
const SIZE_OPTIONS: [string, MessageKey | { text: string }][] = [['0', 'opt.sizeNone'], ...[1, 5, 8, 10, 25, 50, 100].map((n): [string, { text: string }] => [String(n), { text: `${n} MB` }])]
const CHANNEL_OPTIONS: ['original' | 'mono', MessageKey][] = [
  ['original', 'opt.channelsOriginal'],
  ['mono', 'opt.channelsMono'],
]

/** 拡張子を除いたファイル名 */
const baseName = (name: string) => name.replace(/\.[^.]+$/, '')
const outName = (item: QueueItem) => `${baseName(item.file.name)}${item.ext ?? '.wav'}`

export default function App() {
  const [settings, updateSettings] = useSettings()
  // Opus は常に 48kHz なので、サンプルレートは選べなくする
  const rateNote = settings.format === 'opus' ? t('opt.rateOpus') : undefined
  // 子の描画より先に言語を切り替えておく（t() は描画中に参照される）
  const lang = resolveLang(settings.language)
  setLang(lang)
  // 設定のテーマ（既定 / ライト / ダーク）を反映する
  const { setMode } = useColorScheme()
  useEffect(() => setMode(settings.theme), [settings.theme, setMode])
  useEffect(() => setUiScale(settings.uiScale), [settings.uiScale])
  const mobile = useMobileLayout()

  const [toast, setToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 設定を開いたまま、もう一度「設定」を押したら、別の窓で開いている設定画面を手前に出す
  const [settingsFocus, setSettingsFocus] = useState(0)
  const openSettings = () => {
    setSettingsOpen(true)
    setSettingsFocus((n) => n + 1)
  }
  const [aboutOpen, setAboutOpen] = useState(false)
  const [licensesOpen, setLicensesOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const bg = useBackgroundImage()
  const q = useQueue(settings, bg.image?.bitmap ?? null)
  // 動画は、このブラウザで作れる入れ物だけを選択肢に表示する（調べ終わるまでは選んでいるものも残す）
  const videoSupport = useVideoSupport()
  // Opus と AAC も WebCodecs で作るので、書き出せるときだけ表示する
  const [codecSupport, setCodecSupport] = useState<Record<'opus' | 'aac', boolean> | null>(null)
  useEffect(() => void Promise.all([canEncodeOpus(2), canEncodeAac(2)]).then(([opus, aac]) => setCodecSupport({ opus, aac })), [])
  const support = (f: ExportFormat | VideoContainer): boolean | undefined =>
    isVideo(f) ? videoSupport?.[f] : f === 'opus' || f === 'aac' ? codecSupport?.[f] : true
  const formatOptions = FORMAT_OPTIONS.filter(([f]) => support(f) ?? f === settings.format)
  const video = isVideo(settings.format)
  useEffect(() => {
    if (support(settings.format) === false) updateSettings({ format: 'mp3' })
  }, [videoSupport, codecSupport, settings.format])
  // 開く画面はフォルダを覚える。最近使用したファイルの一覧はないので記録しない
  configureFileAccess({ rememberFolder: true, startFolder: 'music', recentFiles: false, pickerMode: 'auto' })
  const picker = useFilesPicker(AUDIO_ACCEPT, q.add, t('file.audioType'))
  // 変換中に閉じようとしたら確認する
  useLeaveGuard(q.running, () => true)
  const hasWaiting = q.items.some((it) => it.status === 'waiting')
  const done = q.items.filter((it) => it.result)

  const openFiles = picker.open
  // ダウンロードした結果は、次に開いたときには残さない（画面の一覧からは消さない）
  const save = (item: QueueItem) => {
    if (!item.result) return
    downloadBlob(item.result, outName(item))
    q.markSaved(item.id)
  }
  // 変換済みのものを1つの ZIP にまとめて保存する
  const saveAll = async () => {
    const files = done.flatMap((it) => (it.result ? [{ name: outName(it), blob: it.result }] : []))
    if (!files.length) return
    downloadBlob(await makeZip(files), `${app.id}.zip`)
    for (const it of done) q.markSaved(it.id)
  }

  // ページのどこにドロップしても一覧に足す
  useFilesDrop(q.add)
  // Ctrl+O で追加（ダイアログを開いているときは効かせない）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && !document.querySelector('[role="dialog"]')) {
        e.preventDefault()
        picker.open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 新しい版があれば、右下の通知（UpdatePrompt）からそのまま更新できる。ここでは結果だけを知らせる
  const checkUpdate = () =>
    void checkForUpdate().then((r) => {
      if (r.kind === 'found') return promptUpdate(r.build)
      const l = i18n.labels(lang)
      setToast({ latest: l.updateLatest, unsupported: l.updateUnsupported, failed: l.updateFailed }[r.kind])
    })
  const runEntries = [
    { label: t('menu.runAll'), disabled: q.running || !hasWaiting, onClick: () => void q.run() },
    { label: t('menu.clear'), disabled: !q.items.length, onClick: q.clear },
  ]
  const guide = { label: t('menu.userGuide'), onClick: () => openExternal(USER_GUIDE_URL) }
  // WeVocalSynth と同じ並び。設定はファイルに、更新の確認はヘルプに置く
  const menus: MenuGroup[] = [
    {
      label: t('menu.file'),
      accessKey: 'F',
      entries: [
        { label: t('menu.add'), shortcut: 'Ctrl+O', onClick: openFiles },
        { divider: true },
        { label: t('menu.saveAll'), disabled: !done.length, onClick: () => void saveAll() },
        { divider: true },
        { label: t('menu.settings'), onClick: openSettings },
      ],
    },
    { label: t('menu.tools'), accessKey: 'T', entries: runEntries },
    {
      label: t('menu.help'),
      accessKey: 'H',
      entries: [
        guide,
        { label: t('menu.shortcuts'), onClick: () => setShortcutsOpen(true) },
        { divider: true },
        { label: t('menu.checkUpdate'), onClick: checkUpdate },
        { label: t('menu.licenses'), onClick: () => setLicensesOpen(true) },
        { label: t('menu.about'), onClick: () => setAboutOpen(true) },
      ],
    },
  ]
  // スマホの ⋮ は WeVocalSynth と同じく、設定をヘルプに置き、ショートカット一覧は出さない
  const mobileMenus: MenuGroup[] = [
    {
      label: t('menu.file'),
      entries: [
        { label: t('menu.add'), onClick: openFiles },
        { label: t('menu.saveAll'), disabled: !done.length, onClick: () => void saveAll() },
      ],
    },
    { label: t('menu.tools'), entries: runEntries },
    {
      label: t('menu.help'),
      entries: [
        { label: t('menu.settings'), onClick: openSettings },
        guide,
        { label: t('menu.checkUpdate'), onClick: checkUpdate },
        { label: t('menu.licenses'), onClick: () => setLicensesOpen(true) },
        { label: t('menu.about'), onClick: () => setAboutOpen(true) },
      ],
    },
  ]
  return (
    <LangContext.Provider value={lang}>
      <PevenLabels.Provider value={i18n.labels(lang)}>
      <WindowModeContext.Provider value={settings.dialogWindow === 'auto' ? autoWindowMode() : settings.dialogWindow}>
        <Box sx={{ height: FULL_HEIGHT, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
          <AppHeader icon={<AppIcon size={16} />} menus={mobile ? mobileMenus : menus} />
          {picker.input}

          {/* 操作の帯: 出力の形式、サンプルレート、チャンネルと、一覧への操作 */}
          <Paper square elevation={0} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 1, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
            <OptionSelect label={t('opt.format')} value={settings.format} disabled={q.running} options={formatOptions} onChange={(format) => updateSettings({ format })} />
            {video ? (
              <VideoOptionsBar settings={settings} update={updateSettings} disabled={q.running} bg={bg} />
            ) : (
              <>
                <OptionSelect
                  label={t('opt.rate')}
                  value={String(settings.sampleRate) as (typeof RATE_OPTIONS)[number][0]}
                  disabled={q.running || settings.format === 'opus'}
                  options={RATE_OPTIONS}
                  onChange={(v) => updateSettings({ sampleRate: Number(v) })}
                  note={rateNote}
                />
                {isLossy(settings.format) && (
                  <OptionSelect
                    label={t('opt.size')}
                    value={String(settings.maxMB)}
                    disabled={q.running}
                    options={SIZE_OPTIONS}
                    onChange={(v) => updateSettings({ maxMB: Number(v) })}
                    note={settings.maxMB ? t('opt.sizeNote') : undefined}
                  />
                )}
                <OptionSelect label={t('opt.channels')} value={settings.mono ? 'mono' : 'original'} disabled={q.running} options={CHANNEL_OPTIONS} onChange={(v) => updateSettings({ mono: v === 'mono' })} />
              </>
            )}
            <Box sx={{ display: 'flex', gap: 1, ml: mobile ? 0 : 'auto' }}>
              <Button size="small" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={openFiles}>
                {t('queue.add')}
              </Button>
              {q.running ? (
                <Button size="small" variant="outlined" onClick={q.cancel}>
                  {t('queue.cancel')}
                </Button>
              ) : (
                <Button size="small" variant="contained" disabled={!hasWaiting} onClick={() => void q.run()}>
                  {t('queue.runAll')}
                </Button>
              )}
              <Button size="small" disabled={!done.length} startIcon={<FontAwesomeIcon icon={faDownload} />} onClick={() => void saveAll()}>
                {t('queue.saveAll')}
              </Button>
            </Box>
          </Paper>

          <Box component="main" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {video && <VideoPreview settings={settings} image={bg.image?.bitmap ?? null} file={q.items[0]?.file} />}
            {q.items.length ? (
              <QueueList items={q.items} busy={q.running} onSave={save} onConvert={(id) => void q.run(id)} onRemove={q.remove} onCancel={q.cancelItem} />
            ) : (
              // ファイルを追加する前の画面（WeVocalSynth の EmptyState と同じ形）
              <Stack spacing={2} sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <Box sx={{ color: 'text.secondary', fontSize: 40 }}>
                  <FontAwesomeIcon icon={faFileArrowUp} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t('empty.formats')}
                </Typography>
                <Button variant="contained" startIcon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={openFiles}>
                  {t('empty.choose')}
                </Button>
              </Stack>
            )}
          </Box>
        </Box>

        <SettingsDialog open={settingsOpen} focusSignal={settingsFocus} onClose={() => setSettingsOpen(false)} settings={settings} onChange={updateSettings} notify={setToast} />
        <LicensesDialog open={licensesOpen} onClose={() => setLicensesOpen(false)} title={t('menu.licenses')} intro={t('licenses.intro')} entries={licenseEntries(app.repository)} />
        <AboutDialog
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
          icon={<AppIcon size={56} />}
          rows={[
            [t('about.version'), <span className="selectable">{APP_BUILD}</span>],
            [t('about.author'), app.author],
            [
              'ソースコード',
              <Link className="selectable" href={app.repository} target="_blank" rel="noopener noreferrer">
                {app.repository.replace('https://', '')}
              </Link>,
            ],
            [t('about.license'), t('about.licenseText')],
          ]}
        />
        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
          title={t('menu.shortcuts')}
          rows={[
            ['Ctrl+O', t('shortcuts.open')],
            [t('shortcuts.drop'), t('shortcuts.dropDesc')],
            ['Alt / F10', t('shortcuts.menu')],
          ]}
        />
        <UpdatePrompt build={APP_BUILD} devUpdates={settings.devUpdates} />
        <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
      </WindowModeContext.Provider>
      </PevenLabels.Provider>
    </LangContext.Provider>
  )
}
