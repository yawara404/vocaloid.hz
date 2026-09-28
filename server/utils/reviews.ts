/**
 * server/utils/reviews.ts
 * 批評の一覧・詳細クエリと DTO マッピング。
 */
import { and, asc, count, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm'
import type { ReviewCategory, ReviewDetailDto, ReviewSummaryDto } from '~~/shared/types'
import { extractTimestamps, renderMarkdown } from '~~/shared/markdown'
import { youtubeThumbnail } from '~~/shared/youtube'
import type { Review, Tag, Track, User } from '../database/schema'
import { schema, useDb } from './db'

export type ReviewSort = 'new' | 'old' | 'words' | 'title' | 'reading_time'

export interface ReviewFilters {
  library?: string | null
  exactLibrary?: boolean
  category?: ReviewCategory | null
  tag?: string | null
  q?: string | null
  sort?: ReviewSort
  page?: number
  pageSize?: number
  userId?: string | null
  status?: 'published' | 'draft' | 'all'
  featured?: boolean
}

export interface ReviewRow {
  review: Review
  track: Track
  user: User
  tags: Tag[]
  likeCount: number
}

export function toTrackDto(track: Track) {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    producerName: track.producerName,
    voiceSynthesizer: track.voiceSynthesizer,
    engineType: track.engineType,
    releaseYear: track.releaseYear,
    youtubeVideoId: track.youtubeVideoId,
    thumbnailUrl: youtubeThumbnail(track.youtubeVideoId),
    viewCount: null,
    milestone: null,
  }
}

export function toAuthorDto(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  }
}

function toTagDto(tag: Tag) {
  return { id: tag.id, name: tag.name, slug: tag.slug }
}

export function toReviewSummary(row: ReviewRow): ReviewSummaryDto {
  return {
    id: row.review.id,
    slug: row.review.slug,
    title: row.review.title,
    excerpt: row.review.excerpt,
    category: row.review.category as ReviewCategory,
    wordCount: row.review.wordCount,
    readingTimeMinutes: row.review.readingTimeMinutes,
    publishedAt: row.review.publishedAt ? new Date(row.review.publishedAt).toISOString() : null,
    isFeatured: Boolean(row.review.isFeatured),
    isHallOfFame: false,
    likeCount: row.likeCount,
    track: toTrackDto(row.track),
    author: toAuthorDto(row.user),
    tags: row.tags.map(toTagDto),
  }
}

export function toReviewDetail(row: ReviewRow, canEdit: boolean, viewerId?: string | null): ReviewDetailDto {
  const markdown = row.review.contentMarkdown
  const likedByViewer = Boolean(viewerId && useDb().select({ userId: schema.reviewLikes.userId })
    .from(schema.reviewLikes)
    .where(and(eq(schema.reviewLikes.reviewId, row.review.id), eq(schema.reviewLikes.userId, viewerId)))
    .get())
  return {
    ...toReviewSummary(row),
    contentHtml: row.review.contentHtml || renderMarkdown(markdown),
    contentMarkdown: markdown,
    timestamps: extractTimestamps(markdown),
    scores: {
      lyrics: row.review.scoreLyrics,
      tuning: row.review.scoreTuning,
      structure: row.review.scoreStructure,
    },
    updatedAt: new Date(row.review.updatedAt).toISOString(),
    canEdit,
    likedByViewer,
  }
}

