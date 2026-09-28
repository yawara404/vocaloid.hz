<script setup lang="ts">
/**
 * components/TrackCard.vue
 * 楽曲ライブラリのカード（GET /api/tracks の items 要素 = TrackListItem）
 */
import type { TrackListItem } from '~~/shared/types'

const props = defineProps<{ item: TrackListItem }>()

const track = computed(() => props.item.track)
const hasHallOfFame = computed(() => props.item.reviewCount > 0)
</script>

<template>
  <article class="panel group p-3 transition hover:border-hz-600/50">
    <NuxtLink :to="`/tracks/${track.slug}`" class="flex gap-3">
      <div class="relative h-[68px] w-[121px] shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-850">
        <TrackThumbnail :src="track.thumbnailUrl" :video-id="track.youtubeVideoId" :alt="track.title" class="h-full w-full opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        <MilestoneRibbon :milestone="track.milestone" :view-count="track.viewCount" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 text-[11px] text-stone-400">
          <span v-if="track.engineType" class="rounded border border-ink-700 px-1.5 py-px">
            {{ track.engineType }}
          </span>
          <span v-if="hasHallOfFame" class="rounded border border-glow-400/40 px-1.5 py-px text-glow-300">
            レビュー {{ item.reviewCount }}
          </span>
          <span class="ml-auto font-mono">{{ track.releaseYear }}</span>
        </div>

        <h3 class="mt-1 truncate text-[14px] font-semibold text-stone-100 transition group-hover:text-hz-200">
          {{ track.title }}
        </h3>

        <p class="truncate text-[11.5px] text-stone-400">
          {{ track.producerName }}
        </p>

        <p class="mt-0.5 text-[11px] text-hz-300">
          {{ track.voiceSynthesizer }}
        </p>

        <p v-if="item.latestReview" class="mt-1 truncate text-[11.5px] text-stone-400">
          最新: {{ item.latestReview.title }}
        </p>
        <p v-else class="mt-1 text-[11.5px] text-stone-400">
          まだレビューがありません
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
