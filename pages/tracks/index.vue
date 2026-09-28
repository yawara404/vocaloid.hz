<script setup lang="ts">
/**
 * pages/tracks/index.vue
 * 楽曲ライブラリ（音声ライブラリ別フィルタ / 検索 / ページネーション）
 *
 * 実 API: GET /api/tracks?library=&q=&page=&pageSize= → { items, total, page, pageSize }
 *        （items は { track, reviewCount, latestReview } の入れ子）
 */
import type { FacetsResponse, TrackListResponse } from '~~/shared/types'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 24

function stringOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  return value.trim()
}

const library = computed(() => stringOf(route.query.library))
const keyword = computed(() => stringOf(route.query.q) ?? '')
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))

const queryParams = computed(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  library: library.value ?? undefined,
  q: keyword.value || undefined,
}))

const { data: tracks, pending } = await useFetch<TrackListResponse>('/api/tracks', {
  query: queryParams,
})

const { data: facets } = await useFetch<FacetsResponse>('/api/facets')

const currentPage = computed(() => tracks.value?.page ?? page.value)
const pageSize = computed(() => tracks.value?.pageSize ?? PAGE_SIZE)
const total = computed(() => tracks.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const searchInput = ref(keyword.value)

watch(searchInput, (value: string) => {
  setQuery({ q: value.trim(), page: 1 })
})

function setQuery(patch: Record<string, string | number | null | undefined>): void {
  const merged: Record<string, unknown> = { ...route.query, ...patch }
  const next: Record<string, string> = {}

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === '') continue
    next[key] = String(value)
  }

  router.replace({ query: next })
}

function onPageChange(nextPage: number): void {
  setQuery({ page: nextPage })
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

useSeoMeta({
  title: '楽曲ライブラリ',
  description: 'ボカロP・歌声ライブラリ別に整理された楽曲データベース。レビューと楽曲を同じ単位で扱います。',
})
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="section-title !text-lg">
        楽曲ライブラリ
      </h1>
      <p class="mt-1 text-[12px] text-stone-400">
        全 {{ total }} 曲 ／ {{ pageCount }} ページ中 {{ currentPage }} ページ目
      </p>
    </header>

    <section class="panel p-4">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="panel-title mr-1">ライブラリ</span>

        <button
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': !library }"
          @click="setQuery({ library: null, page: 1 })"
        >
          All
        </button>

        <button
          v-for="item in facets?.libraries ?? []"
          :key="item.key"
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': library === item.key }"
          @click="setQuery({ library: library === item.key ? null : item.key, page: 1 })"
        >
          {{ item.label }}
          <span class="font-mono text-[11px] text-stone-400">{{ item.count }}</span>
        </button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-800 pt-3">
        <input
          v-model="searchInput"
          type="search"
          class="field !w-full !py-1.5 !text-[12px] sm:!w-64 sm:!py-1"
          placeholder="曲名・ボカロPで検索"
        >

        <p class="ml-auto text-[11.5px] text-stone-400">
          レビューの多い順に並べています
        </p>
      </div>
    </section>

    <div v-if="pending && !tracks" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="index in 9" :key="index" class="panel h-[110px] animate-pulse" />
    </div>

    <div v-else-if="tracks?.items.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TrackCard v-for="item in tracks.items" :key="item.track.id" :item="item" />
    </div>

    <p v-else class="panel p-10 text-center text-[13px] text-stone-400">
      条件に一致する楽曲が見つかりませんでした。
    </p>

    <Pagination
      :page="currentPage"
      :page-size="pageSize"
      :total="total"
      @update:page="onPageChange"
    />
  </div>
</template>
