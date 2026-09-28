<script setup lang="ts">
/**
 * components/Pagination.vue
 */
const props = defineProps<{ page: number, pageSize: number, total: number }>()
const emit = defineEmits<{ (event: 'update:page', page: number): void }>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))))

const visiblePages = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, Math.min(props.page - 2, pageCount.value - 4))
  const end = Math.min(pageCount.value, start + 4)
  for (let index = start; index <= end; index += 1) pages.push(index)
  return pages
})

function go(page: number): void {
  if (page < 1 || page > pageCount.value || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <nav v-if="pageCount > 1" class="flex items-center justify-center gap-1.5" aria-label="ページネーション">
    <button
      type="button"
      class="chip"
      :disabled="page <= 1"
      :class="{ 'cursor-not-allowed opacity-40': page <= 1 }"
      @click="go(page - 1)"
    >
      前へ
    </button>

    <button
      v-for="item in visiblePages"
      :key="item"
      type="button"
      class="chip font-mono"
      :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': item === page }"
      @click="go(item)"
    >
      {{ item }}
    </button>

    <button
      type="button"
      class="chip"
      :disabled="page >= pageCount"
      :class="{ 'cursor-not-allowed opacity-40': page >= pageCount }"
      @click="go(page + 1)"
    >
      次へ
    </button>
  </nav>
</template>