function buildConditions(filters: ReviewFilters): SQL[] {
  const db = useDb()
  const conditions: SQL[] = []

  conditions.push(
    eq(schema.reviews.status, filters.status && filters.status !== 'all' ? filters.status : 'published'),
  )

  if (filters.userId) conditions.push(eq(schema.reviews.userId, filters.userId))
  if (filters.category) conditions.push(eq(schema.reviews.category, filters.category))
  if (filters.library) conditions.push(filters.exactLibrary
    ? eq(schema.tracks.voiceSynthesizer, filters.library)
    : like(schema.tracks.voiceSynthesizer, `%${filters.library}%`))
  if (filters.featured) conditions.push(eq(schema.reviews.isFeatured, 1))

  if (filters.tag) {
    conditions.push(
      inArray(
        schema.reviews.id,
        db
          .select({ reviewId: schema.reviewTags.reviewId })
          .from(schema.reviewTags)
          .innerJoin(schema.tags, eq(schema.reviewTags.tagId, schema.tags.id))
          .where(or(eq(schema.tags.slug, filters.tag), eq(schema.tags.name, filters.tag))),
      ),
    )
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`
    const search = or(
      like(schema.reviews.title, pattern),
      like(schema.reviews.excerpt, pattern),
      like(schema.tracks.title, pattern),
      like(schema.tracks.producerName, pattern),
      like(schema.tracks.voiceSynthesizer, pattern),
      like(schema.users.displayName, pattern),
      like(schema.users.username, pattern),
    )
    if (search) conditions.push(search)
  }

  return conditions
}

function orderByFor(sort: ReviewSort = 'new') {
  switch (sort) {
    case 'old':
      return asc(schema.reviews.publishedAt)
    case 'words':
      return desc(schema.reviews.wordCount)
    case 'reading_time':
      return desc(schema.reviews.readingTimeMinutes)
    case 'title':
      return asc(schema.reviews.title)
    default:
      return desc(schema.reviews.publishedAt)
  }
}

function loadTags(reviewIds: string[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>()
  if (reviewIds.length === 0) return map

  const rows = useDb()
    .select({ reviewId: schema.reviewTags.reviewId, tag: schema.tags })
    .from(schema.reviewTags)
    .innerJoin(schema.tags, eq(schema.reviewTags.tagId, schema.tags.id))
    .where(inArray(schema.reviewTags.reviewId, reviewIds))
    .all()

  for (const row of rows) {
    const list = map.get(row.reviewId) ?? []
    list.push(row.tag)
    map.set(row.reviewId, list)
  }

  return map
}

/** 一覧クエリの共通 SELECT（track / user を join） */
function selectReviewRows() {
  return useDb()
    .select({ review: schema.reviews, track: schema.tracks, user: schema.users })
    .from(schema.reviews)
    .innerJoin(schema.tracks, eq(schema.reviews.trackId, schema.tracks.id))
    .innerJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
}

/**
 * 一覧・楽曲ページで共通に使う ReviewRow の組み立て。
 * タグと「いいね」数を埋めて、ReviewSummaryDto が必要とする項目を揃える。
 */
export function withTags(rows: { review: Review; track: Track; user: User }[]): ReviewRow[] {
  const ids = rows.map(row => row.review.id)
  const tags = loadTags(ids)
  const likeCounts = new Map<string, number>()
  if (ids.length) {
    const likes = useDb().select({ reviewId: schema.reviewLikes.reviewId, value: count() })
      .from(schema.reviewLikes)
      .where(inArray(schema.reviewLikes.reviewId, ids))
      .groupBy(schema.reviewLikes.reviewId)
      .all()
    for (const like of likes) likeCounts.set(like.reviewId, Number(like.value))
  }
  return rows.map(row => ({ ...row, tags: tags.get(row.review.id) ?? [], likeCount: likeCounts.get(row.review.id) ?? 0 }))
}

export function listReviews(filters: ReviewFilters = {}): {
  items: ReviewSummaryDto[]
  total: number
  page: number
  pageSize: number
} {
  const db = useDb()
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 50)
  const page = Math.max(filters.page ?? 1, 1)
  const where = and(...buildConditions(filters))

  const [countRow] = db
    .select({ value: count() })
    .from(schema.reviews)
    .innerJoin(schema.tracks, eq(schema.reviews.trackId, schema.tracks.id))
    .innerJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
    .where(where)
    .all()

  const total = Number(countRow?.value ?? 0)

  const rows = selectReviewRows()
    .where(where)
    .orderBy(orderByFor(filters.sort))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  return {
    items: withTags(rows).map(toReviewSummary),
    total,
    page,
    pageSize,
  }
}

export function getFeaturedReview(): ReviewSummaryDto | null {
  const { items } = listReviews({ featured: true, pageSize: 1, sort: 'new' })
  return items[0] ?? null
}

export function findReviewBySlug(
  slug: string,
  viewerId?: string | null,
): { row: ReviewRow; detail: ReviewDetailDto } | null {
  const found = selectReviewRows().where(eq(schema.reviews.slug, slug)).get()
  if (!found) return null

  const row = withTags([found])[0]!
  return { row, detail: toReviewDetail(row, Boolean(viewerId && viewerId === found.review.userId), viewerId) }
}

export function findReviewById(
  id: string,
  viewerId?: string | null,
): { row: ReviewRow; detail: ReviewDetailDto } | null {
  const found = selectReviewRows().where(eq(schema.reviews.id, id)).get()
  if (!found) return null

  const row = withTags([found])[0]!
  return { row, detail: toReviewDetail(row, Boolean(viewerId && viewerId === found.review.userId), viewerId) }
}

/** 同一楽曲に寄せられた他の批評 */
export function findRelatedReviews(trackId: string, excludeReviewId: string, limit = 3): ReviewSummaryDto[] {
  const rows = selectReviewRows()
    .where(and(eq(schema.reviews.trackId, trackId), eq(schema.reviews.status, 'published')))
    .orderBy(desc(schema.reviews.publishedAt))
    .limit(limit + 1)
    .all()

  return withTags(rows.filter(row => row.review.id !== excludeReviewId).slice(0, limit)).map(toReviewSummary)
}
