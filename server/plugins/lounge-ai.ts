/**
 * server/plugins/lounge-ai.ts
 * ---------------------------------------------------------------
 * 共有チャット「AI ラウンジ」の店主（gemma）を回す。
 *
 * 10 秒ごとに番が来ていないか確かめ、来ていれば返事を作って部屋へ書き込む。
 * 間隔は runtimeConfig.loungeAiIntervalMs（既定 2 分）。
 * リクエストに依存しないので、誰もページを開いていなくても話が進む。
 */
import { runLoungeAiTurn } from '../utils/lounge-ai'

const CHECK_INTERVAL_MS = 10_000
const TIMER_KEY = '__vocaloidHzLoungeAiTimer'

interface LoungeAiTimerHolder {
  [TIMER_KEY]?: ReturnType<typeof setInterval>
}

const holder = globalThis as unknown as LoungeAiTimerHolder

export default defineNitroPlugin(() => {
  // dev の HMR でプラグインが再評価されてもタイマーが増えないようにする
  if (holder[TIMER_KEY]) clearInterval(holder[TIMER_KEY])

  const timer = setInterval(() => {
    void runLoungeAiTurn().catch(() => {})
  }, CHECK_INTERVAL_MS)

  timer.unref?.()
  holder[TIMER_KEY] = timer
})
