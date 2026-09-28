<script setup lang="ts">
/**
 * pages/reviews/[slug].vue
 * ---------------------------------------------------------------
 * レビューの詳細ページ（このサイトの本体）。
 *
 * 実 API: GET /api/reviews/:slug → { review: ReviewDetailDto, track: TrackDto, related: ReviewSummaryDto[] }
 *  - 本文はサーバー側でレンダリング済みの contentHtml（[mm:ss] は data-seek 付きボタン）
 *  - 多面的分析評価メーター
 *  - 記事内 YouTube プレイヤーへ楽曲を渡す
 *  - 所有権のあるユーザーにだけ編集 / 削除を出す
 */
import type { ReviewCategory, ReviewDetailDto, ReviewDetailResponse, ReviewSummaryDto, TrackDto } from '~~/shared/types'
import { CATEGORY_LABELS } from '~~/shared/types'
import { extractTimestamps } from '~~/shared/markdown'
import { useAuthStore } from '~~/stores/auth'
import { usePlayerStore } from '~~/stores/player'

const route = useRoute()
const auth = useAuthStore()
const player = usePlayerStore()

const { data: payload, error } = await useFetch<ReviewDetailResponse>(
  () => `/api/reviews/${route.params.slug}`,
)

if (error.value || !payload.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'レビューが見つかりませんでした',
    fatal: true,
  })
}

const current = computed(() => payload.value as ReviewDetailResponse)
const review = computed<ReviewDetailDto>(() => current.value.review)
const track = computed<TrackDto>(() => current.value.track)
const related = computed<ReviewSummaryDto[]>(() => current.value.related)

/** サーバー側でレンダリング済み（XSS 安全）の本文 HTML */
const renderedBody = computed(() => review.value.contentHtml)
const hasTimestamps = computed(() => extractTimestamps(review.value.contentMarkdown).length > 0)

const categoryLabel = computed(() => CATEGORY_LABELS[review.value.category as ReviewCategory])

const publishedLabel = computed(() => {
  const value = review.value.publishedAt
  if (!value) return '未公開'
  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const siblingReviews = computed(() => related.value.filter((item: ReviewSummaryDto) => item.id !== review.value.id))

const canManage = computed(() => {
  if (review.value.canEdit) return true
  const user = auth.user
  return Boolean(user && user.id === review.value.author.id)
})

const deleting = ref(false)
const likeCount = ref(review.value.likeCount)
const likedByViewer = ref(review.value.likedByViewer)
const liking = ref(false)

async function toggleLike(): Promise<void> {
  if (!auth.isAuthenticated) {
    await navigateTo(`/login?next=${encodeURIComponent(route.fullPath)}`)
    return
  }
  if (liking.value) return
  liking.value = true
  try {
    const result = await $fetch<{ likeCount: number; likedByViewer: boolean }>(`/api/reviews/${review.value.slug}/like`, {
      method: likedByViewer.value ? 'DELETE' : 'PUT',
    })
    likeCount.value = result.likeCount
    likedByViewer.value = result.likedByViewer
  }
  catch (err: any) {
    window.alert(err?.data?.message ?? 'いいねを更新できませんでした')
  }
  finally {
    liking.value = false
  }
}

/** 記事内プレイヤーへ楽曲を渡す（?t=123 で開始秒を指定可能） */
function startPlayback(startSeconds = 0): void {
  if (!track.value.youtubeVideoId) return

  player.load(
    {
      videoId: track.value.youtubeVideoId,
      title: track.value.title,
      producerName: track.value.producerName,
      voiceSynthesizer: track.value.voiceSynthesizer,
      reviewSlug: review.value.slug,
    },
    startSeconds,
  )
}

onMounted(() => {
  const requested = Number(route.query.t ?? 0)
  startPlayback(Number.isFinite(requested) && requested > 0 ? requested : 0)
})

async function onDelete(): Promise<void> {
  if (!window.confirm('このレビューを削除しますか？ この操作は取り消せません。')) return

  deleting.value = true
  try {
    await $fetch(`/api/reviews/${review.value.slug}`, { method: 'DELETE' })
    await navigateTo('/reviews')
  }
  catch (err: any) {
    window.alert(err?.data?.message ?? '削除に失敗しました')
    deleting.value = false
  }
}

useSeoMeta({
  title: () => `${review.value.title}（${track.value.title} / ${track.value.producerName}）`,
  description: () => review.value.excerpt,
  ogTitle: () => review.value.title,
  ogDescription: () => review.value.excerpt,
  ogImage: () => track.value.thumbnailUrl,
  ogType: 'article',
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: review.value.title,
        description: review.value.excerpt,
        image: track.value.thumbnailUrl,
        datePublished: review.value.publishedAt,
        dateModified: review.value.updatedAt,
        wordCount: review.value.wordCount,
        articleSection: categoryLabel.value,
        author: {
          '@type': 'Person',
          name: review.value.author.displayName,
          url: `/users/${review.value.author.username}`,
        },
        about: {
          '@type': 'MusicComposition',
          name: track.value.title,
          byArtist: { '@type': 'Person', name: track.value.producerName },
        },
      }),
    },
  ],
}))
</script>

