<script setup lang="ts">
/**
 * components/ReviewCard.vue
 * レビューアーカイブ一覧のカード（タイトル / 曲名 / 評者 / 文字数 / タグ）
 */
import type { ReviewSummaryDto } from '~~/shared/types'
import { CATEGORY_LABELS } from '~~/shared/types'

const props = defineProps<{ review: ReviewSummaryDto }>()

const publishedLabel = computed(() => {
  if (!props.review.publishedAt) return '未公開'
  return new Date(props.review.publishedAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
})
</script>

<template>
  <article class="panel group p-4 transition hover:border-hz-600/50">
    <div class="flex gap-4">
      <NuxtLink :to="`/reviews/${review.slug}`" class="relative hidden h-[76px] w-[135px] shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-850 sm:block">
        <TrackThumbnail :src="review.track.thumbnailUrl" :video-id="review.track.youtubeVideoId" :alt="review.track.title" class="h-full w-full opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        <MilestoneRibbon :milestone="review.track.milestone" :view-count="review.track.viewCount" />
      </NuxtLink>

      <div class="flex min-w-0 flex-1 flex-col">
        <!-- いつ / どう評価したか -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-400">
          <span class="rounded border border-hz-700/50 px-1.5 py-px text-hz-300/90">
            {{ CATEGORY_LABELS[review.category] }}
          </span>
          <time :datetime="review.publishedAt ?? undefined" class="font-mono">{{ publishedLabel }}</time>
          <span v-if="review.isFeatured" class="text-glow-400">注目</span>
          <MilestoneRibbon class="sm:hidden" :milestone="review.track.milestone" :view-count="review.track.viewCount" inline />
        </div>

        <NuxtLink :to="`/reviews/${review.slug}`" class="block">
          <h3 class="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-stone-100 transition group-hover:text-hz-200">
            {{ review.title }}
          </h3>
        </NuxtLink>

        <p class="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-stone-400">
          {{ review.excerpt }}
        </p>

        <!-- 何の曲を -->
        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-400">
          <span class="text-stone-300">{{ review.track.title }}</span>
          <span aria-hidden="true">/</span>
          <span>{{ review.track.producerName }}</span>
          <span aria-hidden="true">/</span>
          <span class="text-hz-300">{{ review.track.voiceSynthesizer }}</span>
        </div>

        <!-- 誰が / どれくらい + タグを、カード下辺の 1 行にまとめる -->
        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink-800 pt-2.5">
          <NuxtLink
            :to="`/users/${review.author.username}`"
            class="flex items-center gap-1.5 text-[11.5px] text-stone-300 transition hover:text-hz-200"
          >
            <img
              v-if="review.author.avatarUrl"
              :src="review.author.avatarUrl"
              :alt="review.author.displayName"
              class="h-5 w-5 shrink-0 rounded-full border border-ink-700 object-cover"
              loading="lazy"
            >
            <span
              v-else
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-850 text-[10px] font-semibold text-hz-200"
              aria-hidden="true"
            >{{ review.author.displayName.slice(0, 1) }}</span>
            {{ review.author.displayName }}
          </NuxtLink>

          <p class="flex items-center gap-x-2 text-[11px] text-stone-400">
            <span class="font-mono" title="本文の文字数">{{ review.wordCount.toLocaleString() }} 字</span>
            <span aria-hidden="true">·</span>
            <span title="読了時間の目安">約 {{ review.readingTimeMinutes }} 分</span>
            <span aria-hidden="true">·</span>
            <span class="font-mono text-glow-400/80" title="いいねの数">♥ {{ review.likeCount.toLocaleString() }}</span>
          </p>

          <div v-if="review.tags.length" class="flex flex-wrap gap-1.5 sm:ml-auto">
            <NuxtLink
              v-for="tag in review.tags.slice(0, 5)"
              :key="tag.id"
              :to="`/search?tag=${encodeURIComponent(tag.name)}`"
              class="chip !px-2.5 !py-1 !text-[11px]"
            >
              #{{ tag.name }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
