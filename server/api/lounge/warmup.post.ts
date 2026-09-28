/**
 * POST /api/lounge/warmup
 * 使うときに gemma を先に VRAM へ読み込み、keep_alive の設定（既定は 5 分）を効かせる。
 * 使わなくなればその時間でアイドル（アンロード）に戻る。会話本文は使わないので 1 トークンだけ生成して捨てる。
 */
import { findRunningModel, normalizeKeepAlive } from '../../utils/ollama'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  if (!config.ollamaUrl) {
    throw createError({ statusCode: 501, message: 'Ollama の接続先が設定されていません（NUXT_OLLAMA_URL）' })
  }

  const model = config.ollamaModel || 'gemma3:4b'
  const response = await fetch(config.ollamaUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false,
      options: { num_predict: 1 },
      keep_alive: normalizeKeepAlive(config.ollamaKeepAlive),
    }),
  }).catch(() => null)

  if (!response?.ok) {
    const detail = await response?.json().catch(() => null) as { error?: string } | null
    throw createError({
      statusCode: 502,
      message: detail?.error || `gemma を読み込めませんでした（${response?.status ?? 'network error'}）。Ollama の起動状態とモデル名を確認してください。`,
    })
  }

  const running = await findRunningModel(config.ollamaUrl, model)
  return {
    loaded: Boolean(running),
    expiresAt: running?.expiresAt ?? null,
  }
})
