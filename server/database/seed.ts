import { eq } from 'drizzle-orm'
import { hashPassword } from '../utils/auth'
import {
  countWords,
  makeExcerpt,
  readingTimeMinutes,
  renderMarkdown,
} from '~~/shared/markdown'
import { extractYouTubeVideoId } from '~~/shared/youtube'
import type { Db } from './db'
import { schema } from './schema'
import { seedReviews, seedUsers } from './seed-data'
import type { SeedReview } from './seed-types'

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/** タグ名の重複・slug 衝突を吸収する */
function ensureTag(db: Db, name: string, cache: Map<string, string>): string {
  const cached = cache.get(name)
  if (cached) return cached

  const existing = db.select().from(schema.tags).where(eq(schema.tags.name, name)).get()
  if (existing) {
    cache.set(name, existing.id)
    return existing.id
  }

  const base = slugify(name) || 'tag'
  let slug = base
  let suffix = 2
  while (db.select({ id: schema.tags.id }).from(schema.tags).where(eq(schema.tags.slug, slug)).get()) {
    slug = `${base}-${suffix++}`
  }

  const created = db
    .insert(schema.tags)
    .values({ name, slug })
    .returning()
    .get()

  cache.set(name, created.id)
  return created.id
}

function upsertTrack(db: Db, review: SeedReview, cache: Map<string, string>): string {
  const cached = cache.get(review.track.slug)
  if (cached) return cached

  const existing = db.select().from(schema.tracks).where(eq(schema.tracks.slug, review.track.slug)).get()
  if (existing) {
    cache.set(review.track.slug, existing.id)
    return existing.id
  }

  const videoId = extractYouTubeVideoId(review.track.youtubeVideoId) ?? review.track.youtubeVideoId

  const created = db
    .insert(schema.tracks)
    .values({
      title: review.track.title,
      producerName: review.track.producerName,
      voiceSynthesizer: review.track.voiceSynthesizer,
      engineType: review.track.engineType,
      releaseYear: review.track.releaseYear,
      youtubeVideoId: videoId,
      slug: review.track.slug,
    })
    .returning()
    .get()

  cache.set(review.track.slug, created.id)
  return created.id
}

/** デモデータを投入する（冪等） */
export function seedDatabase(db: Db): void {
  const userIds = new Map<string, string>()

  for (const user of seedUsers) {
    const row = db
      .insert(schema.users)
      .values({
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        passwordHash: hashPassword(user.password),
        bio: user.bio,
        provider: user.provider ?? 'password',
      })
      .returning()
      .get()
    userIds.set(user.username, row.id)
  }

  const trackIds = new Map<string, string>()
  const tagIds = new Map<string, string>()
  const fallbackUserId = userIds.get(seedUsers[0]!.username)!

  for (const review of seedReviews) {
    const trackId = upsertTrack(db, review, trackIds)
    const userId = userIds.get(review.author) ?? fallbackUserId

    const markdown = review.contentMarkdown
    const row = db
      .insert(schema.reviews)
      .values({
        userId,
        trackId,
        title: review.title,
        slug: review.slug,
        contentMarkdown: markdown,
        contentHtml: renderMarkdown(markdown),
        excerpt: makeExcerpt(markdown),
        wordCount: countWords(markdown),
        readingTimeMinutes: readingTimeMinutes(markdown),
        category: review.category,
        scoreLyrics: review.scores.lyrics,
        scoreTuning: review.scores.tuning,
        scoreStructure: review.scores.structure,
        isFeatured: review.isFeatured ? 1 : 0,
        isHallOfFame: review.isHallOfFame ? 1 : 0,
        status: 'published',
        publishedAt: new Date(review.publishedAt),
      })
      .returning()
      .get()

    for (const tagName of review.tags) {
      const tagId = ensureTag(db, tagName, tagIds)
      db.insert(schema.reviewTags)
        .values({ reviewId: row.id, tagId })
        .onConflictDoNothing()
        .run()
    }
  }

  // eslint-disable-next-line no-console
  console.info(
    `[vocaloid.hz] seed 完了: users=${seedUsers.length} tracks=${trackIds.size} reviews=${seedReviews.length} tags=${tagIds.size}`,
  )
}

/** users が空のときだけ seed を実行する */
export function seedIfEmpty(db: Db): void {
  const existing = db.select({ id: schema.users.id }).from(schema.users).all()
  if (existing.length > 0) return
  seedDatabase(db)
}
