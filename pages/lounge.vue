<script setup lang="ts">
/**
 * pages/lounge.vue
 * AI ラウンジ（店主（AI）も混ざる共有チャット）。
 *
 * 実 API:
 *   GET  /api/lounge/messages?after=… → 共有チャットの履歴
 *   POST /api/lounge/messages         → 発言（要ログイン）
 *   GET  /api/lounge/events?after=…   → 新着と店主の状態を SSE で受ける
 *   GET  /api/lounge/status           → 応答エンジン（Ollama / gemma）の状態
 *   POST /api/lounge/warmup           → 店主（gemma）を先に読み込む
 *
 * 店主の返事はサーバー側（server/utils/lounge-ai.ts + server/plugins/lounge-ai.ts）が回す。
 *  - 「店主さん」（英語なら shopkeeper / Mr. Shopkeeper など）と呼ばれたら、間隔を待たずにすぐ返事する
 *  - 呼ばれていないときは、約 2 分に 1 回、店主のひとりごとを呟く（誰も来ていない部屋では黙っている）
 *  - 会話は全員で共有されるので、リセットはできない
 */
import type { LoungeAiStateDto, LoungeMessageDto, LoungeStatus } from '~~/shared/types'
import { renderMarkdown } from '~~/shared/markdown'
import { useAuthStore } from '~~/stores/auth'

const auth = useAuthStore()
const { data: status, refresh: refreshStatus } = await useFetch<LoungeStatus>('/api/lounge/status')
const { data: history, error: historyError } = await useFetch<{ items: LoungeMessageDto[] }>('/api/lounge/messages')

const messages = ref<LoungeMessageDto[]>(history.value?.items ?? [])
const input = ref('')
const sending = ref(false)
const error = ref<string | null>(null)
const connection = ref<'connecting' | 'online' | 'reconnecting'>('connecting')
const aiState = ref<LoungeAiStateDto>({ thinking: false, intervalMs: 120_000, nextTurnAt: null, called: false, roomActive: false })
const now = ref(Date.now())
const scroller = ref<HTMLDivElement | null>(null)
let source: EventSource | null = null
let ticker: ReturnType<typeof setInterval> | null = null

/** デスクトップではサイドバーのルールを常に開いておく（モバイルは畳んでおく） */
const wide = useMediaQuery('(min-width: 1024px)')
const rulesOpen = ref(false)

function onRulesToggle(event: Event): void {
  if (wide.value) return
  rulesOpen.value = (event.target as HTMLDetailsElement).open
}

const connectionLabel = computed(() => {
  if (connection.value === 'online') return '接続中'
  return connection.value === 'connecting' ? '接続中…' : '再接続中'
})

const connectionTone = computed(() => {
  if (connection.value === 'online') return 'text-hz-300'
  return connection.value === 'reconnecting' ? 'text-glow-300' : 'text-stone-400'
})

const mode = computed(() => status.value?.mode ?? 'ollama')

const engineLabel = computed(() => {
  if (!status.value) return '接続情報を取得中…'
  return mode.value === 'discord'
    ? 'Discord リレー（#ai-lounge）'
    : `Ollama（${status.value.model}）`
})

const engineReady = computed(() => {
  if (!status.value) return true
  return mode.value === 'discord' ? status.value.discordConfigured : status.value.ollamaReady
})

/** 店主（gemma）の今の状態。使っていないときはアイドル（アンロード）に戻る */
const engineState = computed(() => {
  if (!status.value) return '確認中…'
  if (mode.value === 'discord') return 'Discord に中継'
  if (!status.value.ollamaConfigured) return '未設定'
  if (!status.value.ollamaReady) return 'モデル未検出'
  return status.value.ollamaLoaded ? 'ロード中' : '待機中（アイドル）'
})

const engineStateTone = computed(() => {
  if (!status.value || mode.value === 'discord') return 'text-stone-400'
  if (!status.value.ollamaConfigured || !status.value.ollamaReady) return 'text-stone-400'
  return status.value.ollamaLoaded ? 'text-hz-300' : 'text-glow-300'
})

