<script setup lang="ts">
import type { FacetsResponse, SearchResponse, TagListResponse } from '~~/shared/types'

const route = useRoute()
const router = useRouter()

function valueOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const q = computed(() => valueOf(route.query.q))
const synthesizer = computed(() => valueOf(route.query.synthesizer))
const tag = computed(() => valueOf(route.query.tag))
const sort = computed(() => {
  const value = valueOf(route.query.sort)
  return value === 'reading_time' || value === 'words' ? value : 'newest'
})

const keywordInput = ref(q.value)
const keywordField = ref<HTMLInputElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

function updateQuery(patch: Record<string, string | null>) {
  const next = { q: q.value, synthesizer: synthesizer.value, tag: tag.value, sort: sort.value, ...patch }
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(next)) {
    if (value && !(key === 'sort' && value === 'newest')) query[key] = value
  }
  void router.replace({ path: '/search', query })
}

watch(q, (value: string) => {
  if (keywordInput.value !== value) keywordInput.value = value
})
watch(keywordInput, (value: string) => {
  clearTimeout(searchTimer)
  if (value.trim() !== q.value) searchTimer = setTimeout(() => updateQuery({ q: value.trim() || null }), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function submitKeyword() {
  clearTimeout(searchTimer)
  updateQuery({ q: keywordInput.value.trim() || null })
  keywordField.value?.blur()
}

function resetFilters() {
  clearTimeout(searchTimer)
  keywordInput.value = ''
  void router.replace({ path: '/search', query: {} })
}

const searchQuery = computed(() => ({
  q: q.value || undefined,
  synthesizer: synthesizer.value || undefined,
  tag: tag.value || undefined,
  sort: sort.value,
}))

const { data: results, pending } = await useFetch<SearchResponse>('/api/search', { query: searchQuery })
const { data: facets } = await useFetch<FacetsResponse>('/api/facets')
const { data: tagPayload } = await useFetch<TagListResponse>('/api/tags?limit=100')

const tags = computed(() => tagPayload.value?.items ?? [])
const heading = computed(() => q.value ? `「${q.value}」の検索結果` : 'レビューを探す')

useSeoMeta({
  title: () => heading.value,
  description: '曲名、ボカロP、評者、音声ライブラリ、タグからボカロレビューを探せます。',
})
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="section-title !text-lg">{{ heading }}</h1>
      <p class="mt-2 text-[12.5px] text-stone-400">曲名、ボカロP、レビュー、評者から探せます。</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="panel h-fit space-y-6 p-5 lg:sticky lg:top-20">
        <form @submit.prevent="submitKeyword">
          <label for="search-keyword" class="panel-title">キーワード</label>
          <div class="mt-2 flex gap-2">
            <input
              id="search-keyword"
              ref="keywordField"
              v-model="keywordInput"
              type="search"
              class="field min-w-0"
              placeholder="曲名・評者・キーワード"
            >
            <button type="submit" class="btn-primary shrink-0 !px-3" aria-label="検索">⌕</button>
          </div>
          <button v-if="keywordInput" type="button" class="mt-2 text-[11px] text-stone-400 hover:text-hz-200" @click="keywordInput = ''">
            キーワードをクリア
          </button>
        </form>

        <div>
          <p class="panel-title">音声ライブラリ</p>
          <div class="mt-2 space-y-1.5">
            <label class="flex cursor-pointer items-center gap-2 text-[12px] text-stone-400">
              <input type="radio" name="synthesizer" :checked="!synthesizer" class="accent-hz-500" @change="updateQuery({ synthesizer: null })">
              すべて
            </label>
            <label v-for="item in facets?.libraries ?? []" :key="item.key" class="flex cursor-pointer items-center gap-2 text-[12px] text-stone-400">
              <input type="radio" name="synthesizer" :checked="synthesizer === item.key" class="accent-hz-500" @change="updateQuery({ synthesizer: item.key })">
              <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
              <span class="font-mono text-[11px] text-stone-400">{{ item.count }}</span>
            </label>
          </div>
        </div>

        <div>
          <p class="panel-title">タグ</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button
              v-for="item in tags"
              :key="item.key"
              type="button"
              class="chip !text-[11.5px]"
              :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': tag === item.label || tag === item.key }"
              @click="updateQuery({ tag: tag === item.label || tag === item.key ? null : item.label })"
            >#{{ item.label }}</button>
          </div>
        </div>

        <label class="block">
          <span class="panel-title">並び順</span>
          <select :value="sort" class="field mt-2" @change="updateQuery({ sort: ($event.target as HTMLSelectElement).value })">
            <option value="newest">新着順</option>
            <option value="reading_time">読了時間順</option>
            <option value="words">文字数順</option>
          </select>
        </label>

        <button type="button" class="btn-ghost w-full !text-[12px]" @click="resetFilters">絞り込みをリセット</button>
      </aside>

      <main class="min-w-0">
        <p class="mb-4 text-[12px] text-stone-400">{{ results?.total ?? 0 }} 件のレビュー</p>
        <div v-if="pending && !results" class="space-y-4">
          <div v-for="index in 4" :key="index" class="panel h-32 animate-pulse" />
        </div>
        <div v-else-if="results?.items.length" class="space-y-4">
          <ReviewCard v-for="review in results.items" :key="review.id" :review="review" />
        </div>
        <div v-else class="panel p-10 text-center">
          <p class="text-[13px] text-stone-400">一致するレビューが見つかりませんでした。</p>
          <p class="mt-2 text-[12px] text-stone-400">別のキーワードやライブラリでお試しください。</p>
        </div>
        <p v-if="(results?.total ?? 0) > 30" class="mt-4 text-[11px] text-stone-400">先頭の30件を表示しています。条件を絞るとさらに探せます。</p>
      </main>
    </div>
  </div>
</template>
