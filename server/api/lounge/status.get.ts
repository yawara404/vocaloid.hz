/**
 * GET /api/lounge/status
 * AI ラウンジの接続状況（Ollama / Discord の設定有無）
 */
import type { LoungeStatus } from '~~/shared/types'
import { findRunningModel, normalizeKeepAlive, ollamaEndpoint } from '../../utils/ollama'

export default defineEventHandler(async (): Promise<LoungeStatus> => {
  const config = useRuntimeConfig()
  const keepAlive = normalizeKeepAlive(config.ollamaKeepAlive)
  const model = config.ollamaModel || 'gemma3:4b'

  const ollamaConfigured = Boolean(config.ollamaUrl)
  let ollamaReady = false
  if (ollamaConfigured) {
    try {
      const response = await fetch(ollamaEndpoint(config.ollamaUrl, '/api/tags'), { signal: AbortSignal.timeout(2000) })
      if (response.ok) {
        const payload = await response.json() as { models?: { name?: string }[] }
        ollamaReady = Boolean(payload.models?.some(item => item.name === model))
      }
    }
    catch { /* Ollama が停止中なら画面に案内する */ }
  }

  // インストール済みか（/api/tags）だけでなく、今ロード中かどうか（/api/ps）も返す
  const running = ollamaReady ? await findRunningModel(config.ollamaUrl, model) : null
  const discordConfigured = Boolean(config.discordWebhookUrl || (config.discordBotToken && config.discordChannelId))

  return {
    mode: !ollamaConfigured && discordConfigured ? 'discord' : 'ollama',
    ollamaConfigured,
    ollamaReady,
    ollamaLoaded: Boolean(running),
    ollamaExpiresAt: running?.expiresAt ?? null,
    keepAlive: String(keepAlive),
    discordConfigured,
    model,
  }
})
