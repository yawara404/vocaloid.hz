/**
 * POST /api/chat
 * ---------------------------------------------------------------
 * AI ラウンジのバックエンド。
 *   mode=ollama  : ローカル Ollama (Gemma 3) へ NDJSON ストリームで中継
 *   mode=discord : Discord Webhook へ送信し、Bot トークンがあれば直近ログを返す
 *
 * ボットのキャラクター: 「vocaloid.hz のレコード店番」
 */
import { Readable } from 'node:stream'
import type { ChatMessage } from '~~/shared/types'
import { normalizeKeepAlive } from '../utils/ollama'
import { LOUNGE_AI_PERSONA } from '../utils/lounge-ai'

/** 店主のキャラクターは共有ラウンジと共通（server/utils/lounge-ai.ts） */

interface DiscordMessage {
  id: string
  content: string
  timestamp: string
  author?: { username?: string; global_name?: string | null; bot?: boolean }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ messages?: ChatMessage[]; mode?: string }>(event)
  const messages = (body.messages ?? [])
    .filter(message => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && message.content.trim())
    .slice(-12)
    .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }))

  if (messages.length === 0) {
    throw createError({ statusCode: 400, message: 'メッセージを入力してください' })
  }

  const config = useRuntimeConfig()
  const mode = body.mode === 'discord' ? 'discord' : 'ollama'

  if (mode === 'discord') {
    return relayToDiscord(messages, config)
  }

  return relayToOllama(event, messages, config)
})

async function relayToOllama(event: any, messages: ChatMessage[], config: any) {
  if (!config.ollamaUrl) {
    throw createError({ statusCode: 501, message: 'Ollama の接続先が設定されていません（NUXT_OLLAMA_URL）' })
  }

  const upstream = await fetch(config.ollamaUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel || 'gemma3:4b',
      // 使い終わったらアイドル（アンロード）に戻す。既定は '5m'（-1 を設定したときだけ常時ロード）
      keep_alive: normalizeKeepAlive(config.ollamaKeepAlive),
      stream: true,
      messages: [{ role: 'system', content: LOUNGE_AI_PERSONA }, ...messages],
    }),
  }).catch(() => null)

  if (!upstream || !upstream.ok || !upstream.body) {
    const detail = await upstream?.json().catch(() => null) as { error?: string } | null
    throw createError({
      statusCode: 502,
      message: detail?.error || `Ollama に接続できませんでした（${upstream?.status ?? 'network error'}）。Ollama が起動しているか確認してください。`,
    })
  }

  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-cache, no-transform')
  setResponseHeader(event, 'x-accel-buffering', 'no')

  return sendStream(event, Readable.fromWeb(upstream.body as any))
}

async function relayToDiscord(messages: ChatMessage[], config: any) {
  const webhookUrl: string = config.discordWebhookUrl || ''
  const botToken: string = config.discordBotToken || ''
  const channelId: string = config.discordChannelId || ''

  if (!webhookUrl && !botToken) {
    throw createError({
      statusCode: 501,
      message: 'Discord 連携が未設定です（NUXT_DISCORD_WEBHOOK_URL または NUXT_DISCORD_BOT_TOKEN + CHANNEL_ID）',
    })
  }

  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content?.trim() ?? ''

  if (webhookUrl && lastUserMessage) {
    await $fetch(webhookUrl, {
      method: 'POST',
      body: {
        content: lastUserMessage.slice(0, 1800),
        username: 'vocaloid.hz ラウンジ',
      },
    }).catch(() => null)
  }

  if (botToken && channelId) {
    const recent = await $fetch<DiscordMessage[]>(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=25`,
      { headers: { authorization: `Bot ${botToken}` } },
    ).catch(() => [] as DiscordMessage[])

    return {
      mode: 'discord' as const,
      sent: Boolean(webhookUrl && lastUserMessage),
      messages: [...recent].reverse().map(message => ({
        id: message.id,
        author: message.author?.global_name || message.author?.username || 'unknown',
        content: message.content,
        timestamp: message.timestamp,
      })),
    }
  }

  return {
    mode: 'discord' as const,
    sent: Boolean(webhookUrl && lastUserMessage),
    messages: [],
    note: 'Webhook へ送信しました。Web 上での受信表示には DISCORD_BOT_TOKEN と DISCORD_CHANNEL_ID が必要です。',
  }
}
