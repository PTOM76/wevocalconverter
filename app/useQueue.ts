import { useJobQueue, type JobItem } from 'pevenmui'
import { convert, convertVideo, type ConvertResult } from '../src/index'
import type { Settings } from './settings'
import { isVideo, videoLook } from './video'
import { clearQueue, loadQueue, putItem, signature, toStored } from './persist'

/** 一覧の1曲 */
export interface QueueItem extends JobItem {
  /** 変換した結果 */
  result?: Blob
  /** 結果をダウンロードした（次に開いたときには残さない。画面の一覧からは消さない） */
  saved?: boolean
}

/** 複数の曲を1曲ずつ順に変換する（一覧の操作と保存は PevenMUI の useJobQueue） */
export function useQueue(settings: Settings, bgImage: ImageBitmap | null) {
  const q = useJobQueue<QueueItem, ReturnType<typeof toStored>>({
    process: async (item, { signal, onProgress }) => {
      const common = { onProgress, signal }
      const format = settings.format
      const r: ConvertResult = isVideo(format)
        ? await convertVideo(item.file, { ...videoLook(settings, bgImage, item.file.name), container: format, fps: 30, kbps: settings.kbps, ...common })
        : await convert(item.file, {
            format,
            wavFormat: settings.wavFormat,
            kbps: settings.kbps,
            sampleRate: settings.sampleRate || null,
            mono: settings.mono,
            ...common,
          })
      return { result: r.blob, ext: r.ext }
    },
    persist: {
      // 起動時の設定で1回だけ決める
      enabled: settings.keepQueue !== 'none',
      mode: settings.keepQueue,
      load: loadQueue,
      clear: clearQueue,
      toStored: (it) => toStored(it, settings.keepQueue),
      signature,
      put: putItem,
    },
  })

  /** 結果をダウンロードしたことを覚える（次に開いたときには残さない） */
  const markSaved = (id: number) => q.patch(id, { saved: true })

  return { items: q.items, running: q.running, add: q.add, remove: q.remove, clear: q.clear, run: q.run, cancel: q.cancel, cancelItem: q.cancelItem, markSaved }
}
