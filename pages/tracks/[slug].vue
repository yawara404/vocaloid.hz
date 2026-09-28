<script setup lang="ts">
/**
 * pages/tracks/[slug].vue
 * 楽曲ページ。同じ楽曲に対する複数のレビューを束ねる単位。
 *
 * 実 API: GET /api/tracks/:slug → { track: TrackDto, reviews: ReviewSummaryDto[] }
 */
import type { ReviewCategory, ReviewSummaryDto, TrackDetailResponse } from '~~/shared/types'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~~/shared/types'
import { usePlayerStore } from '~~/stores/player'

const route = useRoute()
const player = usePlayerStore()

const { data: payload, error } = await useFetch<TrackDetailResponse>(
  () => `/api/tracks/${route.params.slug}`,
)

if (error.value || !payload.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: '楽曲が見つかりませんでした',
    fatal: true,
  })
}

const current = computed(() => payload.value as TrackDetailResponse)
const track = computed(() => current.value.track)
const reviews = computed(() => current.value.reviews)

/** カテゴリで絞り込むタブ（レビューがあるカテゴリだけ出す） */
const categoryTab = ref<ReviewCategory | null>(null)

const reviewTabs = computed(() => CATEGORY_ORDER
  .map(key => ({
    key,
    label: CATEGORY_LABELS[key],
    count: reviews.value.filter((review: ReviewSummaryDto) => review.category === key).length,
  }))
  .filter(tab => tab.count > 0),
)

const filteredReviews = computed(() => categoryTab.value
  ? reviews.value.filter((review: ReviewSummaryDto) => review.category === categoryTab.value)
  : reviews.value,
)

function startPlayback(startSeconds = 0): void {
  if (!track.value.youtubeVideoId) return

  player.load(
    {
      videoId: track.value.youtubeVideoId,
      title: track.value.title,
      producerName: track.value.producerName,
      voiceSynthesizer: track.value.voiceSynthesizer,
    },
    startSeconds,
    true,
  )
}

useSeoMeta({
  title: () => `${track.value.title} / ${track.value.producerName}`,
  description: () => `${track.value.title}（${track.value.producerName}・${track.value.voiceSynthesizer}）のレビュー一覧。`,
  ogImage: () => track.value.thumbnailUrl,
})
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div class="min-w-0 space-y-6">
      <header class="panel p-5">
        <div class="grid gap-6 md:grid-cols-[380px_minmax(0,1fr)]">
          <div class="relative overflow-hidden rounded-lg border border-ink-700">
            <TrackThumbnail :src="track.thumbnailUrl" :video-id="track.youtubeVideoId" :alt="track.title" class="aspect-video w-full" />
            <MilestoneRibbon :milestone="track.milestone" :view-count="track.viewCount" />
          </div>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-[11px]">
              <span v-if="track.engineType" class="rounded border border-ink-700 px-1.5 py-px text-stone-400">
                {{ track.engineType }}
              </span>
              <span v-if="reviews.length" class="rounded bg-glow-400/90 px-1.5 py-px font-bold text-ink-950">
                レビュー {{ reviews.length }} 本
              </span>
              <span class="font-mono text-stone-400">
                {{ track.releaseYear }}
              </span>
            </div>

            <h1 class="mt-2 text-xl font-bold leading-snug text-stone-50 sm:text-2xl">
              {{ track.title }}
            </h1>

            <p class="mt-2 text-[13px] text-stone-300">
              {{ track.producerName }}
            </p>

            <p class="mt-1 text-[12.5px] text-hz-300">
              {{ track.voiceSynthesizer }}
            </p>

            <button
              v-if="track.youtubeVideoId"
              type="button"
              class="btn-primary mt-4 !py-1.5 !text-[12px]"
              @click="startPlayback(0)"
            >
              ▶ プレイヤーで再生する
            </button>
          </div>
        </div>
      </header>

      <section v-if="player.track?.videoId === track.youtubeVideoId" class="panel p-4" style="backdrop-filter: none">
        <YouTubePlayer />
      </section>

      <section>
        <h2 class="section-title">
          この曲のレビュー（{{ filteredReviews.length }} 本）
        </h2>

        <!-- カテゴリで絞り込むタブ（LAYOUT_ARCHITECTURE §2.4） -->
        <div v-if="reviewTabs.length >= 2" class="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="chip !px-2.5 !py-1 !text-[11.5px]"
            :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': !categoryTab }"
            @click="categoryTab = null"
          >
            すべて
            <span class="font-mono text-[11px] text-stone-400">{{ reviews.length }}</span>
          </button>

          <button
            v-for="tab in reviewTabs"
            :key="tab.key"
            type="button"
            class="chip !px-2.5 !py-1 !text-[11.5px]"
            :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': categoryTab === tab.key }"
            @click="categoryTab = categoryTab === tab.key ? null : tab.key"
          >
            {{ tab.label }}
            <span class="font-mono text-[11px] text-stone-400">{{ tab.count }}</span>
          </button>
        </div>

        <div v-if="filteredReviews.length" class="mt-4 space-y-4">
          <ReviewCard v-for="review in filteredReviews" :key="review.id" :review="review" />
        </div>

        <div v-else class="panel mt-4 p-8 text-center">
          <p class="text-[13px] text-stone-400">
            {{ reviews.length ? 'このカテゴリのレビューはまだありません。' : 'この曲にはまだレビューがありません。' }}
          </p>
          <NuxtLink
            v-if="!reviews.length"
            :to="`/editor?track=${encodeURIComponent(track.slug)}`"
            class="btn-primary mt-4 !py-1.5 !text-[12px]"
          >
            最初のレビューを書く
          </NuxtLink>
        </div>
      </section>
    </div>

    <aside class="space-y-5">
      <section class="panel p-5">
        <p class="panel-title">
          このボカロPの他の曲
        </p>
        <p class="mt-3 text-[12px] text-stone-400">
          楽曲ライブラリから {{ track.producerName }} の曲を探せます。
        </p>
        <NuxtLink
          :to="`/tracks?q=${encodeURIComponent(track.producerName)}`"
          class="btn-ghost mt-3 w-full !py-1.5 !text-[12px]"
        >
          {{ track.producerName }} で検索
        </NuxtLink>
      </section>

      <SideManifesto />
      <SideLoungeBanner />
    </aside>
  </div>
</template>
