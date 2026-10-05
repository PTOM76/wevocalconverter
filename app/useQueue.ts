import { useEffect, useRef, useState } from 'react'
import { convert } from '../src/index'
import type { Settings } from './settings'
import { clearQueue, loadQueue, putItem, signature, toStored } from './persist'

/** `cancelled` はその曲だけ中止したもの（保存するときは待機中として残す） */
export type ItemStatus = 'waiting' | 'running' | 'done' | 'error' | 'cancelled'

/** 一覧の1曲 */
export interface QueueItem {
  id: number
  file: File
  status: ItemStatus
  /** 変換中の進み具合（0〜1） */
  progress: number
  /** 変換した結果 */
  result?: Blob
  /** 書き出した形式の拡張子（.wav など） */
  ext?: string
  error?: string
  /** 結果をダウンロードした（次に開いたときには残さない。画面の一覧からは消さない） */
  saved?: boolean
}

let nextId = 1

/** 複数の曲を1曲ずつ順に変換する */
export function useQueue(settings: Settings) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const abortRef = useRef<AbortController | null>(null)
  /** 変換中の曲と、その曲だけを止めるもの（`cancelItem`） */
  const currentRef = useRef<{ id: number; ac: AbortController } | null>(null)

  // 画面を離れるときは処理を止める
  useEffect(() => () => abortRef.current?.abort(), [])

  // 曲ごとに、最後に書き込んだ内容（`signature`）
  const written = useRef(new Map<number, string>())
  // 前回の一覧を戻す（読み終わる前に足された曲は後ろに並べる）。読み終わるまでは書き込まない
  const [restored, setRestored] = useState(false)
  // 戻すのは 1 回だけ（開発中の StrictMode は 2 回呼ぶ。2 回足すと同じ曲が 2 つ並んだ）
  const restoringRef = useRef(false)
  useEffect(() => {
    if (restoringRef.current) return
    restoringRef.current = true
    // 残さない設定なら戻さず、前に残したものも消す
    if (settings.keepQueue === 'none') {
      void clearQueue().then(() => setRestored(true))
      return
    }
    void loadQueue().then((saved) => {
      nextId = Math.max(nextId, ...saved.map((it) => it.id + 1))
      saved.forEach((it) => written.current.set(it.id, signature(toStored(it, 'all'))))
      // すでに一覧にある曲は足さない
      setItems((list) => [...saved.filter((s) => !list.some((it) => it.id === s.id)), ...list])
      setRestored(true)
    })
    // 起動時の設定で1回だけ決める
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 一覧が変わったら、変わった曲だけ書き込む（変換中の進み具合だけの変化では書かない）。一覧から消えた曲は消す
  useEffect(() => {
    if (!restored) return
    const ids = new Set(items.map((it) => it.id))
    for (const it of items) {
      const s = toStored(it, settings.keepQueue)
      const sig = signature(s)
      if (written.current.get(it.id) === sig) continue
      written.current.set(it.id, sig)
      void putItem(it.id, s)
    }
    // Map は回している途中で消してもよい
    for (const id of written.current.keys()) {
      if (ids.has(id)) continue
      written.current.delete(id)
      void putItem(id, null)
    }
  }, [items, restored, settings.keepQueue])

  const patch = (id: number, p: Partial<QueueItem>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)))

  /** 結果をダウンロードしたことを覚える（次に開いたときには残さない） */
  const markSaved = (id: number) => patch(id, { saved: true })

  const add = (files: File[]) =>
    setItems((list) => [...list, ...files.map((file): QueueItem => ({ id: nextId++, file, status: 'waiting', progress: 0 }))])
  const remove = (id: number) => setItems((list) => list.filter((it) => it.id !== id))
  const clear = () => setItems((list) => list.filter((it) => it.status === 'running'))

  /** 待機中の曲を上から順に変換する。`only` を渡すとその曲だけ（失敗した曲や、設定を変えての変換し直しにも使う） */
  const run = async (only?: number) => {
    if (abortRef.current) return
    if (only === undefined && !itemsRef.current.some((it) => it.status === 'waiting')) return
    // その曲だけのときは、状態によらず1回だけ変換する
    let onlyLeft = only !== undefined
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true)
    try {
      for (;;) {
        // 途中で足された曲も拾うため、毎回一覧から次を探す
        const item =
          only === undefined ? itemsRef.current.find((it) => it.status === 'waiting') : onlyLeft ? itemsRef.current.find((it) => it.id === only) : undefined
        onlyLeft = false
        if (!item || ac.signal.aborted) break
        const one = new AbortController()
        const stop = () => one.abort()
        ac.signal.addEventListener('abort', stop)
        currentRef.current = { id: item.id, ac: one }
        // 変換し直すときは、前の結果のダウンロード済みの印も消す
        patch(item.id, { status: 'running', progress: 0, error: undefined, saved: undefined })
        try {
          const r = await convert(item.file, {
            format: settings.format,
            wavFormat: settings.wavFormat,
            kbps: settings.kbps,
            sampleRate: settings.sampleRate || null,
            mono: settings.mono,
            onProgress: (p) => patch(item.id, { progress: p }),
            signal: one.signal,
          })
          patch(item.id, { status: 'done', progress: 1, result: r.blob, ext: r.ext })
        } catch (e) {
          // 一覧ごと中止したときは待機中に戻す（もう一度「すべて変換」で続きから）。その曲だけ中止したら中止にして次へ
          if (ac.signal.aborted) patch(item.id, { status: 'waiting', progress: 0 })
          else if (one.signal.aborted) patch(item.id, { status: 'cancelled', progress: 0 })
          else patch(item.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
        } finally {
          ac.signal.removeEventListener('abort', stop)
          currentRef.current = null
        }
      }
    } finally {
      abortRef.current = null
      setRunning(false)
    }
  }

  const cancel = () => abortRef.current?.abort()
  /** 曲 `id` だけを中止する。変換中なら止めて次の曲へ、待機中なら飛ばす */
  const cancelItem = (id: number) => {
    if (currentRef.current?.id === id) currentRef.current.ac.abort()
    else patch(id, { status: 'cancelled', progress: 0 })
  }

  return { items, running, add, remove, clear, run, cancel, cancelItem, markSaved }
}
