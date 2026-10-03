/**
 * server/utils/ollama.ts
 * ---------------------------------------------------------------
 * Ollama 連携の共通ヘルパー。
 *
 * gemma は「使っている間だけ」VRAM に載せ、使わなくなったらアンロード（アイドル）したい。
 * そこで `keep_alive` を明示的に送り（既定は Ollama 標準と同じ 5 分）、
 * 今どちらの状態なのかを /api/ps で確認して画面から見えるようにする。
 */
import type { ChatMessage } from '~~/shared/types'

/** `-1` なら無期限（アンロードしない）。`'5m'` のような期間文字列も受け付ける */
export type OllamaKeepAlive = number | string
export interface OllamaRunningModel {
  name: string
  /** アイドル（アンロード）に戻る予定時刻 */
  expiresAt: string | null
  sizeVram: number
}

/** runtimeConfig / 環境変数が未設定のときの既定値（Ollama 標準と同じ） */
export const DEFAULT_KEEP_ALIVE: OllamaKeepAlive = '5m'

/**
 * runtimeConfig / 環境変数の keep_alive を Ollama が解釈できる値に正規化する。
 * 未設定なら '5m'（使ってから 5 分でアイドルに戻る）。`-1` を設定したときだけ常時ロード。
 */
export function normalizeKeepAlive(value: unknown): OllamaKeepAlive {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return DEFAULT_KEEP_ALIVE
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : text
}

/** `http://localhost:11434/api/chat` → `http://localhost:11434/api/tags` のような URL を作る */
export function ollamaEndpoint(chatUrl: string, path: string): URL {
  const url = new URL(chatUrl)
  url.pathname = path
  url.search = ''
  return url
}

/**
 * サンプリングの既定値。
 *
 * gemma3:4b は「同じ語を延々繰り返す」崩壊（例: 『2011年… まだ… まだ… まだ…』）を
 * 起こしやすい。repeat_penalty / repeat_last_n である程度抑え、それでも抜けてきたぶんを
 * presence_penalty / frequency_penalty で減衰させる。num_predict は暴走を止める上限。
 *
 * すべて NUXT_OLLAMA_* （nuxt.config.ts の runtimeConfig）で上書きできる。
 */
export interface OllamaSampling {
  temperature: number
  topP: number
  topK: number
  minP: number
  /** 直前 repeatLastN トークンに出た語の確率を下げる（1.0 で無効） */
  repeatPenalty: number
  /** repeat_penalty を見る範囲（トークン数） */
  repeatLastN: number
  /** 出た回数に比例して下げる（0 で無効） */
  frequencyPenalty: number
  /** 一度出た語をもう出しにくくする（0 で無効） */
  presencePenalty: number
  numPredict: number
}

export const DEFAULT_OLLAMA_SAMPLING: OllamaSampling = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  minP: 0.05,
  repeatPenalty: 1.3,
  repeatLastN: 256,
  frequencyPenalty: 0.3,
  presencePenalty: 0.3,
  numPredict: 512,
}

export interface OllamaChatOptions {
  /** 先頭に差し込む system プロンプト */
  system?: string
  temperature?: number
  /** 生成する最大トークン数（独り言などを短く保つため） */
  numPredict?: number
  topP?: number
  topK?: number
  minP?: number
  repeatPenalty?: number
  repeatLastN?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  timeoutMs?: number
}

/** runtimeConfig / 環境変数を数値に。空文字や未設定は fallback に戻す */
function configNumber(value: unknown, fallback: number): number {
  if (typeof value === 'string' && value.trim() === '') return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

/**
 * Ollama に渡す options を組み立てる。
 * 既定値（DEFAULT_OLLAMA_SAMPLING）→ NUXT_OLLAMA_* の上書き → 呼び出しごとの指定、の順に優先する。
 * 返り値は Ollama の API と同じ snake_case のキー。
 */
export function ollamaOptions(overrides: OllamaChatOptions = {}): Record<string, number> {
  const config = useRuntimeConfig()
  const options: Record<string, number> = {
    temperature: overrides.temperature ?? configNumber(config.ollamaTemperature, DEFAULT_OLLAMA_SAMPLING.temperature),
    top_p: overrides.topP ?? configNumber(config.ollamaTopP, DEFAULT_OLLAMA_SAMPLING.topP),
    top_k: overrides.topK ?? configNumber(config.ollamaTopK, DEFAULT_OLLAMA_SAMPLING.topK),
    min_p: overrides.minP ?? configNumber(config.ollamaMinP, DEFAULT_OLLAMA_SAMPLING.minP),
    repeat_penalty: overrides.repeatPenalty ?? configNumber(config.ollamaRepeatPenalty, DEFAULT_OLLAMA_SAMPLING.repeatPenalty),
    repeat_last_n: overrides.repeatLastN ?? configNumber(config.ollamaRepeatLastN, DEFAULT_OLLAMA_SAMPLING.repeatLastN),
    frequency_penalty: overrides.frequencyPenalty ?? configNumber(config.ollamaFrequencyPenalty, DEFAULT_OLLAMA_SAMPLING.frequencyPenalty),
    presence_penalty: overrides.presencePenalty ?? configNumber(config.ollamaPresencePenalty, DEFAULT_OLLAMA_SAMPLING.presencePenalty),
    num_predict: overrides.numPredict ?? configNumber(config.ollamaNumPredict, DEFAULT_OLLAMA_SAMPLING.numPredict),
  }
  if (overrides.seed !== undefined) options.seed = overrides.seed
  return options
}

/**
 * Ollama に 1 往復投げて全文（非ストリーム）を受け取る。
 * 共有チャットの店主の発言づくりなど、サーバー側で完結させたい用途に使う。
 */
export async function askOllama(messages: ChatMessage[], options: OllamaChatOptions = {}): Promise<string> {
  const config = useRuntimeConfig()
  if (!config.ollamaUrl) {
    throw new Error('Ollama の接続先が設定されていません（NUXT_OLLAMA_URL）')
  }

  const payload: ChatMessage[] = options.system
    ? [{ role: 'system', content: options.system }, ...messages]
    : messages

  const response = await fetch(config.ollamaUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel || 'gemma3:4b',
      messages: payload,
      stream: false,
      keep_alive: normalizeKeepAlive(config.ollamaKeepAlive),
      options: ollamaOptions(options),
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
  }).catch((caught) => {
    throw new Error(caught instanceof Error ? caught.message : 'Ollama への接続に失敗しました')
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error || `Ollama が応答しませんでした（HTTP ${response.status}）`)
  }

  const body = await response.json() as { message?: { content?: string } }
  return (body.message?.content ?? '').trim()
}

/** GET /api/ps でロード中のモデルを探す。アイドル（アンロード済み）なら null */
export async function findRunningModel(chatUrl: string, model: string): Promise<OllamaRunningModel | null> {
  if (!chatUrl || !model) return null

  const response = await fetch(ollamaEndpoint(chatUrl, '/api/ps'), { signal: AbortSignal.timeout(2000) })
    .catch(() => null)
  if (!response?.ok) return null

  const payload = await response.json().catch(() => null) as {
    models?: { name?: string; expires_at?: string; size_vram?: number }[]
  } | null
  const hit = payload?.models?.find(item => item.name === model)
  if (!hit) return null

  return {
    name: hit.name ?? model,
    expiresAt: hit.expires_at ?? null,
    sizeVram: typeof hit.size_vram === 'number' ? hit.size_vram : 0,
  }
}

