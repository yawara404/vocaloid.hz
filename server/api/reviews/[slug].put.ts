/**
 * PUT /api/reviews/:slug  （:id でも解決可能）
 * 批評の更新（著者のみ）
 */
import { eq } from 'drizzle-orm'
import type { ReviewCategory } from '~~/shared/types'
import { CATEGORY_ORDER } from '~~/shared/types'
import { requireUser } from '../../utils/auth'
import { buildReviewValues, parseTagInput, syncReviewTags, upsertTrack } from '../../utils/content'
import { schema, useDb } from '../../utils/db'
import { findReviewById, findReviewBySlug } from '../../utils/reviews'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const param = getRouterParam(event, 'slug')
  if (!param) throw createError({ statusCode: 400, message: 'slug が必要です' })

  const found = findReviewBySlug(param) ?? findReviewById(param)
  if (!found) throw createError({ statusCode: 404, message: '批評が見つかりません' })
  if (found.row.review.userId !== user.id) {
    throw createError({ statusCode: 403, message: 'この批評を編集する権限がありません' })
  }

  const body = await readBody<Record<string, any>>(event)
  const current = found.row.review

  const title = String(body.title ?? current.title).trim()
  if (!title) throw createError({ statusCode: 400, message: '批評タイトルは必須です' })

  const contentMarkdown = String(body.contentMarkdown ?? current.contentMarkdown)
  if (contentMarkdown.trim().length < 20) {
    throw createError({ statusCode: 400, message: '本文が短すぎます（20 文字以上）' })
  }

  const trackInput = body.track ?? {}
  const trackRow = upsertTrack({
    title: String(trackInput.title ?? found.row.track.title),
    producerName: String(trackInput.producerName ?? found.row.track.producerName),
    voiceSynthesizer: String(trackInput.voiceSynthesizer ?? found.row.track.voiceSynthesizer),
    engineType: trackInput.engineType ?? found.row.track.engineType,
    releaseYear: trackInput.releaseYear ?? found.row.track.releaseYear,
    youtubeVideoId: String(trackInput.youtubeVideoId ?? found.row.track.youtubeVideoId),
    spotifyTrackId: trackInput.spotifyTrackId ?? found.row.track.spotifyTrackId,
    trackId: found.row.track.id,
  })

  const category: ReviewCategory = (CATEGORY_ORDER as string[]).includes(body.category)
    ? (body.category as ReviewCategory)
    : (current.category as ReviewCategory)

  const status = body.status === 'draft' || body.status === 'published' ? body.status : current.status as 'draft' | 'published'

  const values = buildReviewValues(
    {
      title,
      contentMarkdown,
      category,
      excerpt: body.excerpt ?? (contentMarkdown === current.contentMarkdown ? current.excerpt : null),
      scoreLyrics: body.scoreLyrics !== undefined ? body.scoreLyrics : current.scoreLyrics,
      scoreTuning: body.scoreTuning !== undefined ? body.scoreTuning : current.scoreTuning,
      scoreStructure: body.scoreStructure !== undefined ? body.scoreStructure : current.scoreStructure,
      status,
      publishedAt: status === 'published' && current.publishedAt ? new Date(current.publishedAt) : null,
    },
    user.id,
    trackRow.id,
    current.slug,
  )

  const updated = useDb()
    .update(schema.reviews)
    .set(values)
    .where(eq(schema.reviews.id, current.id))
    .returning()
    .get()

  if (body.tags !== undefined) syncReviewTags(updated.id, parseTagInput(body.tags))

  const detail = findReviewById(updated.id, user.id)
  return { review: detail?.detail ?? null }
})
