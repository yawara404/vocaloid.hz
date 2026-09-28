<script setup lang="ts">
/**
 * components/ReviewEditor.vue
 * ---------------------------------------------------------------
 * レビューの新規作成 / 編集フォーム。
 *  - 曲の特定情報（曲名 / ボカロP / 歌声ライブラリ / YouTube URL）を必須にする
 *  - 多面的分析評価メーター（歌詞 / 調声 / 音響構造）
 *  - Markdown 本文 + リアルタイムプレビュー（[mm:ss] ボタンも再現）
 *
 * 実 API:
 *   POST /api/reviews       body: { title, contentMarkdown, category, tags, status, score*, track }
 *   PUT  /api/reviews/:slug 同上（著者のみ）
 *   どちらも { review: ReviewDetailDto | null } を返す
 */
import type { FacetCount, ReviewCategory, ReviewDetailDto, TagListResponse } from '~~/shared/types'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~~/shared/types'
import { countWords, formatTimestamp, readingTimeMinutes, renderMarkdown } from '~~/shared/markdown'
import { extractYouTubeVideoId, youtubeWatchUrl } from '~~/shared/youtube'
import { usePlayerStore } from '~~/stores/player'

export interface TrackPrefill {
  title?: string
  producerName?: string
  voiceSynthesizer?: string
  engineType?: string
  releaseYear?: number
  youtubeVideoId?: string
}

const props = defineProps<{
  review?: ReviewDetailDto | null
  prefillTrack?: TrackPrefill | null
}>()

const { data: tagPayload } = await useFetch<TagListResponse>('/api/tags?limit=100')

/** GET /api/tags → { items: [{ key: slug, label: name, count }] } */
const tagOptions = computed<FacetCount[]>(() => tagPayload.value?.items ?? [])

interface EditorForm {
  title: string
  excerpt: string
  category: ReviewCategory
  contentMarkdown: string
  track: {
    title: string
    producerName: string
    voiceSynthesizer: string
    engineType: string
    releaseYear: number | null
    youtubeUrl: string
  }
  lyricsScore: number
  tuningScore: number
  structureScore: number
  /** サーバーはタグ「名」で照合するため、選択済みタグ名を保持する */
  tagNames: string[]
}

function createForm(): EditorForm {
  const review = props.review
  if (review) {
    return {
      title: review.title,
      excerpt: review.excerpt,
      category: review.category,
      contentMarkdown: review.contentMarkdown,
      track: {
        title: review.track.title,
        producerName: review.track.producerName,
        voiceSynthesizer: review.track.voiceSynthesizer,
        engineType: review.track.engineType ?? '',
        releaseYear: review.track.releaseYear ?? null,
        youtubeUrl: review.track.youtubeVideoId ? youtubeWatchUrl(review.track.youtubeVideoId) : '',
      },
      lyricsScore: review.scores.lyrics ?? 3,
      tuningScore: review.scores.tuning ?? 3,
      structureScore: review.scores.structure ?? 3,
      tagNames: review.tags.map(tag => tag.name),
    }
  }

  const prefill = props.prefillTrack
  return {
    title: '',
    excerpt: '',
    category: 'lyrics',
    contentMarkdown: '',
    track: {
      title: prefill?.title ?? '',
      producerName: prefill?.producerName ?? '',
      voiceSynthesizer: prefill?.voiceSynthesizer ?? '',
      engineType: prefill?.engineType ?? '',
      releaseYear: prefill?.releaseYear ?? null,
      youtubeUrl: prefill?.youtubeVideoId ? youtubeWatchUrl(prefill.youtubeVideoId) : '',
    },
    lyricsScore: 3,
    tuningScore: 3,
    structureScore: 3,
    tagNames: [],
  }
}

const form = reactive<EditorForm>(createForm())

const showingPreview = ref(false)
const saving = ref(false)
const message = ref<string | null>(null)
const newTagNames = ref('')

const wordCount = computed(() => countWords(form.contentMarkdown))
const readingTime = computed(() => readingTimeMinutes(form.contentMarkdown))
const renderedBody = computed(() => renderMarkdown(form.contentMarkdown))

/* ---------------------------------------------------------------
 * 本文の入力補助（LAYOUT_ARCHITECTURE §2.3 の「★ 01:23 挿入」）
 *  - カーソル位置へ Markdown を差し込む
 *  - 再生中の位置をそのままタイムスタンプ記法にする
 * ------------------------------------------------------------- */
