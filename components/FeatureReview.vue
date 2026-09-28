<script setup lang="ts">
/**
 * components/FeatureReview.vue
 * トップページ最上部の「注目のレビュー」カード。
 */
import type { ReviewSummaryDto } from '~~/shared/types'
import { CATEGORY_LABELS } from '~~/shared/types'

const props = defineProps<{ review: ReviewSummaryDto }>()

const publishedLabel = computed(() => {
  if (!props.review.publishedAt) return ''
  return new Date(props.review.publishedAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})
</script>

<template>
  <section class="panel relative overflow-hidden">
    <div class="hz-grain pointer-events-none absolute inset-0 opacity-60" />

    <div class="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <NuxtLink
        :to="`/reviews/${review.slug}`"
        class="relative flex items-center overflow-hidden rounded-lg border border-ink-700 bg-ink-850"
      >
        <TrackThumbnail :src="review.track.thumbnailUrl" :video-id="review.track.youtubeVideoId" :alt="review.track.title" eager class="aspect-video w-full opacity-90 transition duration-700 hover:scale-[1.03] hover:opacity-100" />
        <MilestoneRibbon :milestone="review.track.milestone" :view-count="review.track.viewCount" />
      </NuxtLink>

      <div class="flex min-w-0 flex-col">
        <!-- 「どう評価したか」「いつ」のメタ情報は、この 1 行にまとめる -->
        <div class="flex flex-wrap items-center gap-2 text-[11px]">
          <span class="panel-title">注目のレビュー</span>
          <span class="rounded border border-hz-700/50 px-1.5 py-px text-hz-300/90">
            {{ CATEGORY_LABELS[review.category] }}
          </span>
          <time :datetime="review.publishedAt ?? undefined" class="font-mono text-stone-400">{{ publishedLabel }}</time>
        </div>

        <NuxtLink :to="`/reviews/${review.slug}`" class="mt-3">
          <h2 class="text-xl font-bold leading-snug text-stone-50 transition hover:text-hz-200 sm:text-2xl">
            {{ review.title }}
          </h2>
        </NuxtLink>

        <!-- 「何の曲を」 -->
        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-stone-400">
          <span class="text-stone-200">{{ review.track.title }}</span>
          <span class="text-stone-400" aria-hidden="true">/</span>
          <span>{{ review.track.producerName }}</span>
          <span class="text-stone-400" aria-hidden="true">/</span>
          <span class="text-hz-300">{{ review.track.voiceSynthesizer }}</span>
          <span v-if="review.track.engineType" class="text-stone-400">({{ review.track.engineType }})</span>
        </div>

        <p class="mt-4 line-clamp-4 max-w-prose text-[13.5px] leading-[1.9] tracking-jp text-stone-300">
          {{ review.excerpt }}
        </p>

        <!-- CTA と「誰が / どれくらい」を同じフッター行にまとめ、視線を散らさない -->
        <div class="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-ink-800 pt-4">
          <NuxtLink :to="`/reviews/${review.slug}`" class="btn-primary group/cta">
            レビューを読む
            <svg class="h-3.5 w-3.5 transition group-hover/cta:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </NuxtLink>

          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-stone-400">
            <NuxtLink :to="`/users/${review.author.username}`" class="font-medium text-stone-300 transition hover:text-hz-200">
              {{ review.author.displayName }}
            </NuxtLink>
            <span class="text-stone-700" aria-hidden="true">|</span>
            <span class="font-mono" title="本文の文字数">{{ review.wordCount.toLocaleString() }} 字</span>
            <span class="text-stone-700" aria-hidden="true">|</span>
            <span title="読了時間の目安">約 {{ review.readingTimeMinutes }} 分</span>
            <span class="text-stone-700" aria-hidden="true">|</span>
            <span class="font-mono text-glow-400/80" title="いいねの数">♥ {{ review.likeCount.toLocaleString() }}</span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
