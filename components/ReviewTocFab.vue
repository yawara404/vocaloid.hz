<script setup lang="ts">
/**
 * components/ReviewTocFab.vue
 * ---------------------------------------------------------------
 * モバイル用の目次（LAYOUT_ARCHITECTURE §2.1）。
 * 右下に小さな丸ボタンを置き、押すとボトムシート（z-sheet）で目次を出す。
 * デスクトップ（lg 以上）では ReviewToc が右カラムに常設されるので表示しない。
 */
const props = withDefaults(defineProps<{
  container?: string
}>(), { container: '#review-body' })

const { items, activeId, goTo } = useReviewToc(props.container)
const open = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)

function openSheet(): void {
  open.value = true
  nextTick(() => closeButton.value?.focus())
}

function select(id: string): void {
  open.value = false
  goTo(id)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) open.value = false
}

watch(open, (value: boolean) => {
  if (!import.meta.client) return
  document.body.classList.toggle('overflow-hidden', value)
  if (value) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('overflow-hidden')
})
</script>

<template>
  <div v-if="items.length >= 2" class="lg:hidden">
    <button
      type="button"
      class="fixed bottom-[88px] right-4 z-dropdown flex h-11 w-11 items-center justify-center rounded-full border border-ink-700 bg-ink-900/95 text-stone-300 shadow-modal backdrop-blur-md transition hover:text-hz-200"
      :aria-expanded="open"
      aria-label="目次を開く"
      title="目次"
      @click="openSheet"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h10M4 18h13" />
      </svg>
    </button>

    <!-- ボトムシートは body 直下へ（ヘッダーや sticky の重なりに影響されないように） -->
    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-sheet lg:hidden">
        <div class="absolute inset-0 bg-scrim backdrop-blur-sm" @click="open = false" />

        <div
          class="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-ink-700 bg-ink-900 p-4 pb-[calc(72px+env(safe-area-inset-bottom)+16px)] shadow-modal"
          role="dialog"
          aria-modal="true"
          aria-label="目次"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="panel-title">
              目次
            </p>
            <button
              ref="closeButton"
              type="button"
              class="rounded-md px-2 py-1 text-[12px] text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
              @click="open = false"
            >
              閉じる
            </button>
          </div>

          <nav class="mt-3" aria-label="目次">
            <ul class="space-y-0.5">
              <li v-for="item in items" :key="item.id">
                <button
                  type="button"
                  class="flex w-full items-start gap-2 rounded-md py-2 pr-2 text-left text-[13px] leading-snug transition"
                  :class="[
                    item.level === 3 ? 'pl-5' : 'pl-2',
                    activeId === item.id ? 'bg-subtle text-hz-200' : 'text-stone-300 hover:bg-ink-850',
                  ]"
                  @click="select(item.id)"
                >
                  <span
                    class="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                    :class="activeId === item.id ? 'bg-hz-500' : 'bg-ink-600'"
                    aria-hidden="true"
                  />
                  <span class="min-w-0">{{ item.text }}</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </Teleport>
  </div>
</template>