/** 店主のひとりごとの間隔（「約 2 分に 1 回」のような表示用） */
const aiCadenceLabel = computed(() => {
  const minutes = Math.max(1, Math.round(aiState.value.intervalMs / 60_000))
  return `約 ${minutes} 分に 1 回`
})

/** 「店主さん」と呼ばれているか（呼ばれていれば間隔を待たずにすぐ返事が来る） */
const aiCalled = computed(() => aiState.value.called)

/** 次のひとりごとまでの待ち時間（秒）。呼ばれているときは返事がすぐ来るので出さない */
const aiWaitSeconds = computed(() => {
  if (aiState.value.thinking || aiState.value.called || !aiState.value.roomActive) return null
  const next = aiState.value.nextTurnAt
  if (!next) return null
  const remaining = Math.ceil((next - now.value) / 1000)
  return remaining > 0 ? remaining : null
})

const warming = ref(false)

/** 使うときに店主（gemma）を先に読み込む。使わなくなれば keep_alive の時間でアイドルに戻る */
async function warmup(): Promise<void> {
  if (warming.value) return
  warming.value = true
  try {
    await $fetch('/api/lounge/warmup', { method: 'POST' })
  }
  catch (caught) {
    error.value = caught instanceof Error ? caught.message : '店主の読み込みに失敗しました'
  }
  finally {
    warming.value = false
    await refreshStatus()
  }
}

function scrollToBottom(): void {
  nextTick(() => {
    const element = scroller.value
    if (element) element.scrollTop = element.scrollHeight
  })
}

