<script setup lang="ts">
/**
 * error.vue
 * グローバルエラー / 404 ページ（レイアウトなしで描画される）
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error?.statusCode === 404)

const title = computed(() => (isNotFound.value ? 'ページが見つかりません' : '問題が発生しました'))

const description = computed(() => {
  if (isNotFound.value) {
    return 'お探しのレビューは削除されたか、URL が変更された可能性があります。アーカイブから探してみてください。'
  }
  return props.error?.statusMessage || 'しばらく時間をおいてから、もう一度お試しください。'
})

useSeoMeta({
  title: () => `${title.value} | vocaloid.hz`,
})

function goHome(): void {
  clearError({ redirect: '/' })
}

function goArchive(): void {
  clearError({ redirect: '/reviews' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
    <p class="font-mono text-[64px] font-bold leading-none text-primary">
      {{ error?.statusCode ?? 500 }}
    </p>

    <h1 class="mt-4 text-xl font-bold text-stone-100">
      {{ title }}
    </h1>

    <p class="mt-3 max-w-md text-[13px] leading-relaxed text-stone-400">
      {{ description }}
    </p>

    <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
      <button type="button" class="btn-primary" @click="goHome">
        トップへ戻る
      </button>
      <button type="button" class="btn-ghost" @click="goArchive">
        レビュー一覧
      </button>
    </div>

    <p class="mt-10 font-mono text-[11px] text-stone-400">
      vocaloid.hz
    </p>
  </div>
</template>
