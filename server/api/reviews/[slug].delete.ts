/**
 * DELETE /api/reviews/:slug （:id でも解決可能）
 * 批評の削除（著者のみ）
 */
import { eq } from 'drizzle-orm'
import { requireUser } from '../../utils/auth'
import { schema, useDb } from '../../utils/db'
import { findReviewById, findReviewBySlug } from '../../utils/reviews'

export default defineEventHandler((event) => {
  const user = requireUser(event)
  const param = getRouterParam(event, 'slug')
  if (!param) throw createError({ statusCode: 400, message: 'slug が必要です' })

  const found = findReviewBySlug(param) ?? findReviewById(param)
  if (!found) throw createError({ statusCode: 404, message: '批評が見つかりません' })
  if (found.row.review.userId !== user.id) {
    throw createError({ statusCode: 403, message: 'この批評を削除する権限がありません' })
  }

  useDb().delete(schema.reviews).where(eq(schema.reviews.id, found.row.review.id)).run()

  return { ok: true, id: found.row.review.id }
})