<template>
  <!--
    記事詳細（LAYOUT_ARCHITECTURE §2.1）。
    デスクトップは「本文（最大 720px）+ 追従する 340px の右カラム」の非対称 2 カラム。
    右カラムには目次を常設し、長文でも右側が空洞化しないようにする。
  -->
  <div>
    <ReadingProgress />

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
      <article class="min-w-0 max-w-article">
        <nav class="mb-3 flex items-center gap-1 text-[11.5px] text-stone-400" aria-label="パンくず">
          <NuxtLink to="/reviews" class="transition hover:text-hz-200">
            レビュー
          </NuxtLink>
          <span class="text-stone-700" aria-hidden="true">/</span>
          <NuxtLink :to="`/tracks/${track.slug}`" class="min-w-0 truncate transition hover:text-hz-200">
            {{ track.title }}
          </NuxtLink>
        </nav>

        <header class="panel p-6">
        <div class="flex flex-wrap items-center gap-2 text-[11px]">
          <span class="rounded border border-hz-700/50 px-1.5 py-px text-hz-300/90">
            {{ categoryLabel }}
          </span>
          <MilestoneRibbon :milestone="track.milestone" :view-count="track.viewCount" inline />
          <span v-if="!review.publishedAt" class="rounded border border-glow-500/60 px-1.5 py-px text-glow-300">
            下書き
          </span>
          <span class="font-mono text-stone-400">{{ publishedLabel }}</span>
        </div>

        <h1 class="mt-3 text-2xl font-bold leading-snug text-stone-50 sm:text-[28px]">
          {{ review.title }}
        </h1>

        <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-stone-400">
          <NuxtLink :to="`/tracks/${track.slug}`" class="text-stone-200 transition hover:text-hz-200">
            {{ track.title }}
          </NuxtLink>
          <span class="text-stone-700">/</span>
          <span>{{ track.producerName }}</span>
          <span class="text-stone-700">/</span>
          <span class="text-hz-300">{{ track.voiceSynthesizer }}</span>
          <span v-if="track.engineType" class="text-stone-400">（{{ track.engineType }}）</span>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-stone-400">
          <NuxtLink :to="`/users/${review.author.username}`" class="text-stone-300 transition hover:text-hz-200">
            {{ review.author.displayName }}
          </NuxtLink>
          <span class="font-mono">{{ review.wordCount.toLocaleString() }} 字</span>
          <span>約 {{ review.readingTimeMinutes }} 分</span>
          <button
            v-if="review.publishedAt"
            type="button"
            class="rounded-md border px-2 py-1 transition"
            :class="likedByViewer ? 'border-glow-500/60 bg-glow-500/10 text-glow-300' : 'border-ink-700 text-stone-400 hover:text-glow-300'"
            :disabled="liking"
            :aria-pressed="likedByViewer"
            :aria-label="likedByViewer ? 'いいねを取り消す' : 'いいねする'"
            @click="toggleLike"
          >
            ♥ {{ likeCount.toLocaleString() }}
          </button>
        </div>
      </header>

      <section class="panel mt-5" style="backdrop-filter: none">
        <div class="p-4">
          <YouTubePlayer v-if="track.youtubeVideoId" />
          <p v-else class="text-[12px] text-stone-400">この曲の動画はまだ登録されていません。</p>
          <p v-if="track.youtubeVideoId && hasTimestamps" class="mt-3 text-[11.5px] leading-relaxed text-stone-400">
            本文中の <code class="font-mono text-hz-300">[00:00]</code> を押すと、このプレイヤーが該当秒へ移動します。
          </p>
        </div>
      </section>

      <ScoreMeters class="mt-5" :scores="review.scores" />

      <!-- 目次（ReviewToc / ReviewTocFab）はこの id を目印に見出しを拾う -->
      <div id="review-body" class="review-body mt-8" v-html="renderedBody" />

      <footer v-if="review.tags.length" class="mt-8 flex flex-wrap items-center gap-1.5">
        <span class="panel-title mr-1">タグ</span>
        <NuxtLink
          v-for="tag in review.tags"
          :key="tag.id"
          :to="`/reviews?tag=${encodeURIComponent(tag.slug)}`"
          class="chip"
        >
          #{{ tag.name }}
        </NuxtLink>
      </footer>

      <div v-if="canManage" class="mt-6 flex flex-wrap items-center gap-2">
        <NuxtLink :to="`/editor/${review.slug}`" class="btn-ghost !py-1.5 !text-[12px]">
          このレビューを編集
        </NuxtLink>
        <button
          type="button"
          class="btn-ghost !py-1.5 !text-[12px] !border-glow-600/50 !text-glow-300"
          :disabled="deleting"
          @click="onDelete"
        >
          {{ deleting ? '削除中…' : 'このレビューを削除' }}
        </button>
      </div>

      <section class="panel mt-8 p-5">
        <p class="panel-title">
          書いたひと
        </p>

        <div class="mt-3 flex items-start gap-3">
          <img
            v-if="review.author.avatarUrl"
            :src="review.author.avatarUrl"
            :alt="review.author.displayName"
            class="h-11 w-11 shrink-0 rounded-full border border-ink-700 object-cover"
            loading="lazy"
          >
          <div class="min-w-0">
            <NuxtLink
              :to="`/users/${review.author.username}`"
              class="text-[13.5px] font-semibold text-stone-100 transition hover:text-hz-200"
            >
              {{ review.author.displayName }}
            </NuxtLink>
            <p class="text-[11px] text-stone-400">
              @{{ review.author.username }}
            </p>
            <p v-if="review.author.bio" class="mt-2 line-clamp-3 text-[12px] leading-relaxed text-stone-400">
              {{ review.author.bio }}
            </p>
          </div>
        </div>
      </section>

      <section v-if="siblingReviews.length" class="mt-9">
        <h2 class="section-title">
          同じ楽曲の他のレビュー
        </h2>
        <div class="mt-4 space-y-4">
          <ReviewCard v-for="item in siblingReviews" :key="item.id" :review="item" />
        </div>
      </section>
      </article>

      <aside class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100dvh-160px)] lg:overflow-y-auto">
        <ReviewToc />

        <section class="panel p-5">
        <p class="panel-title">
          楽曲データ
        </p>
        <dl class="mt-3 space-y-2 text-[12px]">
          <div class="flex justify-between gap-3">
            <dt class="text-stone-400">
              ボカロP
            </dt>
            <dd class="text-right text-stone-200">
              {{ track.producerName }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-stone-400">
              歌声ライブラリ
            </dt>
            <dd class="text-right text-hz-300/90">
              {{ track.voiceSynthesizer }}
            </dd>
          </div>
          <div v-if="track.engineType" class="flex justify-between gap-3">
            <dt class="text-stone-400">
              エンジン
            </dt>
            <dd class="text-right text-stone-300">
              {{ track.engineType }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-stone-400">
              発表年
            </dt>
            <dd class="text-right font-mono text-stone-300">
              {{ track.releaseYear }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-stone-400">
              関連レビュー
            </dt>
            <dd class="text-right font-mono text-stone-300">
              {{ related.length }} 本
            </dd>
          </div>
        </dl>

        <NuxtLink :to="`/tracks/${track.slug}`" class="btn-ghost mt-4 w-full !py-1.5 !text-[12px]">
          楽曲ページを見る
        </NuxtLink>
      </section>

        <SideManifesto />
        <SideLoungeBanner />
      </aside>
    </div>

    <!-- モバイル: 右下の丸ボタンから目次をボトムシートで開く -->
    <ReviewTocFab />
  </div>
</template>
