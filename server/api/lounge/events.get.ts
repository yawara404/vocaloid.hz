/**
 * GET /api/lounge/events
 * 共有チャット「AI ラウンジ」の新着と、店主の状態（考え中か）を SSE で配る。
 */
import { createEventStream } from 'h3'
import { listLoungeMessages, parseLoungeCursor } from '../../utils/lounge'
import { getLoungeAiState } from '../../utils/lounge-ai'

/** 新着確認の間隔（ミリ秒） */
const POLL_INTERVAL = 1000
/** 無通信でも接続を切らさないためのハートビート間隔（ミリ秒） */
const HEARTBEAT_INTERVAL = 20_000

export default defineEventHandler((event) => {
  const stream = createEventStream(event)
  let cursor = parseLoungeCursor(getQuery(event).after)
  let closed = false
  let polling = false
  let lastStatus = ''

  async function poll(): Promise<void> {
    if (closed || polling) return
    polling = true
    try {
      for (const message of listLoungeMessages(cursor)) {
        await stream.push(JSON.stringify(message))
        cursor = message.id
      }

      // 店主の状態は変わったときだけ配る（最初の 1 回はヘッダー確定も兼ねる）
      const status = JSON.stringify(getLoungeAiState())
      if (status !== lastStatus) {
        lastStatus = status
        await stream.push({ event: 'status', data: status })
      }
    }
    finally {
      polling = false
    }
  }

  /**
   * 名前付きイベントなのでクライアントの onmessage は発火しない。
   * 無通信が続いてもプロキシに切られないためのキープアライブ。
   */
  async function heartbeat(): Promise<void> {
    if (closed) return
    await stream.push({ event: 'ping', data: '' })
  }

  const poller = setInterval(() => { void poll().catch(() => {}) }, POLL_INTERVAL)
  const beat = setInterval(() => { void heartbeat().catch(() => {}) }, HEARTBEAT_INTERVAL)

  stream.onClosed(() => {
    closed = true
    clearInterval(poller)
    clearInterval(beat)
  })

  const sending = stream.send()
  void poll().catch(() => {})

  return sending
})