function addMessage(message: LoungeMessageDto): void {
  if (messages.value.some((item: LoungeMessageDto) => item.id === message.id)) return
  messages.value.push(message)
  messages.value.sort((a: LoungeMessageDto, b: LoungeMessageDto) => a.id - b.id)
  if (messages.value.length > 100) messages.value.splice(0, messages.value.length - 100)
  scrollToBottom()
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function submit(): Promise<void> {
  const content = input.value.trim()
  if (!content || sending.value || !auth.isAuthenticated) return

  sending.value = true
  error.value = null
  try {
    const result = await $fetch<{ message: LoungeMessageDto }>('/api/lounge/messages', {
      method: 'POST',
      body: { content },
    })
    input.value = ''
    addMessage(result.message)
  }
  catch (caught: unknown) {
    const failure = caught as { data?: { message?: string }, statusCode?: number }
    error.value = failure?.data?.message || '送信できませんでした。もう一度お試しください。'
    if (failure?.statusCode === 401) void auth.fetchSession(true)
  }
  finally {
    sending.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
  }
}

onMounted(() => {
  void auth.fetchSession()
  scrollToBottom()

  ticker = setInterval(() => { now.value = Date.now() }, 1000)

  const after = messages.value.at(-1)?.id ?? 0
  source = new EventSource(`/api/lounge/events?after=${after}`)
  source.onopen = () => { connection.value = 'online' }
  source.onerror = () => { connection.value = 'reconnecting' }
  source.onmessage = (event) => {
    try {
      addMessage(JSON.parse(event.data) as LoungeMessageDto)
    }
    catch { /* 不正なイベントは表示しない */ }
  }
  // 店主が考え中かどうかは名前付きイベントで届く
  source.addEventListener('status', (event) => {
    try {
      aiState.value = JSON.parse((event as MessageEvent).data) as LoungeAiStateDto
    }
    catch { /* 不正なイベントは無視 */ }
  })
})

onBeforeUnmount(() => {
  source?.close()
  source = null
  if (ticker) clearInterval(ticker)
  ticker = null
})

// 投稿・受信のどちらでも、増えたら一番下へ
watch(() => messages.value.length, scrollToBottom)

useSeoMeta({
  title: 'AI ラウンジ',
  description: '店主（AI）も混ざる共有チャット。ボカロの話をみんなで。「店主さん」と呼べばすぐ返事、呼ばなくても約 2 分に 1 回ひとりごとを呟きます。',
})
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-[12px]">
      <NuxtLink to="/board" class="text-stone-400 transition hover:text-hz-200">← 掲示板</NuxtLink>
      <NuxtLink to="/board/chat" class="text-stone-400 transition hover:text-hz-200">リアルタイムチャットへ →</NuxtLink>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <section class="panel flex h-[calc(100dvh-210px)] min-h-[420px] flex-col overflow-hidden !p-0 lg:h-[calc(100dvh-170px)] lg:min-h-[520px]">
        <header class="border-b border-ink-800 px-4 py-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 class="font-mono text-[13px] text-hz-300">AI ラウンジ</h1>
              <p class="mt-1 text-[11.5px] text-stone-400">
                店主（AI）も混ざる共有チャット。「店主さん」と呼べばすぐ返事。{{ aiCadenceLabel }} ひとりごとも呟きます。
              </p>
            </div>
            <span class="flex shrink-0 items-center gap-1.5 text-[11px]" :class="connectionTone">
              <span class="h-1.5 w-1.5 rounded-full bg-current" />
              {{ connectionLabel }}
            </span>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
            <span class="text-stone-400">応答エンジン：{{ engineLabel }}</span>
            <span class="flex items-center gap-1.5" :class="engineStateTone">
              <span class="h-1.5 w-1.5 rounded-full bg-current" />
              {{ engineState }}
            </span>
            <button
              v-if="mode === 'ollama' && status?.ollamaConfigured && status.ollamaReady && !status.ollamaLoaded"
              type="button"
              class="text-hz-300 transition hover:text-hz-200 disabled:text-stone-500"
              :disabled="warming"
              @click="warmup()"
            >
              {{ warming ? '店主を呼んでいます…' : '店主を今読み込む' }}
            </button>
          </div>
        </header>

        <div ref="scroller" class="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          <p v-if="historyError" class="text-[12px] text-glow-300">会話を読み込めませんでした。</p>
          <p v-else-if="!messages.length" class="py-10 text-center text-[12px] leading-relaxed text-stone-400">
            まだ誰もいません。最初のひとことをどうぞ。<br>
            「店主さん」と呼べばすぐ返事。呼ばなくても {{ aiCadenceLabel }} ひとりごとを呟きます。
          </p>

          <article
            v-for="message in messages"
            :key="message.id"
            :class="message.role === 'user'
              ? 'flex gap-3'
              : message.kind === 'monologue'
                ? 'rounded-lg border border-ink-800 bg-ink-950/50 px-3.5 py-2.5'
                : 'rounded-lg border border-glow-500/30 bg-glow-500/5 px-3.5 py-3'"
          >
            <template v-if="message.role === 'assistant' && message.kind === 'monologue'">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="font-mono text-[11.5px] text-stone-400">{{ message.author.displayName }} のひとりごと</span>
                <time :datetime="message.createdAt" class="font-mono text-[11px] text-stone-400">{{ formatTime(message.createdAt) }}</time>
              </div>
              <div class="review-body mt-1.5 !text-[12.5px] !leading-[1.7] text-stone-400" v-html="renderMarkdown(message.content)" />
            </template>

            <template v-else-if="message.role === 'assistant'">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="font-mono text-[11px] text-glow-300">{{ message.author.displayName }}</span>
                <time :datetime="message.createdAt" class="font-mono text-[11px] text-stone-400">{{ formatTime(message.createdAt) }}</time>
              </div>
              <div class="review-body mt-1.5 !text-[13px] !leading-[1.85]" v-html="renderMarkdown(message.content)" />
            </template>

            <template v-else>
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-[12px] text-hz-200">
                {{ message.author.displayName.slice(0, 1) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <NuxtLink
                    v-if="message.author.username"
                    :to="`/users/${message.author.username}`"
                    class="text-[12px] font-semibold text-stone-200 hover:text-hz-200"
                  >
                    {{ message.author.displayName }}
                  </NuxtLink>
                  <span v-else class="text-[12px] font-semibold text-stone-200">{{ message.author.displayName }}</span>
                  <time :datetime="message.createdAt" class="font-mono text-[11px] text-stone-400">{{ formatTime(message.createdAt) }}</time>
                </div>
                <p class="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-stone-300">{{ message.content }}</p>
              </div>
            </template>
          </article>

          <p v-if="aiState.thinking" class="pl-1 text-[11px] text-stone-400">
            店主が考え中…
          </p>
          <p v-else-if="aiCalled" class="pl-1 text-[11px] text-hz-300">
            店主を呼びました。すぐ返事をします。
          </p>
          <p v-else-if="aiWaitSeconds" class="pl-1 text-[11px] text-stone-400">
            次のひとりごとまで あと {{ aiWaitSeconds }} 秒（「店主さん」と呼べばすぐ返事をします）
          </p>
        </div>

        <form class="border-t border-ink-800 px-3 py-3" @submit.prevent="submit">
          <div v-if="!engineReady" class="mb-2 rounded-md border border-glow-400/30 bg-glow-400/5 px-3 py-2 text-[11px] leading-relaxed text-glow-300">
            <template v-if="mode === 'ollama'">
              Ollama の <code class="font-mono">{{ status?.model }}</code> に接続できません。
              Ollama を起動し、このモデルがインストールされているか確認してください。
            </template>
            <template v-else>
              Discord 連携が未設定です。<code class="font-mono">NUXT_DISCORD_WEBHOOK_URL</code> を設定してください。
            </template>
          </div>

          <div v-if="!auth.isAuthenticated" class="text-[12px] text-stone-400">
            発言するには <NuxtLink to="/login?next=/lounge" class="text-hz-300 hover:text-hz-200">ログイン・新規登録</NuxtLink> してください。閲覧はそのままできます。
          </div>
          <template v-else>
            <div class="flex items-end gap-2">
              <textarea
                v-model="input"
                rows="2"
                maxlength="500"
                class="field !text-[13px]"
                placeholder="店主さん、と話しかけるとすぐ返事。Enter で送信、Shift + Enter で改行。"
                @keydown="onKeydown"
              />
              <button type="submit" class="btn-primary shrink-0 !px-4" :disabled="sending || !input.trim()">
                {{ sending ? '送信中…' : '送る' }}
              </button>
            </div>
            <p class="mt-1 text-right text-[11px] text-stone-400">{{ input.length }} / 500</p>
          </template>

          <p v-if="error" class="mt-2 text-[11px] text-glow-300">{{ error }}</p>
        </form>
      </section>

      <aside class="lg:space-y-5">
        <!--
          モバイルでは畳んでおく（LAYOUT_ARCHITECTURE §3: サイドバー下部折りたたみ）。
          デスクトップ（lg 以上）では常に開いた状態にして、通常のサイドバーとして見せる。
        -->
        <details
          class="panel overflow-hidden"
          :open="rulesOpen || wide"
          @toggle="onRulesToggle"
        >
          <summary class="cursor-pointer select-none px-5 py-3 text-[12px] font-semibold text-stone-300 transition hover:text-hz-200 lg:hidden">
            部屋のルール
          </summary>

          <div class="px-5 pb-5 pt-0 lg:pt-5">
            <p class="panel-title hidden lg:block">
              部屋のルール
            </p>
            <ul class="space-y-2.5 text-[12px] leading-relaxed text-stone-400 lg:mt-3">
              <li class="flex gap-2">
                <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
                ここは全員で使う共有の部屋です。会話はこのまま残ります。
              </li>
              <li class="flex gap-2">
                <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
                店主を呼ぶときは「店主さん」（英語なら shopkeeper / Mr. Shopkeeper など）。呼べばすぐ返事をします。
              </li>
              <li class="flex gap-2">
                <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
                呼ばなくても、店主は {{ aiCadenceLabel }} ひとりごとを呟きます。
              </li>
              <li class="flex gap-2">
                <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
                ボカロと音楽の話以外、この部屋にはありません。
              </li>
              <li class="flex gap-2">
                <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
                曲名だけでも投げてください。棚から似た曲を引いてきます。
              </li>
            </ul>
          </div>
        </details>

        <SideManifesto class="hidden lg:block" />
      </aside>
    </div>
  </div>
</template>

