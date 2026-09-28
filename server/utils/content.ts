/**
 * server/utils/content.ts
 * 批評の作成・更新（書き込みパス）で使う共通処理。
 * Markdown から導出フィールド（HTML / 抜粋 / 文字数 / 読了時間）を計算し、
 * 楽曲とタグを upsert する。
 */
import { eq } from 'drizzle-orm'
import type { ReviewCategory } from '~~/shared/types'
import {
  countWords,
  makeExcerpt,
  readingTimeMinutes,
  renderMarkdown,
} from '~~/shared/markdown'
import { extractYouTubeVideoId } from '~~/shared/youtube'
import type { Track } from '../database/schema'
import { schema, useDb } from './db'

/** タイトル → slug 候補（日本語は残り、記号は落とす） */
export function slugifyText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function randomSuffix(length = 5): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return [...bytes].map(byte => (byte % 36).toString(36)).join('')
}

/** 衝突しない批評 slug を生成する（日本語タイトルの場合はランダム付与） */
export function ensureUniqueReviewSlug(title: string, excludeId?: string | null): string {
  const db = useDb()
  const base = slugifyText(title) || `review-${randomSuffix()}`
  let slug = base

  for (let attempt = 0; attempt < 50; attempt++) {
    const existing = db
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .where(eq(schema.reviews.slug, slug))
      .get()
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${randomSuffix()}`
  }

  return `${base}-${Date.now().toString(36)}`
}

export function ensureUniqueTrackSlug(title: string, producerName: string, excludeId?: string | null): string {
  const db = useDb()
  const base = slugifyText(`${title} ${producerName}`) || `track-${randomSuffix()}`
  let slug = base

  for (let attempt = 0; attempt < 50; attempt++) {
    const existing = db
      .select({ id: schema.tracks.id })
      .from(schema.tracks)
      .where(eq(schema.tracks.slug, slug))
      .get()
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${randomSuffix()}`
  }

  return `${base}-${Date.now().toString(36)}`
}

export interface TrackInput {
  title: string
  producerName: string
  voiceSynthesizer: string
  engineType?: string | null
  releaseYear?: number | null
  /** URL でも動画 ID でも受け付ける */
  youtubeVideoId: string
  spotifyTrackId?: string | null
  /** 既存 track を更新する場合の ID */
  trackId?: string | null
}

/** 楽曲を upsert し、Track 行を返す */
export function upsertTrack(input: TrackInput): Track {
  const db = useDb()
  const videoId = extractYouTubeVideoId(input.youtubeVideoId)
  if (!videoId) {
    throw createError({ statusCode: 400, message: 'YouTube 動画 URL / 動画 ID が不正です' })
  }

  const year = Number(input.releaseYear) || new Date().getFullYear()
  const values = {
    title: input.title.trim(),
    producerName: input.producerName.trim(),
    voiceSynthesizer: input.voiceSynthesizer.trim(),
    engineType: input.engineType?.trim() || null,
    releaseYear: year,
    youtubeVideoId: videoId,
    spotifyTrackId: input.spotifyTrackId?.trim() || null,
  }

  if (input.trackId) {
    const existing = db.select().from(schema.tracks).where(eq(schema.tracks.id, input.trackId)).get()
    if (existing) {
      const unchanged = Object.entries(values).every(([key, value]) => existing[key as keyof Track] === value)
      if (unchanged) return existing

      // 同じ楽曲への別の批評を編集時に書き換えない。
      const references = db.select({ id: schema.reviews.id })
        .from(schema.reviews)
        .where(eq(schema.reviews.trackId, existing.id))
        .all()
      if (references.length > 1) {
        return db.insert(schema.tracks)
          .values({ ...values, slug: ensureUniqueTrackSlug(values.title, values.producerName) })
          .returning()
          .get()
      }

      return db
        .update(schema.tracks)
        .set(values)
        .where(eq(schema.tracks.id, existing.id))
        .returning()
        .get()
    }
  }

  // 既に登録された同じ動画・メタデータなら楽曲ページを共有する。
  const matchingTrack = db.select().from(schema.tracks)
    .where(eq(schema.tracks.youtubeVideoId, videoId))
    .all()
    .find(track => Object.entries(values).every(([key, value]) => track[key as keyof Track] === value))
  if (matchingTrack) return matchingTrack

  return db
    .insert(schema.tracks)
    .values({ ...values, slug: ensureUniqueTrackSlug(values.title, values.producerName) })
    .returning()
    .get()
}

export interface ReviewValuesInput {
  title: string
  contentMarkdown: string
  category: ReviewCategory
  excerpt?: string | null
  scoreLyrics?: number | null
  scoreTuning?: number | null
  scoreStructure?: number | null
  status?: 'draft' | 'published'
  publishedAt?: Date | null
}

function clampScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  const parsed = Math.round(Number(value))
  if (parsed < 1) return 1
  if (parsed > 5) return 5
  return parsed
}

/** Markdown から導出フィールドを含む reviews 行の値を組み立てる */
export function buildReviewValues(input: ReviewValuesInput, userId: string, trackId: string, slug: string) {
  const markdown = input.contentMarkdown ?? ''
  const status = input.status ?? 'published'
  const publishedAt = status === 'published' ? (input.publishedAt ?? new Date()) : null

  return {
    userId,
    trackId,
    title: input.title.trim(),
    slug,
    contentMarkdown: markdown,
    contentHtml: renderMarkdown(markdown),
    excerpt: (input.excerpt?.trim() || makeExcerpt(markdown)).slice(0, 400),
    wordCount: countWords(markdown),
    readingTimeMinutes: readingTimeMinutes(markdown),
    category: input.category,
    scoreLyrics: clampScore(input.scoreLyrics),
    scoreTuning: clampScore(input.scoreTuning),
    scoreStructure: clampScore(input.scoreStructure),
    status,
    publishedAt,
    updatedAt: new Date(),
  }
}

/** タグ名の配列を tags / review_tags に同期する */
export function syncReviewTags(reviewId: string, tagNames: string[]): void {
  const db = useDb()

  db.delete(schema.reviewTags).where(eq(schema.reviewTags.reviewId, reviewId)).run()

  const unique = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))].slice(0, 12)

  for (const name of unique) {
    const existing = db.select().from(schema.tags).where(eq(schema.tags.name, name)).get()
    let tagId = existing?.id

    if (!tagId) {
      const base = slugifyText(name) || `tag-${randomSuffix()}`
      let slug = base
      for (let attempt = 0; attempt < 50; attempt++) {
        const clash = db.select({ id: schema.tags.id }).from(schema.tags).where(eq(schema.tags.slug, slug)).get()
        if (!clash) break
        slug = `${base}-${randomSuffix()}`
      }
      tagId = db.insert(schema.tags).values({ name, slug }).returning().get().id
    }

    db.insert(schema.reviewTags)
      .values({ reviewId, tagId })
      .onConflictDoNothing()
      .run()
  }
}

/** "a, b、c" / ["a","b"] の両方を受け取るタグパーサ */
export function parseTagInput(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(value => String(value).trim()).filter(Boolean)
  if (typeof input === 'string') {
    return input
      .split(/[,、\n]/)
      .map(value => value.trim())
      .filter(Boolean)
  }
  return []
}
