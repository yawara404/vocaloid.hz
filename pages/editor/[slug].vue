<script setup lang="ts">
/**
 * pages/editor/[slug].vue
 * 既存レビューの編集ページ。下書きも所有者なら取得できるため、
 * 認証判定はクライアント側で行う（server: false）。
 */
import type { ReviewDetailResponse } from '~~/shared/types'
import { useAuthStore } from '~~/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const { data: payload, error, pending } = await useFetch<ReviewDetailResponse>(
  () => `/api/reviews/${route.params.slug}`,
  { server: false },
)

const detail = computed(() => payload.value?.review ?? null)

const checked = ref(false)

onMounted(async () => {
  await auth.fetchSession()
  checked.value = true
})

const canEdit = computed(() => {
  const target = detail.value
  if (!target) return false
  if (target.canEdit) return true
  const user = auth.user
  return Boolean(user && user.id === target.author.id)
})

useSeoMeta({
  title: 'レビューを編集',
  description: '既存のボカロレビューを編集します。',
})
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <header>
      <h1 class="section-title !text-lg">
        レビューを編集
      </h1>
      <p v-if="detail" class="mt-2 text-[12.5px] text-stone-400">
        {{ detail.title }} ／ {{ detail.track.title }}
      </p>
    </header>

    <div v-if="pending || !checked" class="panel mt-6 h-64 animate-pulse" />

    <div v-else-if="error || !detail" class="panel mt-6 p-8 text-center">
      <p class="text-[13px] text-stone-400">
        レビューを読み込めませんでした。
      </p>
      <NuxtLink to="/reviews" class="btn-ghost mt-4">
        アーカイブに戻る
      </NuxtLink>
    </div>

    <div v-else-if="!canEdit" class="panel mt-6 p-8 text-center">
      <p class="text-[13px] text-stone-400">
        このレビューを編集する権限がありません。
      </p>
      <NuxtLink :to="`/reviews/${detail.slug}`" class="btn-ghost mt-4">
        レビューページに戻る
      </NuxtLink>
    </div>

    <ReviewEditor v-else class="mt-6" :review="detail" />
  </div>
</template>
