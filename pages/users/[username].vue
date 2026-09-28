<script setup lang="ts">
/**
 * pages/users/[username].vue
 * 公開プロフィールページ。数字ではなく「書いたレビュー」で語らせる。
 *
 * 実 API: GET /api/users/:username → { author: AuthorDto, reviews: ReviewSummaryDto[], total }
 */
import type { AuthorDto, ReviewSummaryDto, UserProfileResponse } from '~~/shared/types'

const route = useRoute()

const { data: payload, error } = await useFetch<UserProfileResponse>(
  () => `/api/users/${route.params.username}`,
)

if (error.value || !payload.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'ユーザーが見つかりませんでした',
    fatal: true,
  })
}

const current = computed(() => payload.value as UserProfileResponse)
const author = computed<AuthorDto>(() => current.value.author)
const reviews = computed<ReviewSummaryDto[]>(() => current.value.reviews)
const visibleReviews = computed<ReviewSummaryDto[]>(() => reviews.value.slice(0, 9))

const stats = computed(() => ({
  published: current.value.total,
  hallOfFame: reviews.value.filter((item: ReviewSummaryDto) => item.track.milestone !== null).length,
  words: reviews.value.reduce((sum: number, item: ReviewSummaryDto) => sum + item.wordCount, 0),
}))

useSeoMeta({
  title: () => `${author.value.displayName}（@${author.value.username}）`,
  description: () => author.value.bio ?? `${author.value.displayName} さんのボカロレビュー一覧。`,
  ogImage: () => author.value.avatarUrl ?? undefined,
})
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div class="min-w-0 space-y-6">
      <header class="panel p-6">
        <div class="flex items-start gap-4">
          <img
            v-if="author.avatarUrl"
            :src="author.avatarUrl"
            :alt="author.displayName"
            class="h-16 w-16 shrink-0 rounded-full border border-ink-700 object-cover"
            loading="lazy"
          >
          <div
            v-else
            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-hz-700/50 bg-hz-500/10 font-mono text-lg text-hz-300"
          >
            {{ author.displayName.slice(0, 1) }}
          </div>

          <div class="min-w-0">
            <h1 class="text-xl font-bold text-stone-50">
              {{ author.displayName }}
            </h1>
            <p class="mt-0.5 font-mono text-[12px] text-stone-400">
              @{{ author.username }}
            </p>

            <p v-if="author.bio" class="mt-3 text-[13px] leading-relaxed tracking-jp text-stone-300">
              {{ author.bio }}
            </p>
          </div>
        </div>

        <dl class="mt-5 grid grid-cols-3 gap-3 border-t border-ink-800 pt-4 text-center">
          <div>
            <dt class="text-[11.5px] text-stone-400">
              公開レビュー
            </dt>
            <dd class="font-mono text-lg text-stone-100">
              {{ stats.published }}
            </dd>
          </div>
          <div>
            <dt class="text-[11.5px] text-stone-400">
              殿堂入り
            </dt>
            <dd class="font-mono text-lg text-glow-300">
              {{ stats.hallOfFame }}
            </dd>
          </div>
          <div>
            <dt class="text-[11.5px] text-stone-400">
              総文字数
            </dt>
            <dd class="font-mono text-lg text-stone-400">
              {{ stats.words.toLocaleString() }}
            </dd>
          </div>
        </dl>
      </header>

      <section>
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="section-title">
            公開中のレビュー
          </h2>
          <NuxtLink
            v-if="reviews.length > 9"
            :to="`/reviews?author=${encodeURIComponent(author.username)}`"
            class="text-[12px] text-stone-400 transition hover:text-hz-200"
          >
            すべて見る →
          </NuxtLink>
        </div>

        <div v-if="visibleReviews.length" class="mt-4 space-y-4">
          <ReviewCard v-for="review in visibleReviews" :key="review.id" :review="review" />
        </div>

        <p v-else class="panel mt-4 p-8 text-center text-[13px] text-stone-400">
          まだ公開されたレビューがありません。
        </p>
      </section>
    </div>

    <aside class="space-y-5">
      <section class="panel p-5">
        <p class="panel-title">
          この評者について
        </p>
        <p class="mt-3 text-[12px] leading-relaxed text-stone-400">
          vocaloid.hz では、評者の評価は「書いたレビュー」だけで判断されます。
          フォロワー数もインプレッション数もありません。
        </p>
      </section>

      <SideManifesto />
      <SideLoungeBanner />
    </aside>
  </div>
</template>
