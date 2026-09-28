<script setup lang="ts">
/**
 * components/ReviewListItem.vue
 * ---------------------------------------------------------------
 * トップページの「最新のレビュー」を 1 行で並べるスリムなリスト
 * （LAYOUT_ARCHITECTURE §2.2）。
 * 日付 → タイトル → 楽曲 / 評者 → 読了目安。サムネイルは持たず、流し読みの速度を優先する。
 */
import type { ReviewSummaryDto } from '~~/shared/types'

const props = defineProps<{ review: ReviewSummaryDto }>()

const publishedLabel = computed(() => {
  if (!props.review.publishedAt) return '未公開'
  return new Date(props.review.publishedAt).toLocaleDateString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
  })
})
</script>

<template>
  <NuxtLink
    :to="`/reviews/${review.slug}`"
    class="group flex items-baseline gap-x-3 rounded-md px-2 py-2.5 transition hover:bg-ink-850/70"
  >
    <time :datetime="review.publishedAt ?? undefined" class="w-[52px] shrink-0 font-mono text-[11px] text-stone-400">
      {{ publishedLabel }}
    </time>

    <span class="min-w-0 flex-1 truncate text-[13px] text-stone-200 transition group-hover:text-hz-200">
      {{ review.title }}
    </span>

    <span class="hidden max-w-[220px] shrink-0 truncate text-[11px] text-stone-400 md:block">
      {{ review.track.title }} / {{ review.author.displayName }}
    </span>

    <span class="shrink-0 font-mono text-[11px] text-stone-400">
      約 {{ review.readingTimeMinutes }} 分
    </span>
  </NuxtLink>
</template>
