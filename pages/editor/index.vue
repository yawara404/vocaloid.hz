<script setup lang="ts">
/**
 * pages/editor/index.vue
 * 新規レビューの執筆ページ。?track=slug で楽曲情報をプリフィルできる。
 */
import type { TrackDetailResponse } from '~~/shared/types'
import { useAuthStore } from '~~/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const trackSlug = computed(() => {
  return typeof route.query.track === 'string' && route.query.track.trim() ? route.query.track.trim() : null
})

const { data: prefillPayload } = await useAsyncData<TrackDetailResponse | null>(
  () => `editor-prefill-${trackSlug.value ?? 'none'}`,
  async () => {
    if (!trackSlug.value) return null
    try {
      return await $fetch<TrackDetailResponse>(`/api/tracks/${trackSlug.value}`)
    }
    catch {
      return null
    }
  },
  { watch: [trackSlug] },
)

const checked = ref(false)

onMounted(async () => {
  await auth.fetchSession()
  checked.value = true
})

const prefill = computed(() => {
  const track = prefillPayload.value?.track
  if (!track) return null
  return {
    title: track.title,
    producerName: track.producerName,
    voiceSynthesizer: track.voiceSynthesizer,
    engineType: track.engineType ?? undefined,
    releaseYear: track.releaseYear ?? undefined,
    youtubeVideoId: track.youtubeVideoId || undefined,
  }
})

useSeoMeta({
  title: 'レビューを書く',
  description: '好きなボカロの「ここがいい」を自分の言葉で残す、レビュー投稿ページ。',
})
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <header>
      <h1 class="section-title !text-lg">
        レビューを書く
      </h1>
      <p class="mt-2 text-[12.5px] leading-relaxed text-stone-400">
        「刺さった」で終わらせず、刺さった構造を書く。
        曲名・ボカロP・歌声ライブラリは必須です。
      </p>
    </header>

    <div v-if="!checked" class="panel mt-6 h-64 animate-pulse" />

    <ReviewEditor v-else-if="auth.isAuthenticated" class="mt-6" :prefill-track="prefill" />

    <div v-else class="panel mt-6 p-8 text-center">
      <p class="text-[13px] text-stone-400">
        レビューを執筆するにはログインが必要です。
      </p>
      <NuxtLink
        :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
        class="btn-primary mt-4"
      >
        ログイン / 新規登録
      </NuxtLink>
    </div>
  </div>
</template>
