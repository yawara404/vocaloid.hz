<script setup lang="ts">
/**
 * pages/index.vue
 * トップページ：注目のレビュー + 最新レビューリスト + サイドバー固定コンテンツ
 *
 * 実 API:
 *   GET /api/reviews?page=1&pageSize=12&sort=new → { items, total, featured, page, pageSize }
 *   GET /api/facets                              → { libraries, categories, engines, tags, hallOfFame, stats }
 */
import type { FacetsResponse, ReviewListResponse, ReviewSummaryDto } from '~~/shared/types'
import { CATEGORY_LABELS } from '~~/shared/types'

const config = useRuntimeConfig()

useSeoMeta({
  description: config.public.siteTagline as string,
})

useHead({
  title: config.public.siteName as string,
  titleTemplate: '%s',
})

const { data: latest } = await useFetch<ReviewListResponse>('/api/reviews', {
  query: { page: 1, pageSize: 20, sort: 'new' },
})

const { data: facets } = await useFetch<FacetsResponse>('/api/facets')

const feature = computed<ReviewSummaryDto | null>(() => latest.value?.featured ?? null)
const items = computed<ReviewSummaryDto[]>(() => latest.value?.items ?? [])

/**
 * ホームに置く「読んでおきたいレビュー」（記事ページのカードと同じ体裁で 4 件）。
 * 特選（ヒーロー）と重複させず、注目フラグの付いたものを優先して、
 * 足りない分は新着で埋める。
 */
const picks = computed<ReviewSummaryDto[]>(() => {
  const rest = items.value.filter((item: ReviewSummaryDto) => item.id !== feature.value?.id)
  const featured = rest.filter((item: ReviewSummaryDto) => item.isFeatured)
  const others = rest.filter((item: ReviewSummaryDto) => !item.isFeatured)
  return [...featured, ...others].slice(0, 4)
})

/** それ以外は最新タイムライン（1 行のスリムリスト）へ */
const timeline = computed<ReviewSummaryDto[]>(() => {
  const used = new Set<string>([feature.value?.id ?? '', ...picks.value.map((item: ReviewSummaryDto) => item.id)])
  return items.value.filter((item: ReviewSummaryDto) => !used.has(item.id)).slice(0, 10)
})
</script>

<template>
  <!--
    トップページ（LAYOUT_ARCHITECTURE §2.2）。
    「上部フィルター帯（全幅）」→「特選 1 件」→「注目 2 列グリッド」→「最新のスリムリスト」
    と密度を変え、流し読みと深掘りの両方に応える。
    右カラムは追従させ、長い一覧でも空洞化しないようにする。
  -->
  <div class="space-y-8">
    <section class="panel flex flex-wrap items-center gap-x-2 gap-y-2 p-3" aria-label="レビューの絞り込み">
      <span class="panel-title mr-1">読む</span>

      <NuxtLink to="/reviews" class="chip !px-2.5 !py-1 !text-[11.5px]">
        すべて
      </NuxtLink>

      <NuxtLink
        v-for="item in facets?.categories ?? []"
        :key="item.key"
        :to="`/reviews?category=${encodeURIComponent(item.key)}`"
        class="chip !px-2.5 !py-1 !text-[11.5px]"
      >
        {{ CATEGORY_LABELS[item.key as keyof typeof CATEGORY_LABELS] ?? item.label }}
        <span class="font-mono text-[11px] text-stone-400">{{ item.count }}</span>
      </NuxtLink>

      <span class="mx-1 hidden h-4 w-px bg-ink-700 sm:block" aria-hidden="true" />

      <NuxtLink
        v-for="item in (facets?.libraries ?? []).slice(0, 6)"
        :key="item.key"
        :to="`/reviews?library=${encodeURIComponent(item.key)}`"
        class="chip !px-2.5 !py-1 !text-[11.5px]"
      >
        {{ item.label }}
      </NuxtLink>
    </section>

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div class="min-w-0 space-y-9">
        <FeatureReview v-if="feature" :review="feature" />

        <section v-if="picks.length">
          <div class="flex items-baseline justify-between gap-4">
            <h2 class="section-title">
              読んでおきたいレビュー
            </h2>
            <NuxtLink to="/reviews?sort=new" class="text-[12px] text-stone-400 transition hover:text-hz-200">
              もっと読む →
            </NuxtLink>
          </div>

          <!-- 記事ページと同じ厚みのあるカード（サムネイル・抜粋・タグつき）を 4 件 -->
          <div class="mt-4 space-y-4">
            <ReviewCard v-for="review in picks" :key="review.id" :review="review" />
          </div>
        </section>

        <section>
          <div class="flex items-baseline justify-between gap-4">
            <h2 class="section-title">
              最新のレビュー
            </h2>
            <NuxtLink to="/reviews" class="text-[12px] text-stone-400 transition hover:text-hz-200">
              アーカイブを見る →
            </NuxtLink>
          </div>

          <div v-if="timeline.length" class="panel mt-4 divide-y divide-ink-800 p-1">
            <ReviewListItem v-for="review in timeline" :key="review.id" :review="review" />
          </div>

          <p v-else class="mt-4 text-[13px] text-stone-400">
            まだレビューがありません。
          </p>

          <div class="mt-4">
            <NuxtLink to="/reviews" class="btn-ghost w-full !text-[12.5px]">
              アーカイブをすべて見る
            </NuxtLink>
          </div>
        </section>
      </div>

      <aside class="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[76px] lg:max-h-[calc(100dvh-160px)] lg:overflow-y-auto">
        <SideManifesto />
        <SideHallOfFame :reviews="facets?.hallOfFame ?? []" />
        <SideLibraryTags
          :libraries="facets?.libraries ?? []"
          :categories="facets?.categories ?? []"
          :tags="facets?.tags ?? []"
        />
        <SideLoungeBanner />
      </aside>
    </div>
  </div>
</template>
