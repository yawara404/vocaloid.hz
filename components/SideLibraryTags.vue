<script setup lang="ts">
/**
 * components/SideLibraryTags.vue
 * サイドバー：音声ライブラリ / カテゴリ / タグ のファセット（GET /api/facets）
 */
import type { FacetCount } from '~~/shared/types'
import { CATEGORY_LABELS } from '~~/shared/types'

defineProps<{
  libraries: FacetCount[]
  categories: FacetCount[]
  tags: FacetCount[]
}>()
</script>

<template>
  <section class="panel p-5">
    <p class="panel-title">
      音声ライブラリ別
    </p>
    <ul class="mt-3 space-y-2">
      <li v-for="item in libraries" :key="item.key">
        <NuxtLink
          :to="`/search?synthesizer=${encodeURIComponent(item.key)}`"
          class="flex items-baseline justify-between gap-2 py-0.5 text-[12px] text-stone-400 transition hover:text-hz-200"
        >
          <span class="truncate">{{ item.label }}</span>
          <span class="font-mono text-[11.5px] text-stone-400">{{ item.count }}</span>
        </NuxtLink>
      </li>
    </ul>

    <p class="panel-title mt-6">
      カテゴリ別
    </p>
    <ul class="mt-3 space-y-2">
      <li v-for="item in categories" :key="item.key">
        <NuxtLink
          :to="`/reviews?category=${encodeURIComponent(item.key)}`"
          class="flex items-baseline justify-between gap-2 py-0.5 text-[12px] text-stone-400 transition hover:text-hz-200"
        >
          <span>{{ CATEGORY_LABELS[item.key as keyof typeof CATEGORY_LABELS] ?? item.label }}</span>
          <span class="font-mono text-[11.5px] text-stone-400">{{ item.count }}</span>
        </NuxtLink>
      </li>
    </ul>

    <template v-if="tags.length">
      <p class="panel-title mt-6">
        テーマタグ
      </p>
      <div class="mt-3 flex flex-wrap gap-1">
        <NuxtLink
          v-for="tag in tags.slice(0, 24)"
          :key="tag.key"
          :to="`/search?tag=${encodeURIComponent(tag.label)}`"
          class="chip !px-2.5 !py-1"
          :title="`${tag.label} のレビュー ${tag.count} 本`"
        >
          #{{ tag.label }}
          <span class="font-mono text-[11px] text-stone-400">{{ tag.count }}</span>
        </NuxtLink>
      </div>
    </template>
  </section>
</template>