const bodyField = ref<HTMLTextAreaElement | null>(null)
const player = usePlayerStore()

/** いま再生している位置（プレイヤーが空なら 00:00） */
const playbackLabel = computed(() => formatTimestamp(player.currentTime))

/** カーソル位置に文字列を差し込み、差し込んだ直後にカーソルを戻す */
function insertMarkdown(text: string, options: { block?: boolean } = {}): void {
  const field = bodyField.value
  const value = form.contentMarkdown
  const start = field?.selectionStart ?? value.length
  const end = field?.selectionEnd ?? start
  const before = value.slice(0, start)
  const after = value.slice(end)
  const needsBreak = options.block && before !== '' && !before.endsWith('\n')
  const insertion = `${needsBreak ? '\n' : ''}${text}`

  form.contentMarkdown = `${before}${insertion}${after}`

  nextTick(() => {
    if (!bodyField.value) return
    const caret = before.length + insertion.length
    bodyField.value.focus()
    bodyField.value.setSelectionRange(caret, caret)
  })
}

/** 選択範囲を `before` / `after` で囲む（選択が無ければその場に挿入する） */
function wrapSelection(before: string, after: string): void {
  const field = bodyField.value
  const value = form.contentMarkdown
  const start = field?.selectionStart ?? value.length
  const end = field?.selectionEnd ?? start
  const selected = value.slice(start, end)
  const insertion = `${before}${selected || '強調'}${after}`

  form.contentMarkdown = `${value.slice(0, start)}${insertion}${value.slice(end)}`

  nextTick(() => {
    if (!bodyField.value) return
    bodyField.value.focus()
    bodyField.value.setSelectionRange(start, start + insertion.length)
  })
}

/** 本文に差し込める Markdown の道具箱 */
const toolbar: { label: string, title: string, insert: () => void }[] = [
  { label: 'H2', title: '見出し（H2）', insert: () => insertMarkdown('## ', { block: true }) },
  { label: 'H3', title: '見出し（H3）', insert: () => insertMarkdown('### ', { block: true }) },
  { label: '太字', title: '強調（**）', insert: () => wrapSelection('**', '**') },
  { label: '引用', title: '引用（>）', insert: () => insertMarkdown('> ', { block: true }) },
]

/** 再生中の位置を `[mm:ss]` として挿入する */
function insertTimestamp(): void {
  insertMarkdown(`[${playbackLabel.value}]`)
}
const detectedVideoId = computed(() => extractYouTubeVideoId(form.track.youtubeUrl))

const meters = [
  { key: 'lyricsScore', label: '歌詞の文学性' },
  { key: 'tuningScore', label: '調声アプローチ' },
  { key: 'structureScore', label: '音響構造の複雑さ' },
] as const

function toggleTag(tagName: string): void {
  const index = form.tagNames.indexOf(tagName)
  if (index === -1) form.tagNames.push(tagName)
  else form.tagNames.splice(index, 1)
}

