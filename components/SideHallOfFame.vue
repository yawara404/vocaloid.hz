<script setup lang="ts">
/**
 * components/SideHallOfFame.vue
 * サイドバー固定コンテンツ②：殿堂入りレビュー
 */
import type { ReviewSummaryDto } from '~~/shared/types'

defineProps<{ reviews: ReviewSummaryDto[] }>()
</script>

<template>
  <section class="panel p-5">
    <p class="panel-title">
      殿堂入りレビュー
    </p>

    <p v-if="!reviews.length" class="mt-3 text-[12px] text-stone-400">
      条件に合うレビューはまだ表示されていません。
    </p>

    <!-- 項目の区切りはディバイダー。上下パディングを均等（12px）に取る -->
    <ul v-else class="mt-2 divide-y divide-ink-800">
      <li v-for="review in reviews" :key="review.id" class="py-3">
        <NuxtLink :to="`/reviews/${review.slug}`" class="group block">
          <p class="line-clamp-2 text-[14px] font-semibold leading-snug text-stone-200 transition group-hover:text-hz-200">
            {{ review.title }}
          </p>
          <p class="mt-1 text-[12px] text-stone-400">
            {{ review.track.title }} / {{ review.author.displayName }}
          </p>
          <MilestoneRibbon class="mt-1.5" :milestone="review.track.milestone" :view-count="review.track.viewCount" inline />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
