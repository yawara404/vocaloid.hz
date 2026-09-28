import type { H3Event } from 'h3'
import { and, count, eq } from 'drizzle-orm'
import { requireUser } from './auth'
import { schema, useDb } from './db'

export function setReviewLike(event: H3Event, liked: boolean) {
  const user = requireUser(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: '批評を指定してください' })

  const db = useDb()
  const review = db.select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(and(eq(schema.reviews.slug, slug), eq(schema.reviews.status, 'published')))
    .get()
  if (!review) throw createError({ statusCode: 404, message: '批評が見つかりません' })

  if (liked) {
    db.insert(schema.reviewLikes).values({ reviewId: review.id, userId: user.id }).onConflictDoNothing().run()
  }
  else {
    db.delete(schema.reviewLikes)
      .where(and(eq(schema.reviewLikes.reviewId, review.id), eq(schema.reviewLikes.userId, user.id)))
      .run()
  }

  const result = db.select({ value: count() }).from(schema.reviewLikes)
    .where(eq(schema.reviewLikes.reviewId, review.id))
    .get()
  return { likeCount: Number(result?.value ?? 0), likedByViewer: liked }
}
