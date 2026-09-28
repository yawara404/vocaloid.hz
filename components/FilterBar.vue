<script setup lang="ts">
/**
 * components/FilterBar.vue
 * 音声ライブラリ別 / カテゴリ別 / 並び替え / 検索 のフィルターバー。
 * 値はすべて v-model で親（ページ）に返し、親が URL クエリと同期する。
 */
import type { FacetCount, ReviewCategory } from '~~/shared/types'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~~/shared/types'

defineProps<{
  libraries: FacetCount[]
  categoryCounts?: FacetCount[]
}>()

const library = defineModel<string | null>('library', { default: null })
const category = defineModel<ReviewCategory | null>('category', { default: null })
const sort = defineModel<string>('sort', { default: 'new' })
const q = defineModel<string>('q', { default: '' })

const searchInput = ref(q.value ?? '')

watch(searchInput, (value: string) => {
  q.value = value.trim()
})

watch(q, (value: string | undefined) => {
  if ((value ?? '') !== searchInput.value) searchInput.value = value ?? ''
})

const sortOptions = [
  { value: 'new', label: '新着順' },
  { value: 'old', label: '古い順' },
  { value: 'words', label: '文字数順' },
  { value: 'title', label: 'タイトル順' },
]
</script>

<template>
  <section class="panel p-4">
    <!-- 音声ライブラリ -->
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="panel-title mr-1">ライブラリ</span>

      <button
        type="button"
        class="chip"
        :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': !library }"
        @click="library = null"
      >
        All
      </button>

      <button
        v-for="item in libraries.slice(0, 10)"
        :key="item.key"
        type="button"
        class="chip"
        :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': library === item.key }"
        @click="library = library === item.key ? null : item.key"
      >
        {{ item.label }}
        <span class="font-mono text-[11px] text-stone-400">{{ item.count }}</span>
      </button>
    </div>

    <!-- カテゴリ + 並び替え + 検索 -->
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-800 pt-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="panel-title mr-1">カテゴリ</span>

        <button
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': !category }"
          @click="category = null"
        >
          All
        </button>

        <button
          v-for="key in CATEGORY_ORDER"
          :key="key"
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': category === key }"
          @click="category = category === key ? null : key"
        >
          {{ CATEGORY_LABELS[key] }}
          <span v-if="categoryCounts" class="font-mono text-[11px] text-stone-400">
            {{ categoryCounts.find(item => item.key === key)?.count ?? 0 }}
          </span>
        </button>
      </div>

      <label class="ml-auto flex items-center gap-2 text-[11.5px] text-stone-400">
        <span class="panel-title">並び替え</span>
        <select v-model="sort" class="field !w-auto !py-1.5 !text-[13px] sm:!py-1 sm:!text-[12.5px]">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex items-center gap-2">
        <span class="sr-only">レビューを検索</span>
        <input
          v-model="searchInput"
          type="search"
          class="field !w-full !py-1.5 !text-[13px] sm:!w-52 sm:!py-1 sm:!text-[12.5px]"
          placeholder="曲名・ボカロP・本文を検索"
        >
      </label>
    </div>
  </section>
</template>