async function save(publish: boolean): Promise<void> {
  message.value = null

  if (!form.title.trim()) {
    message.value = 'レビュータイトルを入力してください。'
    return
  }
  if (!form.track.title.trim() || !form.track.producerName.trim() || !form.track.voiceSynthesizer.trim()) {
    message.value = '曲名・ボカロP・歌声ライブラリは必須です。'
    return
  }
  if (!detectedVideoId.value) {
    message.value = 'YouTube の URL を正しく入力してください（必須）。'
    return
  }
  if (form.contentMarkdown.trim().length < 20) {
    message.value = '本文が短すぎます（20 文字以上）。'
    return
  }

  const extraTags = newTagNames.value
    .split(/[,、\n]/)
    .map((name: string) => name.trim())
    .filter(Boolean)

  const payload = {
    title: form.title.trim(),
    excerpt: form.excerpt.trim() || undefined,
    category: form.category,
    contentMarkdown: form.contentMarkdown,
    track: {
      title: form.track.title.trim(),
      producerName: form.track.producerName.trim(),
      voiceSynthesizer: form.track.voiceSynthesizer.trim(),
      engineType: form.track.engineType.trim() || undefined,
      releaseYear: form.track.releaseYear ?? undefined,
      youtubeVideoId: detectedVideoId.value,
    },
    scoreLyrics: form.lyricsScore,
    scoreTuning: form.tuningScore,
    scoreStructure: form.structureScore,
    tags: [...form.tagNames, ...extraTags],
    status: publish ? 'published' : 'draft',
  }

  saving.value = true

  try {
    if (props.review) {
      await $fetch<{ review: ReviewDetailDto | null }>(`/api/reviews/${props.review.slug}`, {
        method: 'PUT',
        body: payload,
      })
      await navigateTo(`/reviews/${props.review.slug}`)
    }
    else {
      const created = await $fetch<{ review: ReviewDetailDto | null }>('/api/reviews', {
        method: 'POST',
        body: payload,
      })
      await navigateTo(`/reviews/${created.review?.slug ?? ''}`)
    }
  }
  catch (err: any) {
    message.value = err?.data?.message ?? '保存に失敗しました'
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="panel p-5">
      <p class="panel-title">
        レビューの基本情報
      </p>

      <label class="mt-3 block">
        <span class="text-[11.5px] text-stone-400">レビュータイトル</span>
        <input v-model="form.title" type="text" class="field mt-1.5" placeholder="例：サザンクロスに宿る、二つの歌声の距離">
      </label>

      <label class="mt-4 block">
        <span class="text-[11.5px] text-stone-400">抜粋文（任意）</span>
        <textarea v-model="form.excerpt" class="field mt-1.5 min-h-20" maxlength="400" placeholder="未入力の場合は本文から自動で作成します。" />
      </label>

      <div class="mt-4">
        <span class="text-[11.5px] text-stone-400">カテゴリ</span>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="key in CATEGORY_ORDER"
            :key="key"
            type="button"
            class="chip"
            :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': form.category === key }"
            @click="form.category = key"
          >
            {{ CATEGORY_LABELS[key] }}
          </button>
        </div>
      </div>
    </section>

    <section class="panel p-5">
      <p class="panel-title">
        曲の特定情報（必須）
      </p>

      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="text-[11.5px] text-stone-400">曲名</span>
          <input v-model="form.track.title" type="text" class="field mt-1.5" placeholder="サザンクロス">
        </label>

        <label class="block">
          <span class="text-[11.5px] text-stone-400">ボカロP</span>
          <input v-model="form.track.producerName" type="text" class="field mt-1.5" placeholder="すりぃ">
        </label>

        <label class="block">
          <span class="text-[11.5px] text-stone-400">歌声ライブラリ</span>
          <input v-model="form.track.voiceSynthesizer" type="text" class="field mt-1.5" placeholder="flower">
        </label>

        <label class="block">
          <span class="text-[11.5px] text-stone-400">エンジン（任意）</span>
          <input v-model="form.track.engineType" type="text" class="field mt-1.5" placeholder="VOCALOID4 / V6X">
        </label>

        <label class="block">
          <span class="text-[11.5px] text-stone-400">発表年（任意）</span>
          <input v-model.number="form.track.releaseYear" type="number" min="2000" max="2100" step="1" class="field mt-1.5" placeholder="2007">
        </label>
      </div>

      <label class="mt-4 block">
        <span class="text-[11.5px] text-stone-400">YouTube URL（必須）</span>
        <input v-model="form.track.youtubeUrl" type="url" class="field mt-1.5" placeholder="https://www.youtube.com/watch?v=...">
      </label>

      <p v-if="form.track.youtubeUrl" class="mt-1.5 text-[11px] text-stone-400">
        <template v-if="detectedVideoId">
          動画 ID：<code class="font-mono text-hz-300">{{ detectedVideoId }}</code>
        </template>
        <template v-else>
          <span class="text-glow-300">YouTube の URL を認識できませんでした。</span>
        </template>
      </p>
    </section>

    <section class="panel p-5">
      <p class="panel-title">
        多面的分析評価メーター
      </p>
      <p class="mt-1 text-[11px] text-stone-400">
        点数ではなく「どの方向に振れているか」を示す指標です。
      </p>

      <div class="mt-4 space-y-4">
        <label v-for="meter in meters" :key="meter.key" class="block">
          <span class="flex items-baseline justify-between text-[12px]">
            <span class="text-stone-300">{{ meter.label }}</span>
            <span class="font-mono text-hz-300">{{ form[meter.key] }} / 5</span>
          </span>
          <input
            v-model.number="form[meter.key]"
            type="range"
            min="1"
            max="5"
            step="1"
            class="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-sunken accent-hz-500"
          >
        </label>
      </div>
    </section>

    <section class="panel p-5">
      <p class="panel-title">
        タグ
      </p>

      <div v-if="tagOptions.length" class="mt-3 flex flex-wrap gap-1">
        <button
          v-for="tag in tagOptions"
          :key="tag.key"
          type="button"
          class="chip"
          :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': form.tagNames.includes(tag.label) }"
          @click="toggleTag(tag.label)"
        >
          #{{ tag.label }}
        </button>
      </div>

      <p v-else class="mt-3 text-[11.5px] text-stone-400">
        まだ登録済みのタグがありません。下の入力欄から追加できます。
      </p>

      <label class="mt-4 block">
        <span class="text-[11.5px] text-stone-400">新しいタグ（カンマ区切り）</span>
        <input v-model="newTagNames" type="text" class="field mt-1.5" placeholder="例：シティポップ, 疾走感">
      </label>
    </section>

    <section class="panel p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="panel-title">
          本文（Markdown）
        </p>

        <div class="flex items-center gap-3">
          <span class="font-mono text-[11px] text-stone-400">
            {{ wordCount.toLocaleString() }} 字 ／ 約 {{ readingTime }} 分
          </span>
          <!-- タブレット・モバイルでは 1 ペインを切り替える。lg 以上は左右 2 ペインで同時に見える -->
          <button
            type="button"
            class="chip lg:hidden"
            :class="{ '!border-hz-500 !bg-hz-500/15 !text-hz-200': showingPreview }"
            @click="showingPreview = !showingPreview"
          >
            {{ showingPreview ? '編集に戻る' : 'プレビュー' }}
          </button>
        </div>
      </div>

      <p class="mt-2 text-[11px] leading-relaxed text-stone-400">
        <code class="font-mono text-hz-300">[1:23]</code> や
        <code class="font-mono text-hz-300">[01:23]</code> と書くと、
        押すと上部プレイヤーが該当秒へジャンプするボタンになります。
      </p>

      <!--
        2 ペイン構成（LAYOUT_ARCHITECTURE §2.3）。
        lg 以上では左が入力・右がプレビューで、広い画面を作業領域として使う。
      -->
      <div class="mt-3 grid gap-4 lg:grid-cols-2">
        <div class="min-w-0" :class="showingPreview ? 'hidden lg:block' : ''">
          <!-- 入力補助ツールバー（見出し・強調・引用・再生位置のタイムスタンプ） -->
          <div class="mb-2 flex flex-wrap items-center gap-1.5">
            <button
              v-for="tool in toolbar"
              :key="tool.label"
              type="button"
              class="chip !px-2.5 !py-1 !text-[11px]"
              :title="tool.title"
              @click="tool.insert()"
            >
              {{ tool.label }}
            </button>

            <button
              type="button"
              class="chip !px-2.5 !py-1 !text-[11px]"
              title="いま再生している位置のタイムスタンプを挿入する"
              @click="insertTimestamp"
            >
              ⏱ {{ playbackLabel }} を挿入
            </button>
          </div>

          <textarea
            ref="bodyField"
            v-model="form.contentMarkdown"
            class="field min-h-[420px] !font-mono !text-[13px] !leading-relaxed lg:min-h-[520px]"
            placeholder="## サビ前の静けさ&#10;&#10;[1:02] で一度すべての音が抜ける。&#10;ここでのブレスは「技術」ではなく「決断」だ。"
          />
        </div>

        <div class="min-w-0" :class="showingPreview ? '' : 'hidden lg:block'">
          <p class="mb-2 text-[11px] text-stone-400">
            プレビュー（実際の表示と同じ体裁）
          </p>
          <div class="min-h-[420px] rounded-lg border border-ink-800 bg-ink-950/60 p-5 lg:min-h-[520px] lg:max-h-[calc(100dvh-220px)] lg:overflow-y-auto">
            <div v-if="renderedBody" class="review-body" v-html="renderedBody" />
            <p v-else class="text-[12.5px] text-stone-400">
              まだ本文がありません。
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="panel flex flex-wrap items-center gap-3 p-5">
      <button type="button" class="btn-primary" :disabled="saving" @click="save(true)">
        {{ saving ? '保存中…' : (review ? '更新して公開する' : '公開する') }}
      </button>

      <button type="button" class="btn-ghost" :disabled="saving" @click="save(false)">
        下書きとして保存
      </button>

      <NuxtLink :to="review ? `/reviews/${review.slug}` : '/reviews'" class="text-[12px] text-stone-400 transition hover:text-stone-300">
        やめる
      </NuxtLink>

      <p v-if="message" class="w-full text-[12px] text-glow-300">
        {{ message }}
      </p>
    </section>
  </div>
</template>
