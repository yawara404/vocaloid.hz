<script setup lang="ts">
import type { BoardMessageDto } from '~~/shared/types'
import { useAuthStore } from '~~/stores/auth'

const auth = useAuthStore()
const { data: history, error: historyError } = await useFetch<{ items: BoardMessageDto[] }>('/api/board/messages')
const messages = ref<BoardMessageDto[]>(history.value?.items ?? [])
const input = ref('')
const sending = ref(false)
const error = ref<string | null>(null)
const connection = ref<'connecting' | 'online' | 'reconnecting'>('connecting')
const connectionLabel = computed(() => {
  if (connection.value === 'online') return '接続中'
  return connection.value === 'connecting' ? '接続中…' : '再接続中'
})
const connectionTone = computed(() => {
  if (connection.value === 'online') return 'text-hz-300'
  return connection.value === 'reconnecting' ? 'text-glow-300' : 'text-stone-400'
})
const scroller = ref<HTMLDivElement | null>(null)
let source: EventSource | null = null

function scrollToBottom(): void {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}

function addMessage(message: BoardMessageDto): void {
  if (messages.value.some((item: BoardMessageDto) => item.id === message.id)) return
  messages.value.push(message)
  messages.value.sort((a: BoardMessageDto, b: BoardMessageDto) => a.id - b.id)
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
    const result = await $fetch<{ message: BoardMessageDto }>('/api/board/messages', {
      method: 'POST',
      body: { content },
    })
    input.value = ''
    addMessage(result.message)
  }
  catch (err: any) {
    error.value = err?.data?.message || '送信できませんでした。もう一度お試しください。'
    if (err?.statusCode === 401) void auth.fetchSession(true)
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
  const after = messages.value.at(-1)?.id ?? 0
  source = new EventSource(`/api/board/events?after=${after}`)
  source.onopen = () => { connection.value = 'online' }
  source.onerror = () => { connection.value = 'reconnecting' }
  // EventSource は自動再接続し、open し直したら onopen が再度呼ばれる

  source.onmessage = (event) => {
    try {
      addMessage(JSON.parse(event.data) as BoardMessageDto)
    }
    catch { /* 不正なイベントは表示しない */ }
  }
})

onBeforeUnmount(() => {
  source?.close()
  source = null
})

useSeoMeta({
  title: 'リアルタイムチャット',
  description: 'ボカロ好き同士で曲の話ができるリアルタイムチャット。',
})
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-[12px]">
      <NuxtLink to="/board" class="text-stone-400 transition hover:text-hz-200">← 掲示板</NuxtLink>
      <NuxtLink to="/lounge" class="text-stone-400 transition hover:text-hz-200">AI ラウンジへ →</NuxtLink>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section class="panel flex h-[68vh] min-h-[420px] flex-col overflow-hidden !p-0 sm:h-[72vh] sm:min-h-[520px]">
        <header class="border-b border-ink-800 px-4 py-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 class="font-mono text-[13px] text-hz-300">リアルタイムチャット</h1>
              <p class="mt-1 text-[11.5px] text-stone-400">
                今聴いている曲や、好きなボカロの話をどうぞ。
              </p>
            </div>
            <span class="flex shrink-0 items-center gap-1.5 text-[11px]" :class="connectionTone">
              <span class="h-1.5 w-1.5 rounded-full bg-current" />
              {{ connectionLabel }}
            </span>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
            <span class="text-stone-400">{{ messages.length }} 件の発言（直近 100 件）</span>
            <span v-if="auth.isAuthenticated" class="flex items-center gap-1.5 text-hz-300">
              <span class="h-1.5 w-1.5 rounded-full bg-current" />
              {{ auth.user?.displayName }} として発言できます
            </span>
          </div>
        </header>

        <div ref="scroller" class="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          <p v-if="historyError" class="text-[12px] text-glow-300">メッセージを読み込めませんでした。</p>
          <p v-else-if="!messages.length" class="py-10 text-center text-[12px] leading-relaxed text-stone-400">
            まだ発言がありません。最初のひとことをどうぞ。<br>
            AI の店主がいる部屋は <NuxtLink to="/lounge" class="text-hz-300 hover:text-hz-200">AI ラウンジ</NuxtLink> です。
          </p>

          <article v-for="message in messages" :key="message.id" class="flex gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-[12px] text-hz-200">
              {{ message.author.displayName.slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <NuxtLink :to="`/users/${message.author.username}`" class="text-[12px] font-semibold text-stone-200 hover:text-hz-200">
                  {{ message.author.displayName }}
                </NuxtLink>
                <time :datetime="message.createdAt" class="font-mono text-[11px] text-stone-400">{{ formatTime(message.createdAt) }}</time>
              </div>
              <p class="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-stone-300">{{ message.content }}</p>
            </div>
          </article>
        </div>

        <form class="border-t border-ink-800 px-3 py-3" @submit.prevent="submit">
          <div v-if="!auth.isAuthenticated" class="text-[12px] text-stone-400">
            発言するには <NuxtLink to="/login?next=/board/chat" class="text-hz-300 hover:text-hz-200">ログイン・新規登録</NuxtLink> してください。閲覧はそのままできます。
          </div>
          <template v-else>
            <div class="flex items-end gap-2">
              <textarea
                v-model="input"
                rows="2"
                maxlength="500"
                class="field !text-[13px]"
                placeholder="今聴いている曲や、ボカロの話をどうぞ。Enter で送信、Shift + Enter で改行。"
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

      <aside class="space-y-5">
        <section class="panel p-5">
          <p class="panel-title">
            部屋のルール
          </p>
          <ul class="mt-3 space-y-2.5 text-[12px] leading-relaxed text-stone-400">
            <li class="flex gap-2">
              <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              ボカロと音楽の話以外、この部屋にはありません。
            </li>
            <li class="flex gap-2">
              <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              新しい発言はその場で届きます。開いたままでどうぞ。
            </li>
            <li class="flex gap-2">
              <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              発言にはログインが必要です。閲覧は誰でもできます。
            </li>
          </ul>
        </section>

        <SideManifesto />
      </aside>
    </div>
  </div>
</template>
