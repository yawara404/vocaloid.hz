<script setup lang="ts">
/**
 * components/ReviewToc.vue
 * ---------------------------------------------------------------
 * 記事の右カラムに常設する目次（LAYOUT_ARCHITECTURE §2.1）。
 * 長文でも右側が空にならないよう、章の数だけ伸び、
 * 画面に収まらない分はパネル内でスクロールする。
 */
const props = withDefaults(defineProps<{
  /** 見出しを拾う本文のセレクタ */
  container?: string
}>(), { container: '#review-body' })

const { items, activeId, goTo } = useReviewToc(props.container)
</script>

<template>
  <section v-if="items.length >= 2" class="panel p-5">
    <p class="panel-title">
      目次
    </p>

    <nav class="mt-3 max-h-[42vh] overflow-y-auto pr-1" aria-label="目次">
      <ul class="space-y-0.5">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="flex w-full items-start gap-2 rounded-md py-1.5 pr-2 text-left text-[12px] leading-snug transition"
            :class="[
              item.level === 3 ? 'pl-5' : 'pl-2',
              activeId === item.id ? 'bg-subtle text-hz-200' : 'text-stone-400 hover:text-stone-200',
            ]"
            :aria-current="activeId === item.id ? 'true' : undefined"
            @click="goTo(item.id)"
          >
            <span
              class="mt-[6px] h-1 w-1 shrink-0 rounded-full"
              :class="activeId === item.id ? 'bg-hz-500' : 'bg-ink-600'"
              aria-hidden="true"
            />
            <span class="min-w-0">{{ item.text }}</span>
          </button>
        </li>
      </ul>
    </nav>
  </section>
</template>
