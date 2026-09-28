/**
 * GET /api/board/events
 * 掲示板のリアルタイムチャット用 Server-Sent Events。
 * 1 秒ごとに新着メッセージを確認し、あれば `data:` として push する。
 */
import { createEventStream } from 'h3'
import { listBoardMessages, parseBoardCursor } from '../../utils/board'

/** 新着確認の間隔（ミリ秒） */
const POLL_INTERVAL = 1000
/** 無通信でも接続を切らさないためのハートビート間隔（ミリ秒） */
const HEARTBEAT_INTERVAL = 20_000

export default defineEventHandler((event) => {
  const stream = createEventStream(event)
  let cursor = parseBoardCursor(getQuery(event).after)
  let closed = false
  let polling = false

  async function poll(): Promise<void> {
    if (closed || polling) return
    polling = true
    try {
      for (const message of listBoardMessages(cursor)) {
        await stream.push(JSON.stringify(message))
        cursor = message.id
      }
    }
    finally {
      polling = false
    }
  }

  /**
   * 名前付きイベントなのでクライアントの onmessage は発火しない。
   * 最初の 1 回はこの書き込みでレスポンスヘッダーを確定させ、
   * EventSource を即座に open 状態にする（無通信時のヘッダー未送出を防ぐ）。
   * 以降はプロキシに切られないためのキープアライブとして送り続ける。
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

  // send() は同期部分でヘッダーをセットし、ストリームを res へ pipe する。
  // そのあと heartbeat を 1 回書くことで、初回チャンクと同時にヘッダーが flush される。
  const sending = stream.send()
  void heartbeat().catch(() => {})

  return sending
})
