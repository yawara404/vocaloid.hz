/**
 * server/utils/tracks.ts
 * 楽曲ライブラリ（tracks）の一覧・詳細。
 */
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import type { ReviewSummaryDto, TrackDto } from '~~/shared/types'
import { schema, useDb } from './db'
import { toReviewSummary, toTrackDto, withTags } from './reviews'

export interface TrackListItem {
  track: TrackDto
  reviewCount: number
  latestReview: { slug: string; title: string } | null
}

export interface TrackFilters {
  library?: string | null
  q?: string | null
  page?: number
  pageSize?: number
}

export function listTracks(filters: TrackFilters = {}): { items: TrackListItem[]; total: number; page: number; pageSize: number } {
  const db = useDb()
  const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 60)
  const page = Math.max(filters.page ?? 1, 1)

  const conditions = []
  if (filters.library) conditions.push(like(schema.tracks.voiceSynthesizer, `%${filters.library}%`))
  if (filters.q) {
    const pattern = `%${filters.q}%`
    const search = or(
      like(schema.tracks.title, pattern),
      like(schema.tracks.producerName, pattern),
      like(schema.tracks.voiceSynthesizer, pattern),
    )
    if (search) conditions.push(search)
  }
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = db
    .select({ value: sql<number>`count(*)` })
    .from(schema.tracks)
    .where(where)
    .all()

  const rows = db
    .select({ track: schema.tracks, reviewCount: sql<number>`count(${schema.reviews.id})` })
    .from(schema.tracks)
    .leftJoin(
      schema.reviews,
      and(eq(schema.reviews.trackId, schema.tracks.id), eq(schema.reviews.status, 'published')),
    )
    .where(where)
    .groupBy(schema.tracks.id)
    .orderBy(desc(sql`count(${schema.reviews.id})`), asc(schema.tracks.title))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  const trackIds = rows.map(row => row.track.id)
  const latest = new Map<string, { slug: string; title: string }>()

  if (trackIds.length > 0) {
    const reviews = db
      .select({ trackId: schema.reviews.trackId, slug: schema.reviews.slug, title: schema.reviews.title })
      .from(schema.reviews)
      .where(and(inArray(schema.reviews.trackId, trackIds), eq(schema.reviews.status, 'published')))
      .orderBy(desc(schema.reviews.publishedAt))
      .all()

    for (const review of reviews) {
      if (!latest.has(review.trackId)) latest.set(review.trackId, { slug: review.slug, title: review.title })
    }
  }

  return {
    items: rows.map(row => ({
      track: toTrackDto(row.track),
      reviewCount: Number(row.reviewCount),
      latestReview: latest.get(row.track.id) ?? null,
    })),
    total: Number(countRow?.value ?? 0),
    page,
    pageSize,
  }
}

export interface ShelfTrack {
  title: string
  producerName: string
  voiceSynthesizer: string
  releaseYear: number
}

/** 棚から外す「テスト用らしい」語（テストP の曲などを店主に喋らせない） */
const TEST_TRACK_PATTERN = /テスト|検証|サンプル|sample|test|dummy/i

/**
 * 店主のひとりごと用に「棚の一枚」をランダムに選ぶ。
 * サイトの楽曲ライブラリに登録済みの曲なので、実在する曲名・ボカロP・使用ライブラリで話せる。
 *  - テスト用として登録された曲（テストP / 検証P など）は棚から外す
 *  - avoidContents に含まれる曲（直近で話した盤）は避け、全部避けてしまうときだけ戻す
 */
export function pickRandomShelfTrack(options: { avoidContents?: string[] } = {}): ShelfTrack | null {
  const rows = useDb()
    .select({
      title: schema.tracks.title,
      producerName: schema.tracks.producerName,
      voiceSynthesizer: schema.tracks.voiceSynthesizer,
      releaseYear: schema.tracks.releaseYear,
    })
    .from(schema.tracks)
    .all()
    .filter(row => !TEST_TRACK_PATTERN.test(row.title) && !TEST_TRACK_PATTERN.test(row.producerName))

  if (rows.length === 0) return null

  const avoid = options.avoidContents ?? []
  const fresh = rows.filter(row => !avoid.some(content => content.includes(row.title)))
  const pool = fresh.length > 0 ? fresh : rows

  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

export function findTrackBySlug(slug: string): { track: TrackDto; reviews: ReviewSummaryDto[] } | null {
  const db = useDb()
  const track = db.select().from(schema.tracks).where(eq(schema.tracks.slug, slug)).get()
  if (!track) return null

  const rows = db
    .select({ review: schema.reviews, track: schema.tracks, user: schema.users })
    .from(schema.reviews)
    .innerJoin(schema.tracks, eq(schema.reviews.trackId, schema.tracks.id))
    .innerJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
    .where(and(eq(schema.reviews.trackId, track.id), eq(schema.reviews.status, 'published')))
    .orderBy(desc(schema.reviews.publishedAt))
    .all()

  return {
    track: toTrackDto(track),
    // 一覧と同じ形の DTO を返すため、タグと「いいね」数も同じ経路（withTags）で埋める
    reviews: withTags(rows).map(toReviewSummary),
  }
}
