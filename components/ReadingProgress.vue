<script setup lang="ts">
/**
 * components/ReadingProgress.vue
 * ---------------------------------------------------------------
 * 固定ヘッダー（56px）の真下に出す 2px の読了プログレスバー
 * （LAYOUT_ARCHITECTURE §2.1）。
 *
 * ページ全体のスクロール率で測るため、本文の高さに関わらず
 * 「あとどれくらいで読み終わるか」が一目で分かる。
 */
const progress = ref(0)
let frame = 0

function update(): void {
  const document_ = document.documentElement
  const max = document_.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
}

function onScroll(): void {
  if (frame) return
  frame = window.requestAnimationFrame(() => {
    frame = 0
    update()
  })
}

onMounted(() => {
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})

onBeforeUnmount(() => {
  if (frame) window.cancelAnimationFrame(frame)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <!-- sticky top-14 = ヘッダー（h-14）のすぐ下に貼り付く。読み上げ対象ではないので aria-hidden -->
  <div class="sticky top-14 z-sticky -mt-2 h-0.5 w-full overflow-hidden bg-transparent" aria-hidden="true">
    <div
      class="h-full origin-left bg-hz-500 transition-[width] duration-150 ease-out"
      :style="{ width: `${Math.round(progress * 100)}%` }"
    />
  </div>
</template>
