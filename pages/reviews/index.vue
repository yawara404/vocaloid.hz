<script setup lang="ts">
/**
 * pages/reviews/index.vue
 * レビュー一覧（フィルター / 検索 / 並び替え / ページネーション）
 * すべての状態は URL クエリに持ち、SSR でも同じ結果を返す。
 */
import type {
  FacetCount,
  FacetsResponse,
  ReviewCategory,
  ReviewListResponse,
  TagListResponse,
} from '~~/shared/types'
import { CATEGORY_LABELS } from '~~/shared/types'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 20

function stringOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  return value.trim()
}

const library = computed(() => stringOf(route.query.library))
const category = computed(() => stringOf(route.query.category) as ReviewCategory | null)
const tagSlug = computed(() => stringOf(route.query.tag))
const authorUsername = computed(() => stringOf(route.query.author))
const keyword = computed(() => stringOf(route.query.q) ?? '')
const sort = computed(() => stringOf(route.query.sort) ?? 'new')
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))

const queryParams = computed(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  library: library.value ?? undefined,
  category: category.value ?? undefined,
  tag: tagSlug.value ?? undefined,
  author: authorUsername.value ?? undefined,
  q: keyword.value || undefined,
  sort: sort.value,
}))

/** GET /api/reviews → { items, total, featured, page, pageSize } */
const { data: reviews, pending } = await useFetch<ReviewListResponse>('/api/reviews', {
  query: queryParams,
})

const { data: facets } = await useFetch<FacetsResponse>('/api/facets')
const { data: tagPayload } = await useFetch<TagListResponse>('/api/tags?limit=100')

const tagOptions = computed<FacetCount[]>(() => tagPayload.value?.items ?? [])

const pageCount = computed(() => {
  const total = reviews.value?.total ?? 0
  const size = Math.max(1, reviews.value?.pageSize ?? PAGE_SIZE)
  return Math.max(1, Math.ceil(total / size))
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

const activeTag = computed(() => {
  if (!tagSlug.value) return null
  return tagOptions.value.find((item: FacetCount) => item.key === tagSlug.value) ?? null
})

const heading = computed(() => {
  if (keyword.value) return `「${keyword.value}」の検索結果`
  if (activeTag.value) return `#${activeTag.value.label} のレビュー`
  if (category.value) return `${CATEGORY_LABELS[category.value as ReviewCategory]}のレビュー`
  if (library.value) return `${library.value} のレビュー`
  return 'レビュー一覧'
})

useSeoMeta({
  title: 'レビュー一覧',
  description: '好きなボカロの感想を読んで語れるボカれびゅサイト。曲や歌声ライブラリ、タグからレビューを探せます。',
})
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div class="min-w-0 space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="section-title !text-lg">
            {{ heading }}
          </h1>
          <p class="mt-1 text-[12px] text-stone-400">
            全 {{ reviews?.total ?? 0 }} 本 ／ {{ pageCount }} ページ中
            {{ reviews?.page ?? page }} ページ目
          </p>
        </div>

        <NuxtLink to="/editor" class="btn-primary !py-1.5 !text-[12px]">
          レビューを書く
        </NuxtLink>
      </header>

      <FilterBar
        :libraries="facets?.libraries ?? []"
        :category-counts="facets?.categories ?? []"
        :library="library"
        :category="category"
        :sort="sort"
        :q="keyword"
        @update:library="value => setQuery({ library: value, page: 1 })"
        @update:category="value => setQuery({ category: value, page: 1 })"
        @update:sort="value => setQuery({ sort: value, page: 1 })"
        @update:q="value => setQuery({ q: value, page: 1 })"
      />

      <div v-if="activeTag || library || authorUsername" class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] text-stone-400">絞り込み:</span>

        <button v-if="activeTag" type="button" class="chip" @click="setQuery({ tag: null, page: 1 })">
          #{{ activeTag.label }} ✕
        </button>
        <button v-if="library" type="button" class="chip" @click="setQuery({ library: null, page: 1 })">
          {{ library }} ✕
        </button>
        <button v-if="authorUsername" type="button" class="chip" @click="setQuery({ author: null, page: 1 })">
          {{ authorUsername }} ✕
        </button>
      </div>

      <div v-if="pending && !reviews" class="space-y-4">
        <div v-for="index in 5" :key="index" class="panel h-[124px] animate-pulse" />
      </div>

      <div v-else-if="reviews?.items.length" class="space-y-4">
        <ReviewCard v-for="review in reviews.items" :key="review.id" :review="review" />
      </div>

      <p v-else class="panel p-10 text-center text-[13px] text-stone-400">
        条件に一致するレビューが見つかりませんでした。
      </p>

      <Pagination
        :page="reviews?.page ?? page"
        :page-size="reviews?.pageSize ?? PAGE_SIZE"
        :total="reviews?.total ?? 0"
        @update:page="onPageChange"
      />
    </div>

    <aside class="space-y-5">
      <SideManifesto />
      <SideLibraryTags
        :libraries="facets?.libraries ?? []"
        :categories="facets?.categories ?? []"
        :tags="tagOptions"
      />
      <SideLoungeBanner />
    </aside>
  </div>
</template>
